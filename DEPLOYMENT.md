# LaundryMax — Deployment Guide

This guide walks the **business owner** through deploying LaundryMax to production. Architecture: **MongoDB Atlas** (DB) + **FastAPI backend** + **React frontend**.

Estimated total cost on the recommended free tiers: **$0/month** for traffic up to ~10k requests/day.

---

## 1. Architecture Overview

```
┌────────────────────────┐      HTTPS       ┌─────────────────────────┐      ┌──────────────────┐
│  React Frontend        │ ───────────────▶ │  FastAPI Backend        │ ───▶ │  MongoDB Atlas   │
│  (Vercel)              │                  │  (Render / Railway)     │      │  (Free M0 tier)  │
│  REACT_APP_BACKEND_URL │                  │  exposes /api/*         │      │  cluster0...     │
└────────────────────────┘                  └─────────────────────────┘      └──────────────────┘
```

Image uploads (selfies, Proof-of-Delivery) currently land on the backend host's local disk under `backend/uploads/`. **For production, switch this to S3-compatible object storage** — see §6.

---

## 2. Prerequisites — Accounts You'll Need

| Service | Free Tier | What It's For |
|---|---|---|
| **MongoDB Atlas** | M0 cluster (512 MB) — free forever | Database |
| **Vercel** | Hobby plan — free | Frontend hosting |
| **Render** *(or Railway)* | Free web service — sleeps after 15min idle | Backend hosting |
| **Emergent Universal Key** | Comes with Emergent | Owner Google OAuth (already wired) |
| **Cloudflare R2** *(later)* | 10 GB free | Selfie + PoD photos (when you migrate from local disk) |

---

## 3. MongoDB Atlas — Setup the Database

1. Go to [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) and sign up.
2. Click **Build a Database** → choose **M0 Free**.
3. Pick a region close to your users (e.g. `Singapore` for Indonesia).
4. **Database User**: create a username/password (e.g. `laundrymax-app` / a strong password). Save these.
5. **Network Access**: add IP `0.0.0.0/0` (allow from anywhere — Render/Railway IPs are dynamic).
6. Click **Connect → Drivers** and copy the connection string. It looks like:
   ```
   mongodb+srv://laundrymax-app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. **Replace `<password>`** with your real password and append your DB name at the end:
   ```
   mongodb+srv://laundrymax-app:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/laundrymax?retryWrites=true&w=majority
   ```

This is your `MONGO_URL`.

---

## 4. Environment Variables — Reference

### 4.1 Backend (`backend/.env`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `MONGO_URL` | ✅ | `mongodb+srv://user:pwd@cluster0.xxx.mongodb.net/laundrymax` | From step 3.7 above. |
| `DB_NAME` | ✅ | `laundrymax` | The database name; must match what's at the end of `MONGO_URL`. |
| `CORS_ORIGINS` | ✅ | `https://laundrymax.vercel.app,https://www.laundrymax.id` | Comma-separated list of frontend origins allowed to call the API. **Do not use `*` in production.** |
| `OWNER_EMAILS` | ⚠️ recommended | `theomahrizal@gmail.com,owner2@gmail.com` | Comma-separated Gmail addresses allowed to log in as Owner/Superadmin via Google OAuth. Defaults to `theomahrizal@gmail.com` if unset. |
| `EMERGENT_LLM_KEY` | ➖ optional | `sk-emergent-xxx` | Only needed if you add LLM features later. Not used by current MVP. |

### 4.2 Frontend (`frontend/.env.production`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `REACT_APP_BACKEND_URL` | ✅ | `https://laundrymax-api.onrender.com` | The public URL of your deployed backend (no trailing slash, no `/api`). The frontend appends `/api/...` itself. |

> ⚠️ **Important — `REACT_APP_*` is baked at build time.** If you change it later, you must redeploy the frontend.

---

## 5. Backend Deployment — Render (recommended)

Render's free Python web service is the simplest path.

### 5.1 Push the repo to GitHub

In the Emergent platform, click the **"Save to GitHub"** button to export the repo to a GitHub account.

### 5.2 Create the web service

1. Go to [https://render.com](https://render.com) → **New → Web Service** → connect your GitHub repo.
2. **Settings**:
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free (or Starter $7/mo for no idle-sleep)
3. **Environment** tab → add the 4 backend env vars from §4.1 (`MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `OWNER_EMAILS`).
4. Click **Create Web Service**. Wait ~3 minutes for first deploy.
5. Note the public URL Render gives you, e.g. `https://laundrymax-api.onrender.com`. **Test it**:
   ```bash
   curl https://laundrymax-api.onrender.com/api/health
   # → {"status":"ok","mongo":"reachable"}
   ```

### 5.3 Seed the production DB (one-time)

The first time the API is up, populate the canonical demo data:

```bash
curl -X POST https://laundrymax-api.onrender.com/api/seed/all
```

This creates 6 staff (PIN `1234` for all — **change these in `routes/seed.py` before pushing to prod if you care about kiosk security**), 8 price rows, 5 customers, 4 B2B partners, and 35 demo orders.

### 5.4 Alternative — Railway

[https://railway.app](https://railway.app) — same flow, $5 free credit/month, no idle-sleep, slightly faster cold starts.
- Root: `backend` · Start: `uvicorn server:app --host 0.0.0.0 --port $PORT` · same env vars.

---

## 6. Frontend Deployment — Vercel (recommended)

### 6.1 Set the production backend URL

Create `frontend/.env.production` (do **not** commit secrets — Vercel reads env vars from its own dashboard, but this file documents the contract):

```bash
REACT_APP_BACKEND_URL=https://laundrymax-api.onrender.com
```

### 6.2 Deploy

1. Go to [https://vercel.com/new](https://vercel.com/new) → import the same GitHub repo.
2. **Settings**:
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `frontend`
   - **Build Command**: `yarn build` (auto-detected)
   - **Output Directory**: `build`
3. **Environment Variables** tab → add `REACT_APP_BACKEND_URL` from §4.2.
4. Click **Deploy**. ~90 seconds.
5. Vercel gives you `https://laundrymax.vercel.app` (or your custom domain).

### 6.3 Wire CORS

Go back to Render → backend → Environment → set `CORS_ORIGINS=https://laundrymax.vercel.app` (or your custom domain). Save → backend auto-restarts.

### 6.4 Wire Owner Google OAuth redirect

The Owner login uses **Emergent-managed Google OAuth**. After clicking *LOGIN DENGAN GOOGLE*, the user is redirected to:
```
https://auth.emergentagent.com/?redirect=<your-frontend-origin>/auth/callback
```
The frontend reads `window.location.origin`, so as long as you visit the deployed Vercel URL, the redirect works automatically. **No extra config needed** — that's the upside of using Emergent's managed integration.

---

## 7. Production Build Commands (for local testing or self-host)

### 7.1 Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
```

The `--workers 2` flag uses 2 worker processes, suitable for a free 512MB instance. Scale up to `4` once you upgrade.

### 7.2 Frontend

```bash
cd frontend
yarn install
yarn build
# → produces /build/ folder ready to upload to any static host
# (Vercel does this for you automatically)

# To self-host the build locally for smoke-testing:
npx serve -s build -p 3000
```

---

## 8. Post-Deploy Smoke Test (5-min checklist)

After both services are live, run through this checklist on a real device:

- [ ] Visit `https://laundrymax.vercel.app/absen` — Staff Kiosk loads, 6 staff cards visible.
- [ ] Click **Erfa** → enter PIN `1234` → ABSEN MASUK → modal completes → success toast.
- [ ] Visit `https://laundrymax.vercel.app/` — POS screen loads, prices fetched (Cuci Kiloan shows `Rp 7.000/kg · Reguler` for Walk-in).
- [ ] Switch **Durasi Pengerjaan** to **Flash** → kiloan rate updates to `Rp 10.000/kg`.
- [ ] Visit `https://laundrymax.vercel.app/admin` → click **LOGIN DENGAN GOOGLE** → Google flow → redirected back logged in.
- [ ] In `/admin` → **Pengaturan Harga** → 8 rows visible, edit one price, **SIMPAN** → toast success.
- [ ] Reload — your edit persisted.
- [ ] In `/dashboard` → 35 seeded orders show in the pipeline.

If all pass, you're live. 🎉

---

## 9. Known Limitations of the Free Tier

| Limitation | Workaround |
|---|---|
| **Render free dynos sleep after 15min idle** — first request after idle takes ~30s. | Upgrade to Starter ($7/mo) **OR** use [https://uptimerobot.com](https://uptimerobot.com) to ping `/api/health` every 5min (free). |
| **MongoDB Atlas M0 has 512 MB cap.** | At ~5KB/order, you have room for ~100k orders. Upgrade to M2 ($9/mo) when you near the cap. |
| **Selfies + PoD photos stored on backend's local disk** — these are wiped every Render redeploy. | Migrate to Cloudflare R2 (free 10GB) — see §10. |
| **Vercel free has 100GB bandwidth/month.** | Plenty. Only an issue at hundreds of thousands of pageviews/month. |

---

## 10. Recommended Next Steps After MVP Launch

1. **Migrate `/uploads` to Cloudflare R2** (free 10GB) so selfies + PoD photos survive redeploys.
   - Endpoints to update: `routes/staff_attendance.py` (selfie upload) and `routes/orders.py` (PoD upload).
2. **Add a custom domain** in Vercel (e.g. `pos.laundrymax.id`). Free with any registered domain.
3. **Enable Atlas backups** — toggle in Atlas dashboard. Free tier includes daily snapshots.
4. **Set up uptime monitoring** — UptimeRobot pinging `/api/health` every 5min keeps Render warm + alerts on outages.
5. **Rotate staff PINs** — edit `backend/routes/seed.py` `_DEFAULT_STAFF` before you ship to real outlets.

---

## 11. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Frontend loads but every API call returns 404 | `REACT_APP_BACKEND_URL` wrong or trailing slash | Should be `https://laundrymax-api.onrender.com` (no `/api`, no trailing `/`). Redeploy frontend after fix. |
| `Failed to fetch` / CORS errors in browser console | `CORS_ORIGINS` on backend doesn't include your Vercel URL | Edit Render env, save, wait ~30s for restart. |
| `/admin` login bounces to `/absen` | Your Gmail isn't in `OWNER_EMAILS` whitelist | Add your email to Render env `OWNER_EMAILS` (comma-separated), restart. |
| Render service crashes on boot | Missing `MONGO_URL` or wrong format | Check Render logs; verify Atlas connection string and that `<password>` was URL-encoded if it contains `@`, `:`, `/`. |
| Backend slow on first request | Render free dyno cold-starting | Normal — ~30s. Use UptimeRobot ping or upgrade plan. |
| Owner Google login screen says "akun tidak memiliki akses" | Email lowercased mismatch | `OWNER_EMAILS` is normalised to lowercase server-side. Make sure no typos. |

---

## 12. Files of Reference

| File | Role in Deployment |
|---|---|
| `backend/.env` | Local dev only — **never commit to GitHub**. Render reads env from its dashboard. |
| `backend/server.py` | App entry — already reads `CORS_ORIGINS` from env. |
| `backend/db.py` | MongoDB client — reads `MONGO_URL` + `DB_NAME` from env. |
| `backend/routes/auth.py` | Reads `OWNER_EMAILS` from env (defaults to single owner). |
| `backend/requirements.txt` | All Python deps. Render reads this on first deploy. |
| `frontend/.env` | Local dev — points to local backend. |
| `frontend/.env.production` | Optional — Vercel uses its own dashboard env vars instead. |
| `frontend/package.json` | Yarn deps + build script. |

---

**You're ready to ship. Good luck with LaundryMax v1.0! 🚀**
