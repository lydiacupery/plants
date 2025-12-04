# Setting Up New OAuth App

Since HubSpot doesn't allow changing auth type after an app is uploaded, we've created a new app with OAuth from the start.

## What Changed

- **Old App:** `plant_care_app` (static auth, private distribution)
- **New App:** `plant_care_app_oauth` (OAuth, marketplace distribution)

## Setup Steps

### 1. Railway: Add PostgreSQL Database

1. Go to your Railway project: https://railway.app/
2. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
3. Railway will automatically set the `DATABASE_URL` environment variable

### 2. Railway: Add OAuth Environment Variables

Add these environment variables to your Railway project:

```bash
HUBSPOT_CLIENT_ID=your_client_id_here
HUBSPOT_CLIENT_SECRET=your_client_secret_here
HUBSPOT_REDIRECT_URI=https://plants-production-a263.up.railway.app/oauth/callback
```

> **Note:** You'll get the Client ID and Secret in step 5 after uploading the app.

### 3. Deploy to Railway

The latest code is already pushed to GitHub. Railway will auto-deploy:
- TypeScript compilation
- Database migration (runs automatically via `npm run build`)
- Server start

Check Railway logs to confirm:
```
[MIGRATION] ✅ Migration completed successfully
```

### 4. Upload New App to HubSpot

From your project directory:

```bash
cd /Users/lcupery/src/lydia-test
hs project upload
```

This creates a **new app** in HubSpot (separate from the old one).

### 5. Configure OAuth in HubSpot Developer Portal

1. Go to https://developers.hubspot.com/
2. Find your new app: **"Plant Care Assistant"** (UID: `plant_care_app_oauth`)
3. Go to the **"Auth"** tab
4. Copy the **Client ID** and **Client Secret**
5. Set the **Redirect URL** to:
   ```
   https://plants-production-a263.up.railway.app/oauth/callback
   ```
6. Verify the required scopes are set:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.schemas.custom.read`
   - `crm.schemas.custom.write`
   - `crm.objects.custom.read`
   - `crm.objects.custom.write`

### 6. Add OAuth Credentials to Railway

Go back to Railway and add the credentials from step 5:
- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`

Railway will automatically restart your app with the new variables.

### 7. Test OAuth Installation

Visit this URL (or share it to test users):
```
https://plants-production-a263.up.railway.app/oauth/install
```

Expected flow:
1. Redirects to HubSpot authorization page
2. Shows "Plant Care Assistant" and requested scopes
3. Click **"Connect app"**
4. Redirects back to `/oauth/callback`
5. Shows success page
6. Tokens stored in PostgreSQL database

### 8. Verify Database

Check Railway logs for:
```
[OAUTH] Successfully exchanged code for tokens
[OAUTH] Retrieved token info for portal 12345
[TOKEN STORE] Storing tokens for portal 12345
```

Or connect to PostgreSQL and run:
```sql
SELECT portal_id, expires_at, created_at FROM oauth_tokens;
```

### 9. Test Workflow Action

1. In HubSpot, go to **Workflows**
2. Create a contact-based workflow
3. Add action: **"Water Plant"** (from Plant Care Assistant)
4. Select a plant from object properties
5. Trigger the workflow

Check Railway logs for:
```
[OAUTH] Getting valid access token for portal 12345
[WATER PLANT WORKFLOW] Successfully updated plant
```

## What Happens to the Old App?

The old `plant_care_app` with static auth will remain in your HubSpot account. You can:
- **Keep it running** if you want (won't interfere with new app)
- **Uninstall it** from Settings → Integrations → Connected Apps
- **Delete it** from HubSpot Developer portal if you no longer need it

## Troubleshooting

### "No tokens found for portal X"
- User hasn't completed OAuth flow yet
- Share the `/oauth/install` URL to authorize the app

### "Migration failed"
- Check Railway logs for specific error
- Verify DATABASE_URL is set
- Check PostgreSQL is running

### "Invalid redirect URI"
- Verify redirect URI in HubSpot Developer portal matches Railway URL exactly
- Must be: `https://plants-production-a263.up.railway.app/oauth/callback`

### Workflow action not appearing
- Make sure you uploaded the new app (`plant_care_app_oauth`)
- Check object types include your custom Plants object ID
- Verify app is installed via OAuth flow

## Next Steps (Optional)

Once OAuth is working, you can update the remaining backend endpoints to use per-portal tokens:
- `GET /api/plants/contact/:contactId`
- `POST /api/plants/associate`
- `PATCH /api/plants/contact/:contactId/plant/:plantId`
- `DELETE /api/plants/contact/:contactId/plant/:plantId`

See `OAUTH_SETUP.md` for the pattern to follow.
