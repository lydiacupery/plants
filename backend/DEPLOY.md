# Deploy to Railway - Quick Guide

## Step 1: Install Railway CLI (if not already installed)

```bash
npm install -g @railway/cli
```

Or use the web interface at https://railway.app

## Step 2: Deploy

### Option A: Railway CLI (Fastest)

```bash
cd backend
railway login
railway init
railway up
```

### Option B: Railway Web UI

1. Go to https://railway.app and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"** (or "Empty Project" for manual)
4. If using GitHub:
   - Connect your repo
   - Set root directory to: `/backend`
5. If manual:
   - Upload the `/backend` folder

## Step 3: Set Environment Variable

In Railway dashboard:
1. Go to your project
2. Click **Variables** tab
3. Add variable:
   - **Key**: `PERENUAL_API_KEY`
   - **Value**: `sk-x9B469207829b086813596`

## Step 4: Get Your URL

Railway will give you a URL like:
```
https://your-app-name.up.railway.app
```

## Step 5: Test Your Backend

```bash
curl "https://your-app-name.up.railway.app/api/plants/search?q=monstera"
```

You should see plant data returned!

## Step 6: Update HubSpot Card

Share your Railway URL and I'll update the HubSpot card to use it!

## Troubleshooting

- **502 Bad Gateway**: Check logs, might need to wait for deployment
- **Environment variable not working**: Make sure `PERENUAL_API_KEY` is set in Railway dashboard
- **CORS errors**: Already configured in server.js with `cors({ origin: '*' })`

## Cost

Railway free tier includes:
- $5 of usage per month
- Should be plenty for development/testing
