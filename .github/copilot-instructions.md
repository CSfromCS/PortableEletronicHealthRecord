# Copilot Instructions

## Project Overview

**PUHRR** (Portable Unofficial Health Record - Really) — A personal Progressive Web App (PWA) for medical clerks doing hospital rounds at University of Santo Tomas Hospital. This is a **single-user, offline-first** note-taking tool that replaces Google Sheets for tracking ~10 active patients during a 2-month rotation.

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

- **React 19 + TypeScript** + Vite 7 + vite-plugin-pwa
- **Dexie.js v4+** for IndexedDB (stores: `patients`, `dailyUpdates`, `vitals`, `medications`, `labs`, `orders`)
- **React Hook Form + Zod** for structured forms
- **Tailwind CSS v4** for all styling — configured via CSS `@theme` block in `src/index.css`
  - No `tailwind.config.js` — v4 uses CSS-only config
  - Custom color tokens available as utility classes (see Color Tokens section below)
- **shadcn/ui** for UI components — copy-paste system, NOT an npm package
  - Component files live in `src/components/ui/` — edit them freely
  - Install new components: `npx shadcn@latest add <component-name>`
- **Web Share API** + clipboard fallback for text sharing

---

## Color Tokens (Tailwind Classes)

These are the PUHRR brand colors — use them instead of arbitrary color values:

| Token | Class examples | Hex | Use for |
|---|---|---|---|
| `burnt-peach` | `bg-burnt-peach`, `text-burnt-peach` | #b85b43 | Primary brand color |
| `cherry-blossom` | `bg-cherry-blossom` | #f2d6d9 | Patient card backgrounds |
| `pale-oak` | `bg-pale-oak` | #f2e8dd | Main background, panels |
| `pale-oak-2` | `bg-pale-oak-2` | #eadaca | Section card backgrounds |
| `taupe` | `text-taupe`, `border-taupe` | #8c7468 | Secondary text, borders |
| `mauve-shadow` | `text-mauve-shadow` | #3f2c35 | Primary text |
| `action-primary` | `bg-action-primary` | #b85b43 | Primary buttons |
| `action-secondary` | `bg-action-secondary` | #6a5c59 | Secondary buttons |
| `action-edit` | `bg-action-edit` | #2f5f9b | Edit buttons |
| `action-danger` | `bg-action-danger` | #ad2e2e | Delete/danger buttons |

---

## Component Architecture

### shadcn/ui base components (`src/components/ui/`)
- `Button` — variants: `default` (burnt-peach), `secondary`, `destructive`, `edit` (custom blue), `outline`, `ghost`, `link`
- `Card`, `CardHeader`, `CardTitle`, `CardContent` — use for all panels and sections
- `Badge` — for status labels (active/discharged/medication status)
- `Input`, `Textarea`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
- `Label` — always pair with form inputs
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — for tab navigation
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` — for modals
- `Alert`, `AlertDescription` — for status notices
- `ScrollArea` — for scrollable content in dialogs
- `Table`, `Tooltip` — for data tables and contextual hints

### Utility
- `cn()` from `@/lib/utils` — merge Tailwind classes conditionally

---

## Styling Rules for AI Code Generation

When generating new UI for this app, follow these rules:

1. **Use Tailwind utility classes** — do NOT write new CSS files or inline styles
2. **Use shadcn/ui components** from `@/components/ui/` for all interactive elements
3. **Use `cn()` from `@/lib/utils`** to merge classes conditionally
4. **Button variants:**
   - Primary actions → `<Button>` (default, burnt-peach)
   - Neutral/cancel → `<Button variant="secondary">`
   - Edit/update → `<Button variant="edit">`
   - Delete/danger → `<Button variant="destructive">`
5. **Card usage conventions:**
   - Patient cards → `<Card className="bg-cherry-blossom border-taupe">`
   - Detail panels → `<Card className="bg-pale-oak border-taupe">`
   - Section panels (vitals/meds/labs/orders) → `<Card className="bg-pale-oak-2 border-taupe">`
6. **Form fields:** Always use `<Label>` above `<Input>`, `<Textarea>`, or `<Select>`. Wrap in `<div className="space-y-1">`
7. **Lists:** Use `flex flex-col gap-2` for card lists, `space-y-1` for item lists within sections
8. **Modals:** Always use `<Dialog>` from shadcn/ui — never custom modal divs
9. **Tab navigation:** Always use `<Tabs>` from shadcn/ui
10. **Status text:** Always use `<Badge>` for patient/medication/order status strings

---

## Medical Context & Terms

### Patient Workflow
1. **Admit patient:** Enter demographics (room, name, age, sex) → add service → add diagnosis and clinical details in Profile tab
2. **Daily rounds:** Enter FRICHMOND notes, vitals, meds, labs
3. **Generate text:** Tap button to get formatted census entry or daily summary
4. **Copy/share:** Paste into chat → send to laptop → paste into Google Docs

### FRICHMOND Mnemonic
Standard medical daily progress note format used in Philippine medical schools:
- **F**luid/intake-output
- **R**espiratory exam
- **I**nfectious findings
- **C**ardiovascular exam
- **H**ema (hematology)
- **M**etabolic
- **O**utput
- **N**euro
- **D**rugs

### Key Data
- **Demographics:** Room number, name, age, sex, service (e.g., Internal Medicine, Surgery)
- **Admitting diagnosis:** Chief complaint / reason for admission
- **Working diagnosis:** Current diagnosis after workup
- **Clinical details:** Freeform text fields (plans, medications, labs, pendings, clerk notes)
- **Daily updates:** FRICHMOND notes, vitals, assessment, plan
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

## Codespace Preview Workflow

1. Run `npm run dev` in terminal — Vite starts on port 5173
2. Open the **Ports** panel (bottom VS Code bar) — port 5173 appears automatically
3. Set visibility to **Public** to test from phone during rounds
4. `Ctrl+Shift+P` → "Simple Browser: Show" → paste the forwarded URL for in-IDE preview
5. Install the **Tailwind CSS IntelliSense** extension (`bradlc.vscode-tailwindcss`) for autocomplete on `bg-burnt-peach`, `text-mauve-shadow`, etc.

---

## Current State (v0.7.27)

- ✅ MVP foundation: Patient add/edit, list with search/filter/sort, Profile tab, Vital Signs tab, Orders tab
- ✅ FRICHMOND note-taking with autosave
- ✅ Structured data entry: Vitals, medications, labs (with trends), doctor's orders
- ✅ Text generation: Census entry, daily summary, profile copy/share
- ✅ Settings: Backup export/import (JSON), clear discharged patients, built-in usage guide
- ✅ Demo data: Sample patient "Juan Dela Cruz" auto-initialized on first launch
- ✅ **Tailwind CSS v4 + shadcn/ui** — full UI migration complete
- ✅ All styling uses Tailwind utilities — `src/App.css` deleted

---

## When Making Changes

- Start simple, iterate based on real usage feedback
- Test on mobile viewport (360px width minimum)
- Verify offline behavior (disable network in DevTools)
- Check that generated text is readable and copy-paste-ready
- Always update the in-app Settings "How to use" section when workflow, field order, labels, or user-visible behavior changes.
- Keep README accurate for setup/deployment instructions
- do not try to build
