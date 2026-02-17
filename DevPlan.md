# RoundingApp — Development Plan (Simplified)

## What This App Is

A personal patient tracking tool for a medical clerk doing hospital rounds. Built as a **Progressive Web App (PWA)** — works on Android phone AND laptop via the same URL. It replaces the pain of using Google Sheets on a phone by organizing patient records and generating copy-paste-ready text.

**Not** a shared EHR. **Not** a team tool. This is a personal note-taking app that makes rounding faster.

**Design principle: better than Google Sheets on a phone, not a full EMR.** If a feature doesn't directly make note-taking or text generation faster, it waits.

## Release Hygiene (Required Every Change)

For any user-visible or behavior-changing update:
- Bump `package.json` version in the same task.
- Ensure footer version reflects the new version after build/run.
- Include the new version in the task handoff summary.

---

## Current Progress (as of 2026-02-17)

- ⚠️ Development note: backward compatibility is not required at this stage. No real patient records exist yet, so schema, UI flows, and generated text formats can be changed freely while iterating.
- ✅ Keep this as `DevPlan.md` (no `agent.md` file is needed for this project plan).
- ✅ MVP foundation implemented: React + TypeScript + Vite PWA setup, Dexie DB with `patients` + `dailyUpdates`, patient add/edit form, and patient list/selection panel.
- ✅ In-app behavior: profile tab with editable freeform fields, daily update tab with FRICHMOND text areas with manual save plus debounced auto-save, clipboard text generation for census entry, daily summary, and full census copy.
- ✅ Phase 1 backlog completed in-app: list search/filter/sort controls, settings backup export/import UI, clear discharged patients action, and optional Web Share integration (clipboard fallback retained).
- ✅ Phase 2 continued: doctor's orders tracking is implemented in Profile with status tracking (active/carried out/discontinued).
- ✅ Phase 2 continued: medication dose logging is implemented in Profile and can be included in daily summary output.
- ✅ Phase 2 started: structured vitals store + quick-entry UI is implemented as an optional enhancement in Daily Update.
- ✅ Phase 2 continued: structured medications store + quick-entry UI is implemented as an optional enhancement in Profile.
- ✅ Phase 2 continued: structured labs store + quick-entry UI with per-test trend comparison is implemented in Profile and included in census output.
- ✅ Profile workflow completed: "Copy Profile as Text" is implemented in the Profile tab for quick copy-paste handoff output.
- ✅ Profile workflow improved: "Share Profile as Text" is implemented with Web Share API and clipboard fallback.
- ✅ Usability/docs in-app: Settings includes a built-in "How to use" guide covering workflows, app sections, save behavior, and persistence/backup notes.
- ✅ UX simplification: Create patient form streamlined to core demographics only (room, name, age, sex, service); diagnosis and clinical details moved to Profile tab for data entry after admission.
- ✅ Demo/showcase support: Sample patient "Juan Dela Cruz" with complete clinical data is automatically initialized on first app load for quick demonstration purposes (one-time only).

---

## Who Uses It

One medical clerk at University of Santo Tomas Hospital. ~10 active patients at a time. Up to 100 patients total over a 2-month rotation. Data is entered manually. Output is copy-paste text shared via messaging apps (Viber/WhatsApp) to a laptop for Google Docs.

---

## Core Workflow

1. Admit patient → enter basic demographics (room, name, age, sex, service) → open profile to add diagnosis, plans, and clinical details
2. Daily rounds → jot FRICHMOND notes, vitals, meds, labs as freeform text
3. Generate text → tap a button to get formatted census entry or daily summary
4. Copy/share → paste into chat to send to laptop → paste into Google Docs

---

## Why PWA

A PWA **is** a webapp. Same codebase runs in Chrome on your phone and your laptop. You can "install" it to the home screen on Android for an app-like feel, or just bookmark the URL on your laptop. No app store, no native toolchain, works offline after first load.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **React 19 + TypeScript** | Best AI code generation support |
| Build tool | **Vite + vite-plugin-pwa** | Fast dev, automatic service worker for offline |
| UI components | **shadcn/ui** (Tailwind + Radix) | Copied into code, no CDN needed, works offline |
| Forms | **React Hook Form + Zod** | Handles many fields without lag |
| Local storage | **Dexie.js v4+** (IndexedDB wrapper) | Simple API, reactive queries, offline-native |
| Clipboard | `navigator.clipboard.writeText()` | Works in Android Chrome PWAs |
| Sharing | **Web Share API** | Opens native Android share sheet |

**No backend. No server. No authentication. All data lives in IndexedDB on the device.**

On first launch, call `navigator.storage.persist()` to prevent Chrome from auto-evicting data.

---

## Data Model (Dexie.js Stores)

**MVP: 2 stores.** Start simple. Add structure only when freeform text becomes painful.

```javascript
db.version(1).stores({
  patients:     '++id, lastName, roomNumber, service, status, admitDate',
  dailyUpdates: '++id, patientId, date, [patientId+date]'
});
```

### patients

The admission profile. Core demographics + large freeform text fields for clinical data.

```typescript
interface Patient {
  id?: number;
  // Demographics (quick-entry fields)
  roomNumber: string;        // "202A"
  lastName: string;
  firstName: string;
  middleName?: string;
  age: number;
  sex: 'M' | 'F';
  admitDate: string;         // ISO date
  service: string;           // "Surgery", "IM-GI", "IM-CV", etc.
  attendingPhysician: string;
  // Clinical data — all freeform text
  diagnosis: string;         // Working diagnosis
  chiefComplaint: string;
  hpiText: string;           // History of Present Illness
  pmhText: string;           // Past Medical History
  peText: string;            // Physical Examination
  plans: string;             // Current plans
  medications: string;       // Current meds as freeform text (e.g., "Tramadol 50mg IV Q8\nPLRS 120cc/hr")
  labs: string;              // Latest labs as freeform text (e.g., "2/14: WBC 12.5, Hgb 14.1, Plt 250")
  pendings: string;          // Pending orders/tasks
  clerkNotes: string;        // Personal scratchpad
  // Meta
  status: 'active' | 'discharged';
  dischargeDate?: string;
}
```

**Why freeform text for meds and labs?** Because the original plan had 5 extra stores and complex interfaces for structured meds/labs/vitals/orders/doses. That's a mini-EMR. You're a clerk taking notes — you already know the format. Type "Tramadol 50mg IV Q8" into a text field and move on. If you later want structured lab comparison with deltas, that's a Phase 2 add-on.

### dailyUpdates (FRICHMOND)

One document per patient per day. This is your daily rounding note.

```typescript
interface DailyUpdate {
  id?: number;
  patientId: number;
  date: string;              // ISO date (YYYY-MM-DD)
  // FRICHMOND categories — each is freeform text
  fluid: string;
  respiratory: string;
  infectious: string;
  cardio: string;
  hema: string;
  metabolic: string;
  output: string;
  neuro: string;
  drugs: string;
  other: string;
  // Summary
  vitals: string;            // Freeform vitals text (e.g., "06:48 BP 130/100 HR 89 RR 15 T 36.5 O2 98% RA")
  assessment: string;
  plans: string;
  lastUpdated: string;       // ISO datetime
}
```

**Note on vitals:** The original plan had a separate `vitals` store with structured fields per timestamp. For MVP, just type vitals as text lines in the daily update. You're copying from a chart at the bedside — structured entry is slower than just typing "06:48 130/100 89 15 36.5 98% RA". If you later want a proper vitals table, add the store then.

---

## App Structure (Screens)

### 1. Patient List (Home Screen)

- Admission form at the top capturing room, name, age, sex, service, and working diagnosis in one shot.
- List supports search, status filtering (active/discharged/all), and sorting (room/name/admit date), with cards showing room/name, age/sex, service/status, diagnosis, and buttons to open detail, edit, or discharge/reactivate.
- Full census generator supports both copy-to-clipboard and Web Share (with clipboard fallback) for all active patients.

### 2. Patient Profile (2 Tabs)

#### Tab: Profile
- Freeform textareas for diagnosis, plans, medications, labs, pendings, and clerk notes pulled straight from the selected patient record.
- Structured medications quick-entry rows (name/dose/route/frequency/note/status) are stored per patient and can be toggled active/discontinued.
- The save button writes the current form back into Dexie and includes **"Copy Census Entry"**, **"Copy Profile as Text"**, and **"Share Profile as Text"** actions for quick handoff text.

#### Tab: Daily Update
- Date picker defaults to today and loads data via Dexie's `[patientId+date]` compound index so you can toggle between diary entries.
- FRICHMOND text areas for each category, plus vitals, assessment, and plan fields; manual save remains available and debounced auto-save persists edits during typing.
- Structured vitals quick-entry rows (time/BP/HR/RR/temp/SpO2/note) are stored separately per patient+date and listed in-app for fast bedside capture.
- **"Copy Daily Summary"** and **"Share Daily Summary"** buttons render the formatted text block from current values.

### 3. Settings
- Implemented as an in-app settings view with:
   - JSON backup export (download file)
   - JSON import (restore from file)
   - Clear discharged patients

---

## Text Generators (Copy-Paste Output)

These are the killer feature. Each generates plain text for pasting.

### Census Entry (per patient)

```
208A REYES, Floran Dave R. 37/M
Acute Pancreatitis
Labs: (2/14/26) WBC 12.5, Hgb 14.1, Plt 250, Na 139, K 3.46, Crea 1.01, Lipase 450
Meds: Tramadol 50mg/IV Q8 RTC, PLRS 120cc/hr
Pendings: WAB CT scan with pancreatic protocol
```

Logic: Pull from `patient.roomNumber`, name, age/sex, `patient.diagnosis`, `patient.labs`, `patient.medications`, `patient.pendings`. Since labs and meds are freeform text, just insert them directly.

### Daily Summary (per patient)

```
DAILY UPDATE — REYES (202A) — 02/16/26
Vitals: 06:48 BP 130/100 HR 89 RR 15 T 36.5 O2 98% RA
F: NPO, IVF PLRS 120cc/hr, I&O: 1200/800
R: RA, no distress
I: Afebrile, no antibiotics
C: BP stable 120-130/80-90, NSR
H: No issues
M: Na 139 K 3.46 Crea 1.01
O: UO adequate, no drains
N: GCS 15, no deficits
D: Tramadol 50mg/IV Q8
Assessment: Improving, pain controlled
Plan: Resume oral diet if lipase trending down; repeat lipase tomorrow
```

Logic: Pull from the day's `DailyUpdate` record. Each FRICHMOND field maps to a line. Skip empty fields.

### Full Census (all active patients)

Concatenate all active patients' census entries, separated by blank lines. One tap, copy all.

---

## Build Plan

### Phase 1 — Ship It (~1–2 sessions)

**Goal**: Confirm the current single-page flow matches the DevPlan states so the BP-level copy generator is reliable on both phone and laptop.

Tasks:
1. **Scaffold and storage** (Done)
   - Vite + React + TypeScript + vite-plugin-pwa
   - Dexie with `patients` and `dailyUpdates` stores plus `navigator.storage.persist()`
   - Responsive CSS that works on phone and laptop

2. **Patient list + admission form** (Done)
   - Top entry form for room/name/age/sex/service/diagnosis
   - List active patients sorted by room with buttons to open detail, edit, and discharge
   - Full census generator button copying concatenated text

3. **Patient profile tab** (Done)
   - Saveable freeform text areas for diagnosis, plans, meds, labs, pendings, notes
   - Copy census text, copy/share profile text, and share census output
   - Structured medications, labs, orders, and medication dose logging

4. **Daily update tab** (Done)
   - Date picker that loads per-day FRICHMOND entries via `[patientId+date]`
   - Text areas for vitals and every FRICHMOND category with manual "Save" and "Copy daily summary" buttons
   - Auto-save/debounced save is implemented

5. **Deployment/installs** (Done)
   - App already runnable via `npm run dev` and deployable as a static site with a PWA manifest

6. **Outstanding Phase 1 work** (Completed)
   - ✅ Search/filter/sort controls for the patient list
   - ✅ UI for JSON backup/import and clearing discharged patients
   - ✅ Share API integration (beyond clipboard)
   - ✅ Debounced auto-save for daily updates

**Checkpoint**: Phase 1 flow is now complete and usable for day-to-day clerk notes; future work can focus on Phase 2 structured-data enhancements only when freeform text becomes limiting.

### Phase 2 — Nice-to-Haves (add when you feel the pain)

These are all the features from the original plan. Add them **one at a time** when freeform text stops being good enough:

- ✅ **Structured labs with comparison** — implemented with per-test comparison indicators (↑↓→)
- ✅ **Doctor's orders tracking** — implemented with order status tracking (active/carried out/discontinued)
- ✅ **Medication dose logging** — implemented for structured medications with per-dose date/time entries

**Rule of thumb**: If you find yourself doing the same reformatting of freeform text repeatedly, that's when to add structure.

---

## How to Use AI Agent Sessions (Copilot / Cursor / Claude)

The simplified plan means fewer sessions. Keep this file in the project root for context.

**Session 1 — Scaffold + Patient List:**
```
"Set up this project as a React + TypeScript + Vite PWA. Read DevPlan.md
for the full tech stack and data model. Install all dependencies, configure
vite-plugin-pwa, set up Tailwind and shadcn/ui. Create the Dexie database with
2 stores (patients, dailyUpdates). Build the Patient List page with sort, search,
add patient form, and discharge toggle. Make it responsive for phone and laptop."
```

**Session 2 — Patient Profile + Text Generators:**
```
"Build the Patient Profile view with 2 tabs: Profile and Daily Update. Read
DevPlan.md for the interfaces and text output formats. Profile tab
shows all patient data with edit toggle. Daily Update tab has FRICHMOND textareas
with auto-save. Add 'Copy Census Entry', 'Copy Profile as Text', and 'Copy Daily
Summary' buttons. Add 'Generate All Census' to the patient list page."
```

**Session 3 (optional) — Backup + Polish:**
```
"Add JSON backup export/import. Add loading states, empty states, error toasts.
Make sure all touch targets are 44px minimum. Test on mobile viewport."
```

### Tips
1. Always reference the dev plan in your prompt
2. Test on phone after each session
3. Commit after each session: `git add . && git commit -m "description"`
4. If something breaks: `git checkout .` and re-prompt with more specific instructions

---

## File Structure

```
rounding-app/
├── DevPlan.md
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── public/
│   └── manifest.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── db.ts                     # Dexie schema (2 stores)
│   ├── types.ts                  # Patient, DailyUpdate interfaces
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── PatientList.tsx
│   │   ├── PatientForm.tsx
│   │   ├── PatientProfile.tsx
│   │   ├── ProfileTab.tsx
│   │   ├── DailyUpdateTab.tsx
│   │   └── SettingsPage.tsx
│   ├── generators/
│   │   ├── census.ts
│   │   └── dailySummary.ts
│   └── lib/
│       └── utils.ts
```

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| PWA | Yes | Same URL works on phone + laptop, installable, offline-capable |
| Data model | Hybrid: freeform + targeted structured stores | Keep fast note flow while adding structure where repetitive formatting hurts |
| Vitals | Hybrid: freeform + structured quick entries | Preserve fast notes while enabling timestamped row capture |
| Labs | Hybrid: freeform + structured quick entries | Preserve quick notes while adding comparison-ready trends |
| Medications | Hybrid: freeform + structured quick entries | Keep old note flow while enabling cleaner med list tracking |
| Security | Deferred | Personal tool, phone/laptop already have lock screens |
| Multi-user sync | Not planned | Personal tool |
| Backend | None | All data in IndexedDB on the device |

---

## What Got Cut (and Why)

The original plan had 7 Dexie stores, 13 agent sessions, and a 12-weekend timeline. That's building a mini-EMR. Here's what was removed and the trigger to add it back:

| Cut Feature | Add Back When... |
|---|---|
| `orders` store (status tracking) | You need to track which orders are done vs pending |
| `medicationDoses` store (dose logging) | You need to know exactly when doses were given |
| `labResults` store (structured panels + deltas) | You want automatic lab comparison with arrows |
| Lab comparison text generator | You add the structured labs store |
| Vitals summary text generator | You add the structured vitals store |
| Medications list text generator | You add the structured medications store |

---

## Glossary

| Term | Meaning |
|---|---|
| Census | A patient list showing room, name, diagnosis, labs, meds, pendings |
| FRICHMOND | Daily update categories: Fluid, Respiratory, Infectious, Cardio, Hema, Metabolic, Output, Neuro, Drugs |
| WhiteNotes | The admission document format |
| q4hr | Every 4 hours (vital sign frequency) |
| PTA | Prior to admission |
| HPI | History of Present Illness |
| PMH | Past Medical History |
| PE | Physical Examination |
| I&O | Intake and Output |
| IVF | Intravenous Fluid |
| NPO | Nothing by mouth |
| RTC | Around the clock |
| PRN | As needed |
| Service | Medical specialty team (e.g., IM-GI, Surgery, Pulmo) |
