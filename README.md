# PortableEletronicHealthRecord
A simple app for an electronic health record for doing hospital rounds and patient history for medical clerks to use on their phones primarily offline.

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

## Test/validate directly

There is currently no dedicated automated test suite yet. Use the current checks:
```bash
npm run lint
npm run build
```

Then do a quick manual check:
1. Open the app in browser.
2. Confirm the page loads with the title **Portable Electronic Health Record**.
3. Confirm no errors in browser console.
4. (Optional PWA check) Install app from browser menu and verify it opens in standalone mode.
