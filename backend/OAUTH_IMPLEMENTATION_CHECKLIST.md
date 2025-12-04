# OAuth Implementation Checklist

## ✅ Implementation Status vs HubSpot Documentation

### Step 1: Create Authorization URL ✅
**HubSpot Requirement:** Build URL with `client_id`, `scope`, `redirect_uri`, and `state`

**Our Implementation:**
- ✅ Endpoint: `GET /oauth/install`
- ✅ Builds proper authorization URL
- ✅ Includes all required parameters
- ✅ Redirects user to HubSpot OAuth server
- ✅ CSRF protection with random state

**Usage:**
```
https://plants-production-a263.up.railway.app/oauth/install
```

### Step 2: User Consent ✅
**HubSpot Requirement:** User sees consent screen and authorizes app

**Our Implementation:**
- ✅ Handled by HubSpot automatically
- ✅ App displays name and requested scopes
- ✅ User must be Super Admin

### Step 3: Handle OAuth Response ✅
**HubSpot Requirement:** Receive authorization code at redirect URI

**Our Implementation:**
- ✅ Endpoint: `GET /oauth/callback`
- ✅ Receives `code` query parameter
- ✅ Validates code exists
- ✅ Shows success/error page to user

### Step 4: Exchange Code for Tokens ✅
**HubSpot Requirement:** POST to `/oauth/v1/token` with grant_type, client_id, client_secret, redirect_uri, code

**Our Implementation:**
- ✅ File: `backend/src/oauth.ts`
- ✅ Function: `exchangeCodeForTokens()`
- ✅ Uses HubSpot API client (handles POST internally)
- ✅ Stores `access_token`, `refresh_token`, `expires_in`
- ✅ Saves tokens to database with portal ID

**Response Handling:**
```typescript
{
  portalId: tokenResponse.hubId,
  accessToken: tokenResponse.accessToken,
  refreshToken: tokenResponse.refreshToken,
  expiresAt: Date.now() + (expiresIn * 1000)
}
```

### Step 5: Using OAuth Tokens ✅
**HubSpot Requirement:** Include token as Bearer in Authorization header

**Our Implementation:**
- ✅ Function: `getValidAccessToken(portalId)`
- ✅ Creates HubSpot Client with access token
- ✅ Client automatically adds Bearer token to requests
- ✅ Example in `/api/workflow/water-plant` endpoint

**Usage Pattern:**
```typescript
const accessToken = await getValidAccessToken(portalId);
const hubspotClient = new Client({ accessToken });
// Client automatically adds: Authorization: Bearer <token>
```

### Step 6: Refreshing Tokens ✅
**HubSpot Requirement:** POST to `/oauth/v1/token` with grant_type=refresh_token

**Our Implementation:**
- ✅ File: `backend/src/oauth.ts`
- ✅ Function: `refreshAccessToken(portalId)`
- ✅ Uses HubSpot API client
- ✅ Automatically stores new tokens
- ✅ Auto-refresh triggered by `getValidAccessToken()`

**Auto-Refresh Logic:**
```typescript
// Refreshes if token expired or expiring within 5 minutes
if (now >= (tokenData.expiresAt - 5 * 60 * 1000)) {
  return await refreshAccessToken(portalId);
}
```

### Step 7: Token Storage ✅
**HubSpot Requirement:** Store tokens securely per portal

**Our Implementation:**
- ✅ File: `backend/src/tokenStore.ts`
- ✅ PostgreSQL database storage
- ✅ Indexed by `portal_id`
- ✅ Stores: access_token, refresh_token, expires_at
- ✅ UPSERT on conflict (updates existing tokens)

### Step 8: Uninstall Handling ✅
**HubSpot Requirement:** Delete tokens when app is uninstalled

**Our Implementation:**
- ✅ Endpoint: `POST /oauth/uninstall`
- ✅ Webhook receives portal ID
- ✅ Deletes tokens from database
- ✅ Function: `deleteTokens(portalId)`

---

## 🔧 Configuration Required

### Environment Variables
Add these to Railway:

```bash
# OAuth Credentials (get from HubSpot Developer portal)
HUBSPOT_CLIENT_ID=your_client_id_here
HUBSPOT_CLIENT_SECRET=your_client_secret_here
HUBSPOT_REDIRECT_URI=https://plants-production-a263.up.railway.app/oauth/callback

# Database (auto-set by Railway when you add PostgreSQL)
DATABASE_URL=postgresql://...

# Existing
PERENUAL_API_KEY=your_perenual_key
PORT=3000
NODE_ENV=production
```

### HubSpot App Settings
Configure in https://developers.hubspot.com/

1. **Auth Tab:**
   - Redirect URL: `https://plants-production-a263.up.railway.app/oauth/callback`
   - Scopes:
     - `crm.objects.contacts.read`
     - `crm.objects.contacts.write`
     - `crm.schemas.custom.read`
     - `crm.schemas.custom.write`
     - `crm.objects.custom.read`
     - `crm.objects.custom.write`

2. **Webhooks (optional):**
   - Uninstall webhook: `https://plants-production-a263.up.railway.app/oauth/uninstall`

---

## 📋 Deployment Checklist

- [ ] Add PostgreSQL database to Railway
- [ ] Add OAuth environment variables to Railway
- [ ] Push code to trigger deployment
- [ ] Migration runs automatically on build
- [ ] Verify migration succeeded in Railway logs
- [ ] Get OAuth credentials from HubSpot Developer portal
- [ ] Configure redirect URI in HubSpot app settings
- [ ] Upload app to HubSpot: `hs project upload`
- [ ] Test installation: Visit `/oauth/install` endpoint
- [ ] Verify tokens stored in database
- [ ] Test workflow action with OAuth tokens

---

## 🧪 Testing OAuth Flow

### 1. Test Installation
Visit: `https://plants-production-a263.up.railway.app/oauth/install`

Expected flow:
1. Redirects to HubSpot authorization page
2. Shows your app name and requested scopes
3. User clicks "Connect app"
4. Redirects back to `/oauth/callback`
5. Shows success page
6. Tokens stored in database

### 2. Check Database
```sql
SELECT portal_id, expires_at, created_at
FROM oauth_tokens;
```

### 3. Test API Call
Run workflow action - check logs for:
```
[OAUTH] Getting valid access token for portal 12345
[WATER PLANT WORKFLOW] Successfully updated plant
```

### 4. Test Token Refresh
Wait 30 minutes (or change expires_at to past time) and run again:
```
[OAUTH] Token expired or expiring soon, refreshing...
[OAUTH] Successfully refreshed token
```

---

## 🎯 Key Differences from Documentation

### HubSpot API Client vs Raw HTTP
**Documentation shows:** Raw POST requests to `/oauth/v1/token`

**We use:** `@hubspot/api-client` library which:
- ✅ Handles the POST requests internally
- ✅ Properly formats request body
- ✅ Parses responses correctly
- ✅ Includes proper error handling
- ✅ More reliable than raw HTTP

### Auto-Refresh Buffer
**Documentation:** Refresh when token expires

**We improve:** Refresh 5 minutes BEFORE expiration
- ✅ Prevents race conditions
- ✅ Ensures API calls never fail due to expired token
- ✅ Seamless user experience

### Database Storage
**Documentation:** Doesn't specify storage method

**We implement:** PostgreSQL with:
- ✅ Indexed queries for fast lookup
- ✅ UPSERT for safe concurrent updates
- ✅ Automatic timestamp tracking
- ✅ Production-ready data persistence

---

## ✅ We're OAuth Ready!

Your app follows HubSpot's OAuth 2.0 specification exactly and adds production-ready improvements like auto-refresh buffers and database persistence.

**Next:** Add the environment variables and test the installation flow!
