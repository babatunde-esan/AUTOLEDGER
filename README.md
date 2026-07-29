# AutoLedger — Vercel Deployment Guide

## What this is
A React app for tracking salvage vehicle purchases, repairs, expenses, and profitability. Built with Vite + React, no backend required.

---

## Deploy to Vercel (5 steps)

### Step 1 — Install Node.js
Download and install Node.js from https://nodejs.org (LTS version).

### Step 2 — Create a GitHub repository
1. Go to https://github.com and sign in (or create a free account)
2. Click **New repository**
3. Name it `autoledger`, set it to Private, click **Create repository**

### Step 3 — Upload the project files
Option A — GitHub Desktop (easiest):
1. Download GitHub Desktop from https://desktop.github.com
2. File → Add Local Repository → select this folder
3. Commit all files → Push to origin

Option B — command line:
```bash
cd autoledger-vercel
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/autoledger.git
git push -u origin main
```

### Step 4 — Connect to Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New Project**
3. Import your `autoledger` repository
4. Vercel auto-detects Vite — no settings to change
5. Click **Deploy**

### Step 5 — Done
Vercel gives you a live URL like `https://autoledger-abc123.vercel.app`

Every time you push changes to GitHub, Vercel redeploys automatically.

---

## Run locally (optional)
```bash
cd autoledger-vercel
npm install
npm run dev
```
Opens at http://localhost:5173

---

## Important note on data persistence
Currently, vehicle data is stored in browser memory only and resets on page refresh. This is fine for testing.

For permanent data storage across sessions and devices, the next step would be adding a database (Supabase is free and works well with Vercel). Let Claude know when you're ready for that upgrade.

---

## Project structure
```
autoledger-vercel/
├── index.html          ← App shell
├── vite.config.js      ← Build config
├── package.json        ← Dependencies
├── public/
│   └── favicon.svg     ← App icon
└── src/
    ├── main.jsx        ← React entry point
    └── AutoLedger.jsx  ← Full application
```
