# Portable Unofficial Health Record - Really (PUHRR)
A simple app for an electronic health record for doing hospital rounds and patient history for medical clerks to use on their phones primarily offline.

Patient tabs now separate key workflows into **Profile, FRICHMOND, Vitals, Labs, Medications, Orders, and Photos** for faster focused updates.
In the **Orders** tab, use **Edit** on an entry to update its status or remove it from the same edit controls.

## Photo attachments (MVP)

- Photos can be attached per patient and organized by section category (Profile, FRICHMOND, Vitals, Medications, Labs, Orders).
- In mobile workflow, use **Take photo** for direct camera capture or **Choose existing** to pick from gallery.
- Photo title is prefilled automatically as `Category + date/time` for quick unique naming and can still be edited.
- The app stores compressed photo copies in IndexedDB for offline viewing.
- Current JSON backup/export is text-data only and excludes photo attachments.
- Deleting a photo inside the app removes only the app copy and does not delete the original phone gallery file.

## Dexie schema compatibility note

- Version `1.0.0` resets local app data to a clean-slate schema baseline.
- The app now initializes a fresh IndexedDB database (`roundingAppDatabase_v1`) with only actively used stores.
- Legacy stores and migration chains from pre-1.0 prototypes are intentionally dropped for new installs.

## Run locally

### 1) Install prerequisites
- Node.js 20+ (LTS recommended)
- npm (comes with Node.js)

### 2) Install dependencies
```bash
npm install
```

### 3) Start development server
```bash
npm run dev
```
Vite will print a local URL (usually `http://localhost:5173`).

## Host it yourself

### Option A: Local production preview
Build and serve the production bundle on your machine:
```bash
npm run build
npm run preview
```
Preview usually runs at `http://localhost:4173`.

### Option B: Static hosting
After `npm run build`, deploy the generated `dist/` folder to any static host (for example: Netlify, GitHub Pages, Cloudflare Pages, Vercel static output).

### Option C: GitHub Pages (automated with GitHub Actions)
This repository includes `.github/workflows/deploy-pages.yml` to automatically deploy on pushes to `main`.

Before it works, enable GitHub Pages in repository settings:
1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).

What to know:
- The app now uses relative asset paths so the same build works on GitHub Pages and other static hosts.
- The deployment URL appears in the workflow run after the `deploy` job finishes.

## Test/validate directly

There is currently no dedicated automated test suite yet. Use the current checks:
```bash
npm run lint
npm run build
```

Then do a quick manual check:
1. Open the app in browser.
2. Confirm the page loads with the title **Portable Unofficial Health Record - Really (PUHRR)**.
3. Confirm text output actions open a large popup where you can select partial text or tap **Copy full text**.
4. Confirm no errors in browser console.
5. (Optional PWA check) Install app from browser menu and verify it opens in standalone mode.
