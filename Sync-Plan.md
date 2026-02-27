# RoundingApp — Sync PRD
## Azure Function Proxy + GitHub Gist Storage

---

## Context

RoundingApp is a personal PWA for a medical clerk doing hospital rounds. It stores patient records and daily FRICHMOND updates in IndexedDB (via Dexie.js) on-device. The app already works — patients can be added, daily notes taken, and formatted text copied to clipboard.

The problem: the clerk uses their **phone** during rounds (bedside data entry) and their **laptop** for write-ups afterward. Right now these are two separate IndexedDB databases with no connection. Getting data from phone to laptop requires manual JSON export/import or copy-pasting through a messaging app.

This spec adds **push/pull sync** between devices through a shared encrypted cloud store.

### What's in scope
- Syncing the `patients` and `dailyUpdates` Dexie stores between devices
- Encryption so the cloud store never sees plaintext patient data
- Version history (last 5 snapshots) so the user can recover from bad syncs
- Conflict resolution when both devices have unsaved changes

### What's NOT in scope
- Photos. The app has an existing photo system that stores images in Dexie with references embedded in patient profiles. Photos stay on-device. Sync does not touch them.
- Real-time or automatic sync. This is manual — the user taps a button.
- Multi-user. One clerk, two devices, same room code.

---

## Architecture

```
PWA (phone or laptop)
  → exports patients + dailyUpdates from Dexie as JSON
  → encrypts JSON with room code (AES-256-GCM, key derived via PBKDF2)
  → POST encrypted blob to Azure Function
    → Azure Function injects GitHub PAT
    → forwards to GitHub Gist API (creates/updates a secret Gist)
  → other device GETs via same Azure Function
  → decrypts with room code
  → replaces local Dexie data with remote snapshot
```

**Why Azure Function?** The PWA can't call the GitHub API directly because the Personal Access Token would be visible in client-side JavaScript. The Azure Function is a thin proxy — its only job is adding the `Authorization` header. It never sees plaintext patient data.

**Why GitHub Gist?** Free, has built-in version history (every update creates a git revision), no infrastructure to manage, and 1MB file size limit is fine for ~100KB of JSON. The clerk's Azure credits cover the Function App (effectively $0/month at this scale).

**Why not Azure Blob Storage?** It was the original plan, but Gist gives us version history for free, which matters when the scariest failure mode is "I synced the wrong direction and overwrote my good data."

---

## Data Flow

### What gets synced

The entire contents of two Dexie stores, as a single JSON object:

```
{
  version: 1,
  exportedAt: "<ISO datetime>",
  deviceTag: "a3f2b-Phone",
  patients: [ ...full patients array from Dexie... ],
  dailyUpdates: [ ...full dailyUpdates array from Dexie... ]
}
```

This is **full-state sync**. Every push uploads the complete database snapshot. Every pull downloads the complete snapshot and replaces local data. There is no per-record diffing or merging.

**Why full-state?** The entire DB for ~10 patients with daily updates is roughly 50-100KB of JSON. Delta sync (tracking per-record changes, merging) adds significant complexity for zero practical benefit at this payload size. Full-state also means the sync logic is simple enough to debug when something goes wrong at 6am during rounds.

### What does NOT sync

- Photos and photo references (existing photo system is untouched)
- App settings / preferences
- Anything outside the `patients` and `dailyUpdates` Dexie stores

---

## Encryption

All patient data is encrypted client-side before it leaves the device. The Azure Function and GitHub only ever see an opaque encrypted blob.

**Scheme**: AES-256-GCM with key derived from the room code via PBKDF2 (100,000 iterations, SHA-256). Random salt and IV per encryption, packed alongside the ciphertext.

**Room code**: A passphrase the user enters during sync setup. Same code on both devices. It is:
- The encryption/decryption key (via PBKDF2 derivation)
- The room identifier (via SHA-256 hash)
- Never sent to the server in any form

**Room hash**: SHA-256 hex digest of the room code. Used to identify which Gist belongs to which room. The first 5 characters become the **room tag** (e.g. `a3f2b`), which is a human-readable room identifier.

---

## Device Identity

Each device is identified by a **device tag**: `{roomTag}-{deviceName}`.

- `roomTag`: first 5 characters of SHA-256(roomCode). Identifies the room.
- `deviceName`: "Phone" or "Laptop" — user picks during setup.
- Example: `a3f2b-Phone`, `a3f2b-Laptop`

The device tag is embedded in:
- The sync payload (so you know which device pushed a given snapshot)
- The Gist description (so you can check who last pushed without downloading the blob)
- The version history list (so the conflict UI shows "Phone pushed at 10:30am")

---

## Gist Structure

One **secret** Gist per room. Contains one file:

| File | Content | Encrypted? |
|---|---|---|
| `data.enc` | The full encrypted sync payload (base64 string) | Yes |

The Gist's **description** field contains unencrypted metadata (no patient data):

```json
{
  "roomTag": "a3f2b",
  "lastPushedAt": "2026-02-27T10:30:00Z",
  "lastPushedBy": "a3f2b-Phone",
  "blobSizeBytes": 48230
}
```

This lets a device check "is there new data?" with a cheap metadata fetch, without downloading and decrypting the full blob.

**Version history**: Every Gist update (PATCH) creates a new git revision. The Gist API exposes these via `GET /gists/{id}/commits`. We use the last 5 revisions for conflict resolution.

---

## Azure Function Endpoints

Five thin proxy endpoints. Each just adds the GitHub PAT header and forwards to the Gist API.

### `POST /api/sync/push`

**Purpose**: Create a new Gist (first sync) or update an existing one (subsequent syncs).

**Input**:
```json
{
  "gistId": "abc123...",       // null on first push
  "description": "{...json...}", // GistDescription as string
  "blob": "base64..."          // encrypted payload
}
```

**Behavior**:
- If `gistId` is null → `POST /gists` (create new secret Gist with `data.enc` file)
- If `gistId` is present → `PATCH /gists/{id}` (update file content + description, creating new revision)

**Returns**: `{ "gistId": "abc123..." }`

### `GET /api/sync/check?gistId={id}`

**Purpose**: Fetch Gist metadata only (description + updatedAt). No blob download. Used to determine if remote has new data.

**Returns**: `{ "description": "{...json...}", "updatedAt": "..." }`

### `GET /api/sync/pull?gistId={id}&sha={sha?}`

**Purpose**: Download the encrypted blob. If `sha` is provided, fetches that specific revision. Otherwise fetches the latest.

**Returns**: `{ "blob": "base64..." }`

**Note**: Must handle Gist API's `truncated` flag — if the file content is truncated (>1MB), follow up with a fetch to `raw_url`.

### `GET /api/sync/versions?gistId={id}&count=5`

**Purpose**: List the last N Gist revisions. For each, return the commit SHA, timestamp, and metadata from the description.

**Returns**: Array of version objects:
```json
[
  {
    "sha": "abc123...",
    "pushedAt": "2026-02-27T10:30:00Z",
    "deviceTag": "a3f2b-Phone",
    "sizeBytes": 48230
  }
]
```

**Implementation note**: The Gist commits endpoint (`GET /gists/{id}/commits`) returns commit SHAs and timestamps. To get the description (which holds our metadata), each revision must be fetched individually (`GET /gists/{id}/{sha}`). This means N+1 API calls for N versions. At 5 versions that's 6 GitHub API calls — adds ~3-4s latency but is well within rate limits.

### `GET /api/sync/find?roomTag={tag}`

**Purpose**: Find the Gist ID for a given room. Used when the second device sets up sync — it knows the room code (and therefore the roomTag) but doesn't know the gistId yet.

**Behavior**: Lists the authenticated user's gists (`GET /gists?per_page=100`), searches for one whose description JSON contains the matching `roomTag`.

**Returns**: `{ "gistId": "abc123..." }` or 404 if not found.

---

## Sync Flow

### Setup (one-time per device)

1. User goes to Settings → Sync → "Set Up"
2. Enters room code (same on both devices)
3. Picks device name: "Phone" or "Laptop"
4. App computes roomHash, roomTag, deviceTag
5. App saves SyncConfig to localStorage
6. App triggers first sync

**First device**: `syncNow()` sees no gistId → pushes → creates Gist → saves gistId.

**Second device**: `syncNow()` sees no gistId → calls `/api/sync/find` with roomTag → gets gistId → pulls remote data → imports → saves gistId.

**The user only types the room code. Everything else is automatic.**

### Regular Sync (user taps sync button)

```
1. CHECK: Fetch remote metadata (cheap, no blob)
   ├── Remote doesn't exist? → Push local. Done.
   ├── Remote last pushed by THIS device? → Push local (we're latest). Done.
   └── Remote last pushed by ANOTHER device?
       ├── Remote is newer than our lastSyncedAt?
       │   ├── Local has NO changes since lastSyncedAt?
       │   │   → Pull remote. Overwrite local. Push. Done.
       │   └── Local HAS changes since lastSyncedAt?
       │       → CONFLICT. Show version picker. Wait for user.
       └── Remote is same age or older?
           → Push local. Done.
```

### Conflict Resolution

When both devices have changes since last sync, the user sees a **version picker** showing up to 5 recent versions plus their current local state.

Each version displays:
- Device tag (e.g. "a3f2b-Phone")
- Timestamp (e.g. "Today 10:30 AM")
- File size (e.g. "47.2 KB")

The user picks one. The chosen version replaces ALL local data (if a remote version is chosen) or overwrites remote (if "keep current" is chosen). This is whole-database replacement — there is no per-record merge.

**Why no merge?** Per-record merge requires 3-way comparison with a common ancestor, and the failure mode is silently blending two editing sessions into an inconsistent record. For medical notes, "pick one and lose the other" is safer than "maybe-correct automatic merge." The version history (5 snapshots) means the user can always go back if they pick wrong.

---

## Sync UI

### Sync Button

Always visible in the app header/nav. Small icon with status indicator.

| State | What the user sees | Tap behavior |
|---|---|---|
| Not configured | Cloud with slash icon | Opens sync setup |
| Idle | Cloud icon + "Last: 5m ago" | Triggers sync |
| Syncing | Spinning indicator | Disabled |
| Success | Green check (fades after 3s) | Shows details |
| Conflict | Amber warning icon | Opens version picker |
| Error | Red X icon | Shows error + retry |

### Sync Setup Dialog

Fields:
- Room code (password input with show/hide toggle)
- Device name (radio: Phone / Laptop)
- Display: computed device tag (e.g. "a3f2b-Phone")

### Version Picker (Conflict Modal)

Shown when sync detects a conflict. Modal that blocks interaction.

List items:
- **"Keep current (a3f2b-Laptop)"** — always first, keeps local data
- Then up to 5 remote versions, newest first, each showing deviceTag + timestamp + size

Selecting a remote version shows a confirmation: "This will replace all data on this device. The version you're replacing can be found in the version history."

Action buttons: Cancel, Use Selected.

---

## Required Changes to Existing App

### Add `lastModified` to Patient interface

The conflict detection needs to know if local data changed since last sync. `DailyUpdate` already has `lastUpdated`. `Patient` needs a `lastModified` field.

Every operation that saves or edits a patient must set `lastModified` to the current ISO datetime.

### SyncConfig in localStorage

New localStorage key storing: roomCode, roomHash, roomTag, deviceName, deviceTag, gistId, lastSyncedAt, syncEndpoint.

### No changes to existing Dexie schema

The sync exports whatever is in `patients` and `dailyUpdates`. It doesn't add new stores or indexes. The photo system is untouched.

### New UI components

- SyncButton (header/nav)
- SyncSetup (dialog/modal)
- VersionPicker (conflict resolution modal)
- Sync status/history display in Settings page

---

## Azure Setup Requirements

The developer (you) needs to set up before the coding AI builds the app-side sync:

1. **GitHub PAT** (fine-grained) with Gist read/write permission only
2. **Azure Function App** (Node.js 20, consumption plan, southeastasia region)
3. **CORS** configured for the PWA's GitHub Pages domain + localhost
4. **GitHub PAT** stored as an Azure Function app setting (`GITHUB_TOKEN`)
5. Five functions deployed: push, check, pull, versions, find

The functions are simple HTTP proxies — no npm dependencies beyond the Azure Functions runtime. Total code across all five is roughly 200 lines.

**Monthly cost**: $0. Azure consumption plan gives 1M free executions/month. At ~10 syncs/day you'll use about 0.1% of that. GitHub Gists are free.

---

## Security Notes

**Protected**: All patient data is AES-256-GCM encrypted before leaving the device. The Azure Function and GitHub see only opaque blobs. The room code never leaves the browser.

**Unprotected**: The Gist description contains timestamps, device tags, and blob sizes — no patient data, but an observer could see that sync activity exists.

**Risk**: If someone guesses the room code, they can decrypt the data. For a personal tool used by one person, a reasonable passphrase is sufficient. The Gist is secret (not listed publicly) and requires the GitHub PAT to access.

**Token rotation**: The GitHub PAT should be set to expire (90 days matches a rotation). Set a calendar reminder to regenerate and update the Azure app setting.

**Data retention**: Consider setting the Gist to be deleted at the end of the rotation, or periodically rotating to a new Gist. Patient data should not persist in the cloud indefinitely.

---
