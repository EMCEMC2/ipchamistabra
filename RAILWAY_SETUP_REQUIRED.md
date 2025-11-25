# ⚠️ RAILWAY ENVIRONMENT VARIABLE REQUIRED

## Issue: Blank Page on Railway Deployment

**Status:** Application builds successfully but shows blank page
**Root Cause:** Missing `VITE_GEMINI_API_KEY` environment variable in Railway

---

## 🔧 Fix: Add Environment Variable in Railway Dashboard

### Step 1: Access Railway Project Settings
1. Go to https://railway.app
2. Select your project: **ipchamistabra-production**
3. Click on the **Variables** tab

### Step 2: Add Required Environment Variable

**Variable Name:**
```
VITE_GEMINI_API_KEY
```

**Variable Value:**
```
[Your Gemini API Key from Google AI Studio]
```

**Where to Get the API Key:**
- Visit: https://aistudio.google.com/app/apikey
- Create or copy your existing API key
- Paste it into Railway

### Step 3: Redeploy

After adding the environment variable:
1. Railway will automatically trigger a rebuild
2. Wait 2-3 minutes for deployment
3. Visit: https://ipchamistabra-production.up.railway.app/
4. Application should now load correctly

---

## ✅ Verification

Once deployed with the correct environment variable, you should see:

1. **Main Dashboard** loads with:
   - BTC Price ticker
   - Chart with technical indicators
   - Intel feed with news
   - AI command center
   - Active signals panel

2. **Console** shows (F12 → Console):
   ```
   Vite Config - API Key Status: Present (length: 39)
   ✅ Global Data Synced (REAL APIs)
   Chart Data Synced
   ```

3. **No errors** about missing API keys or blank responses

---

## 🔒 Security Note

**IMPORTANT:** The Gemini API key must be set as an environment variable in Railway dashboard, not committed to the repository.

The following files already protect against accidental commit:
- `.gitignore` includes `.env` and `.env*.local`
- `vite.config.ts` reads from `import.meta.env.VITE_GEMINI_API_KEY`
- No API keys are hardcoded in the codebase

---

## 🐛 Debugging Steps (If Still Blank)

If the page is still blank after adding the environment variable:

### 1. Check Browser Console (F12)
Look for specific error messages:
- API key issues: "API Key Status: MISSING"
- JavaScript errors: Red error messages
- Network errors: Failed fetch requests

### 2. Check Railway Build Logs
- Go to Railway project → Deployments tab
- Click latest deployment
- Look for build errors or warnings

### 3. Common Issues

**Issue A: API Key Not Recognized**
- **Symptom:** Console shows "API Key Status: MISSING"
- **Fix:** Ensure variable name is EXACTLY `VITE_GEMINI_API_KEY` (no typos)
- **Fix:** Redeploy after adding variable (Railway → Settings → Redeploy)

**Issue B: Build Warnings**
- **Symptom:** Docker warnings about secrets in Dockerfile
- **Status:** Cosmetic warning only, doesn't affect functionality
- **Action:** Can be ignored (Railway handles secrets securely)

**Issue C: Zod Validation Errors**
- **Symptom:** Console shows "Intel Validation Failed: ZodError"
- **Status:** FIXED in commit 97f480f
- **Action:** Ensure latest deployment is running (check commit hash)

---

## 📊 Expected Performance After Fix

Once the environment variable is set and deployed:

| Feature | Status |
|---------|--------|
| **Real-time Price Feed** | ✅ Active (Binance WebSocket) |
| **Chart Data** | ✅ Adaptive polling (5s-5m) |
| **AI Signals** | ✅ Tactical v2 + Gemini AI hybrid |
| **Intel Feed** | ✅ Real-time crypto news |
| **Order Flow** | ✅ CVD, liquidations, pressure |
| **Position Monitor** | ✅ Real-time P&L tracking |

---

## 🚀 Alternative: Local Testing

If you want to test locally before Railway deployment:

### 1. Create `.env` file in project root:
```bash
VITE_GEMINI_API_KEY=your_api_key_here
```

### 2. Run development server:
```bash
npm run dev
```

### 3. Or test production build:
```bash
npm run build
npm run preview
```

Visit http://localhost:8080 to verify everything works.

---

## 📝 Deployment Checklist

Before marking deployment as complete:

- [ ] Environment variable `VITE_GEMINI_API_KEY` added in Railway
- [ ] Railway deployment completed successfully
- [ ] Application loads (not blank page)
- [ ] Console shows "API Key Status: Present"
- [ ] Real-time price updates visible
- [ ] Chart displays with data
- [ ] Intel feed shows news items
- [ ] No JavaScript errors in console

---

## 🔗 Resources

- **Railway Dashboard:** https://railway.app/dashboard
- **Google AI Studio (API Keys):** https://aistudio.google.com/app/apikey
- **GitHub Repository:** https://github.com/EMCEMC2/ipchamistabra
- **Live URL:** https://ipchamistabra-production.up.railway.app/

---

## 💡 Why This Happens

Vite environment variables (`VITE_*`) are embedded at **build time**, not runtime. This means:

1. Railway builds the application using Nixpacks
2. During build, Vite looks for `VITE_GEMINI_API_KEY` environment variable
3. If not found, the key is undefined in the built JavaScript
4. Application tries to initialize Gemini AI client with undefined key
5. API calls fail silently or return errors
6. React components may fail to render properly

**Solution:** Set the environment variable BEFORE building, so Vite can embed it correctly.

---

**Created:** 2025-11-25
**Status:** Action Required
**Priority:** HIGH (Application not functional without this)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
