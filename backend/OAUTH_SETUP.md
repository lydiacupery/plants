# OAuth Setup for Marketplace Distribution

## Overview

Your Plant Care Assistant app has been converted from static authentication to OAuth for marketplace distribution. This allows multiple HubSpot customers to install and use your app.

## Changes Made

### 1. App Configuration
- **File**: `src/app/app-hsmeta.json`
- Changed `distribution` from `"private"` to `"marketplace"`
- Changed `auth.type` from `"static"` to `"oauth"`

### 2. Database Setup
- **Migration**: `backend/migrations/001_create_oauth_tokens.sql`
- Creates `oauth_tokens` table to store access and refresh tokens per portal
- Includes indexes for performance and automatic timestamp updates

### 3. New Backend Files

#### `backend/src/tokenStore.ts`
- Database interface for storing/retrieving OAuth tokens
- Functions: `storeTokens()`, `getAccessToken()`, `getTokenData()`, `deleteTokens()`
- Uses PostgreSQL connection pool

#### `backend/src/oauth.ts`
- OAuth flow implementation
- `exchangeCodeForTokens()` - Converts authorization code to tokens
- `refreshAccessToken()` - Refreshes expired tokens
- `getValidAccessToken()` - Gets token and auto-refreshes if needed

#### `backend/src/authMiddleware.ts`
- Request authentication middleware
- `extractPortalId()` - Extracts portal ID from various request formats
- `authenticateRequest()` - Middleware to authenticate and attach HubSpot client to requests

### 4. New Endpoints

#### `GET /oauth/callback`
- Receives authorization code from HubSpot
- Exchanges code for access/refresh tokens
- Stores tokens in database
- Shows success/error page to user

#### `POST /oauth/uninstall`
- Webhook called when app is uninstalled
- Deletes tokens from database

### 5. Updated Endpoints

The workflow action endpoint (`/api/workflow/water-plant`) now:
1. Extracts `portalId` from the request
2. Gets the appropriate OAuth token for that portal
3. Auto-refreshes token if expired
4. Uses per-portal token for API calls

## Environment Variables Required

Add these to your Railway project:

```bash
# OAuth Credentials (from HubSpot Developer Account)
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=https://plants-production-a263.up.railway.app/oauth/callback

# Database (Railway will provide this)
DATABASE_URL=postgresql://user:password@host:port/database

# Existing variables
PERENUAL_API_KEY=your_perenual_key
PORT=3000
NODE_ENV=production
```

## Setup Steps

### 1. Add PostgreSQL Database to Railway
1. Go to your Railway project
2. Click "+ New" → "Database" → "PostgreSQL"
3. Railway will automatically set `DATABASE_URL` environment variable

### 2. Run Database Migration
SSH into your Railway container or use Railway CLI:
```bash
psql $DATABASE_URL < backend/migrations/001_create_oauth_tokens.sql
```

### 3. Install Dependencies
```bash
cd backend
npm install
```

This will install the new `pg` dependency for PostgreSQL.

### 4. Get OAuth Credentials from HubSpot
1. Go to https://developers.hubspot.com/
2. Navigate to your app
3. Go to "Auth" tab
4. Copy `Client ID` and `Client Secret`
5. Set redirect URI to: `https://plants-production-a263.up.railway.app/oauth/callback`

### 5. Add Environment Variables to Railway
Add the OAuth credentials to your Railway project environment variables.

### 6. Deploy
```bash
npm run build
```

Railway will auto-deploy the changes.

### 7. Upload Updated App to HubSpot
```bash
hs project upload
```

## How OAuth Flow Works

### Installation Flow:
```
1. User clicks "Install" in HubSpot Marketplace
2. HubSpot redirects to authorization page
3. User authorizes app
4. HubSpot redirects to /oauth/callback with code
5. Backend exchanges code for tokens
6. Tokens stored in database with portalId
7. User sees success page
```

### API Request Flow:
```
1. HubSpot calls your workflow action
2. Request includes portalId in body
3. Backend extracts portalId
4. Backend retrieves token for that portal
5. If token expired, auto-refresh
6. Use token to call HubSpot API
7. Return result to HubSpot
```

### Token Refresh:
- Access tokens expire after 30 minutes
- `getValidAccessToken()` automatically refreshes if expired or expiring soon (< 5 min)
- Refresh tokens are long-lived and used to get new access tokens

## Updating Other Endpoints

To convert other endpoints to use OAuth, follow this pattern:

### Before (Static Auth):
```typescript
const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
const hubspotClient = new Client({ accessToken });
```

### After (OAuth):
```typescript
// 1. Import utilities
import { getValidAccessToken } from './oauth';
import { extractPortalId } from './authMiddleware';

// 2. Parse body and extract portal ID
let body = /* parse req.body */;
const portalId = extractPortalId(body);

if (!portalId) {
  return res.status(400).json({ error: 'Missing portal ID' });
}

// 3. Get OAuth token for this portal
const accessToken = await getValidAccessToken(portalId);
const hubspotClient = new Client({ accessToken });
```

## TODO: Update Remaining Endpoints

The following endpoints still use static auth and need to be updated:

- `GET /api/plants/contact/:contactId` - Get plants for contact
- `POST /api/plants/associate` - Create plant and associate
- `PATCH /api/plants/contact/:contactId/plant/:plantId` - Update plant
- `DELETE /api/plants/contact/:contactId/plant/:plantId` - Remove plant

For frontend card requests, you'll need to modify how the card authenticates since it can't easily pass portalId. Options:
1. Use HubSpot's frontend `hubspot.fetch()` which handles auth automatically
2. Pass portalId from frontend context to backend
3. Use serverless functions feature of HubSpot Projects

## Testing

### Test OAuth Flow:
1. Upload project: `hs project upload`
2. Go to HubSpot → Settings → Integrations → Connected Apps
3. Find your app and click "Install" or "Reauthorize"
4. Complete OAuth flow
5. Check Railway logs to see tokens being stored

### Test Workflow Action:
1. Create a plant-based workflow
2. Add "Water Plant" action
3. Trigger workflow
4. Check logs to see OAuth token retrieval and auto-refresh

## Monitoring

Check Railway logs for:
- `[TOKEN STORE]` - Database operations
- `[OAUTH]` - OAuth flow and token refresh
- `[WATER PLANT WORKFLOW]` - Workflow action execution with per-portal auth

## Security Notes

- Never commit `CLIENT_SECRET` to git
- Database credentials are managed by Railway
- Tokens are encrypted in transit (HTTPS)
- Use environment variables for all secrets
- Token refresh happens automatically before expiration

## Support

If you encounter issues:
1. Check Railway logs for error messages
2. Verify environment variables are set correctly
3. Ensure database migration ran successfully
4. Check HubSpot app configuration matches redirect URI
