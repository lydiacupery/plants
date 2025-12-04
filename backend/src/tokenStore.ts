// Token storage for OAuth using PostgreSQL
import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export interface TokenData {
  portalId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Store OAuth tokens for a portal
 */
export async function storeTokens(tokenData: TokenData): Promise<void> {
  console.log(`[TOKEN STORE] Storing tokens for portal ${tokenData.portalId}`);

  const query = `
    INSERT INTO oauth_tokens (portal_id, access_token, refresh_token, expires_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (portal_id)
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = CURRENT_TIMESTAMP
  `;

  try {
    await pool.query(query, [
      tokenData.portalId,
      tokenData.accessToken,
      tokenData.refreshToken,
      tokenData.expiresAt
    ]);
    console.log(`[TOKEN STORE] Successfully stored tokens for portal ${tokenData.portalId}`);
  } catch (error) {
    console.error(`[TOKEN STORE] Error storing tokens:`, error);
    throw error;
  }
}

/**
 * Get access token for a portal
 */
export async function getAccessToken(portalId: number): Promise<string | null> {
  console.log(`[TOKEN STORE] Getting token for portal ${portalId}`);

  const query = `
    SELECT access_token, expires_at
    FROM oauth_tokens
    WHERE portal_id = $1
  `;

  try {
    const result = await pool.query(query, [portalId]);

    if (result.rows.length === 0) {
      console.log(`[TOKEN STORE] No token found for portal ${portalId}`);
      return null;
    }

    const { access_token, expires_at } = result.rows[0];

    // Check if token is expired
    const now = Date.now();
    if (now >= expires_at) {
      console.log(`[TOKEN STORE] Token expired for portal ${portalId}`);
      return null; // Token refresh will be handled elsewhere
    }

    return access_token;
  } catch (error) {
    console.error(`[TOKEN STORE] Error getting token:`, error);
    throw error;
  }
}

/**
 * Get full token data for a portal (for refresh)
 */
export async function getTokenData(portalId: number): Promise<TokenData | null> {
  console.log(`[TOKEN STORE] Getting full token data for portal ${portalId}`);

  const query = `
    SELECT portal_id, access_token, refresh_token, expires_at
    FROM oauth_tokens
    WHERE portal_id = $1
  `;

  try {
    const result = await pool.query(query, [portalId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      portalId: row.portal_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at
    };
  } catch (error) {
    console.error(`[TOKEN STORE] Error getting token data:`, error);
    throw error;
  }
}

/**
 * Delete tokens for a portal (on uninstall)
 */
export async function deleteTokens(portalId: number): Promise<void> {
  console.log(`[TOKEN STORE] Deleting tokens for portal ${portalId}`);

  const query = `
    DELETE FROM oauth_tokens
    WHERE portal_id = $1
  `;

  try {
    await pool.query(query, [portalId]);
    console.log(`[TOKEN STORE] Successfully deleted tokens for portal ${portalId}`);
  } catch (error) {
    console.error(`[TOKEN STORE] Error deleting tokens:`, error);
    throw error;
  }
}

/**
 * Check if a portal has valid tokens
 */
export async function hasValidToken(portalId: number): Promise<boolean> {
  const token = await getAccessToken(portalId);
  return token !== null;
}

/**
 * Close the database pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
