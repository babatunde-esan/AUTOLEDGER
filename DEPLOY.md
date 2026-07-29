# AutoLedger Firebase Edition — Vercel Deployment Guide

## Architecture
- **Frontend:** React + Vite → deployed on Vercel
- **Database:** Firebase Firestore (vehicles & expenses)
- **File Storage:** Firebase Storage (receipts & PDFs)
- **AI Scanning:** Anthropic Claude API (built-in)

---

## Before you deploy — Firebase setup (5 minutes)

### 1. Enable Firestore
1. Go to https://console.firebase.google.com → your project **autoledger-eb37f**
2. Click **Firestore Database** in the left menu
3. Click **Create database** → choose **Start in test mode** → pick a region (us-central1) → **Done**

### 2. Enable Firebase Storage
1. Click **Storage** in the left menu
2. Click **Get started** → **Start in test mode** → **Done**

### 3. Update Storage CORS (so uploads work from your Vercel domain)
After deploying, if uploads fail, go to Firebase Console → Storage → Rules and replace with:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

---

## Deploy to Vercel (10 minutes)

### Step 1 — Install Node.js
https://nodejs.org → download LTS version

### Step 2 — Create GitHub repo
1. Go to https://github.com/new
2. Name: `autoledger`, set **Private**, click **Create repository**

### Step 3 — Push code
Open Terminal (Mac) or Command Prompt (Windows):
```bash
cd path/to/autoledger-vercel
npm install
git init
git add .
git commit -m "AutoLedger Firebase Edition"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/autoledger.git
git push -u origin main
```

### Step 4 — Deploy on Vercel
1. Go to https://vercel.com → Sign up with GitHub
2. Click **Add New Project** → Import `autoledger`
3. Framework: **Vite** (auto-detected)
4. Click **Deploy**

Your live URL: `https://autoledger-[hash].vercel.app`

---

## Updating the app
```bash
# Replace src/App.jsx with the new version, then:
git add .
git commit -m "Update"
git push
# Vercel auto-deploys in ~30 seconds
```

---

## Data persistence
✅ Vehicles → Firestore (permanent, real-time)
✅ Expenses → Firestore (stored inside each vehicle document)
✅ Receipts & PDFs → Firebase Storage (permanent download URLs)
✅ Works across all devices simultaneously

## Security (next step after launch)
Switch Firestore and Storage from "test mode" to proper rules once you're ready.
Claude can write the security rules for you.
