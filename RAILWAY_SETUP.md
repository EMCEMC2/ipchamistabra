# Railway Environment Variable Setup

## Quick Fix - Set API Key in Railway Dashboard

### Method 1: Railway Web Dashboard (Easiest)
1. Go to: https://railway.app/dashboard
2. Select your project: **ipchamistabra-production**
3. Click **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Variable Name:** `VITE_GEMINI_API_KEY`
   - **Variable Value:** `AIzaSyC8prxBzZ6-rwUQ_M5GKGpnFpvOAZsOWWc`
6. Click **Add** - Railway will auto-redeploy

### Method 2: Install Railway CLI (One-time setup)
```powershell
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Set the environment variable
railway variables set VITE_GEMINI_API_KEY=AIzaSyC8prxBzZ6-rwUQ_M5GKGpnFpvOAZsOWWc

# Verify
railway variables
```

## Why This is Needed
Your app is currently showing the "API Key Missing" modal because:
- ✅ Build succeeded
- ✅ App is deployed
- ❌ No API key configured in Railway environment

Once you add the variable, the app will automatically:
- ✅ Fetch chart data from Binance
- ✅ Display BTC news with sentiment colors
- ✅ Show macro metrics (VIX, BTC Dominance)
- ✅ Enable AI analysis

## Expected Result
After adding the variable and redeployment (1-2 minutes):
- Dashboard loads with live data
- Green/Red/Orange news feed
- Charts display
- All metrics populate
