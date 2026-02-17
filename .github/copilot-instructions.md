# Copilot Instructions

## Project Overview

**RoundingApp** — A personal Progressive Web App (PWA) for medical clerks doing hospital rounds at University of Santo Tomas Hospital. This is a **single-user, offline-first** note-taking tool that replaces Google Sheets for tracking ~10 active patients during a 2-month rotation.

**Core goal:** Make it faster to take patient notes on a phone and generate copy-paste-ready text for sharing via messaging apps (Viber/WhatsApp) to a laptop for Google Docs.

**Not:** A shared EHR, team tool, or full EMR. This is a personal clerk's notebook.

---

## Design Principles

1. **Offline-first, no backend:** All data in IndexedDB (via Dexie.js). No server, no auth, no sync.
2. **PWA = works on phone AND laptop:** Same URL in Chrome on Android and desktop. Can install to home screen.
3. **MVP simplicity:** If a feature doesn't directly speed up note-taking or text generation, defer it.
4. **Better than Google Sheets on a phone, not a full EMR.**

---

## Tech Stack

- **React 19 + TypeScript** + Vite + vite-plugin-pwa
- **Dexie.js v4+** for IndexedDB (stores: `patients`, `dailyUpdates`)
- **React Hook Form + Zod** for forms
- **Tailwind CSS** for styling
- **Web Share API** + clipboard fallback for text sharing

---

## Medical Context & Terms

### Patient Workflow
1. **Admit patient:** Enter demographics (room, name, age, sex) → add service → add diagnosis and clinical details in Profile tab
2. **Daily rounds:** Enter FRICHMOND notes, vitals, meds, labs
3. **Generate text:** Tap button to get formatted census entry or daily summary
4. **Copy/share:** Paste into chat → send to laptop → paste into Google Docs

### FRICHMOND Mnemonic
Standard medical daily progress note format used in Philippine medical schools:
- **F**eeling (subjective complaints)
- **R**eview of systems
- **I**ntake/output
- **C**ardiovascular exam
- **H**eart/chest exam
- **M**ental status
- **O**ther findings
- **N**eeds/new orders
- **D**isposition/plan

### Key Data
- **Demographics:** Room number, name, age, sex, service (e.g., Internal Medicine, Surgery)
- **Admitting diagnosis:** Chief complaint / reason for admission
- **Working diagnosis:** Current diagnosis after workup
- **Clinical details:** Freeform text fields (admitting diagnosis, working diagnosis, pertinent history, physical exam findings, doctor's orders, medications, etc.)
- **Daily updates:** FRICHMOND notes, vitals, meds given, labs, management plan
- **Vitals:** Temperature, blood pressure, heart rate, respiratory rate, O2 saturation
- **Labs:** CBC, electrolytes, liver/kidney function, etc. with trend comparison

---

## Implementation Rules

### Version Bumping (Required)
For every user-visible or behavior-changing update:
1. Bump `package.json` version in the same task.
2. Verify footer displays new version after build/run.
3. Mention the new version in final response.

### Code Quality
- Prefer focused, minimal edits. Keep style consistent.
- Implement only requested features; avoid adding extra screens/components.
- Use TypeScript strictly (no `any` unless absolutely necessary).
- Keep Dexie schema simple unless explicitly asked to add structure.

### Data Constraints
- **No backward compatibility required yet:** No real patient data exists. Schema, UI, and text formats can change freely.
- **Privacy-first:** All data stays on device. No telemetry, no analytics, no external calls (except optional Web Share API).

---

## Current State (v0.6.8)

- ✅ MVP foundation: Patient add/edit, list with search/filter/sort, Profile tab, Daily Update tab
- ✅ FRICHMOND note-taking with autosave
- ✅ Structured data entry: Vitals, medications, labs (with trends), doctor's orders
- ✅ Text generation: Census entry, daily summary, profile copy/share
- ✅ Settings: Backup export/import (JSON), clear discharged patients, built-in usage guide
- ✅ Demo data: Sample patient "Juan Dela Cruz" auto-initialized on first launch

---

## When Making Changes

- Start simple, iterate based on real usage feedback
- Test on mobile viewport (360px width minimum)
- Verify offline behavior (disable network in DevTools)
- Check that generated text is readable and copy-paste-ready
- Always update the in-app Settings "How to use" section when workflow, field order, labels, or user-visible behavior changes.
- Keep README accurate for setup/deployment instructions
- do not try to build
