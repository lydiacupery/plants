// OAuth helper functions for HubSpot
import { Client } from '@hubspot/api-client';
import { storeTokens, getTokenData, TokenData } from './tokenStore';

const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || 'https://plants-production-a263.up.railway.app/oauth/callback';

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenData> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing CLIENT_ID or CLIENT_SECRET environment variables');
  }

  console.log('[OAUTH] Exchanging authorization code for tokens');

  const hubspotClient = new Client();

  try {
    const tokenResponse = await hubspotClient.oauth.tokensApi.create(
      'authorization_code',
      code,
      REDIRECT_URI,
      CLIENT_ID,
      CLIENT_SECRET
    );

    console.log('[OAUTH] Successfully exchanged code for tokens');

    // Calculate expiration time
    const expiresIn = tokenResponse.expiresIn || 1800; // Default 30 minutes
    const expiresAt = Date.now() + (expiresIn * 1000);

    const tokenData: TokenData = {
      portalId: parseInt(tokenResponse.hubId || '0', 10),
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresAt
    };

    // Store tokens in database
    await storeTokens(tokenData);

    return tokenData;
  } catch (error: any) {
    console.error('[OAUTH] Error exchanging code:', error);
    throw new Error(`Failed to exchange authorization code: ${error.message}`);
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(portalId: number): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing CLIENT_ID or CLIENT_SECRET environment variables');
  }

  console.log(`[OAUTH] Refreshing access token for portal ${portalId}`);

  // Get current token data
  const currentTokenData = await getTokenData(portalId);

  if (!currentTokenData) {
    throw new Error(`No token data found for portal ${portalId}`);
  }

  const hubspotClient = new Client();

  try {
    const tokenResponse = await hubspotClient.oauth.tokensApi.create(
      'refresh_token',
      undefined,
      undefined,
      CLIENT_ID,
      CLIENT_SECRET,
      currentTokenData.refreshToken
    );

    console.log(`[OAUTH] Successfully refreshed token for portal ${portalId}`);

    // Calculate new expiration time
    const expiresIn = tokenResponse.expiresIn || 1800;
    const expiresAt = Date.now() + (expiresIn * 1000);

    const newTokenData: TokenData = {
      portalId,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken || currentTokenData.refreshToken, // Use old refresh token if new one not provided
      expiresAt
    };

    // Update tokens in database
    await storeTokens(newTokenData);

    return newTokenData.accessToken;
  } catch (error: any) {
    console.error(`[OAUTH] Error refreshing token for portal ${portalId}:`, error);
    throw new Error(`Failed to refresh access token: ${error.message}`);
  }
}

/**
 * Get valid access token for a portal (auto-refresh if needed)
 */
export async function getValidAccessToken(portalId: number): Promise<string> {
  const tokenData = await getTokenData(portalId);

  if (!tokenData) {
    throw new Error(`No tokens found for portal ${portalId}. User needs to authorize the app.`);
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  const now = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

  if (now >= (tokenData.expiresAt - bufferTime)) {
    console.log(`[OAUTH] Token expired or expiring soon for portal ${portalId}, refreshing...`);
    return await refreshAccessToken(portalId);
  }

  return tokenData.accessToken;
}
