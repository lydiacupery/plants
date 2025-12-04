// Authentication middleware for OAuth
import { Request, Response, NextFunction } from 'express';
import { Client } from '@hubspot/api-client';
import { getValidAccessToken } from './oauth';

// Extend Express Request to include our custom properties
declare global {
  namespace Express {
    interface Request {
      portalId?: number;
      hubspotClient?: Client;
    }
  }
}

/**
 * Extract portal ID from request
 * Portal ID can come from different places depending on the request type
 */
export function extractPortalId(body: any): number | null {
  // Check various possible locations for portal ID
  if (body.origin?.portalId) {
    return parseInt(body.origin.portalId, 10);
  }
  if (body.portalId) {
    return parseInt(body.portalId, 10);
  }
  if (body.context?.portalId) {
    return parseInt(body.context.portalId, 10);
  }
  // For workflow actions
  if (body.origin?.extensionDefinitionId) {
    return parseInt(body.origin.portalId, 10);
  }

  return null;
}

/**
 * Middleware to authenticate requests using OAuth tokens
 * Gets the portal ID from the request and retrieves the appropriate token
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse body if it's a buffer
    let body = req.body;
    if (Buffer.isBuffer(req.body)) {
      const bodyString = req.body.toString('utf8');
      const parsed = JSON.parse(bodyString);
      body = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    }

    // Extract portal ID
    const portalId = extractPortalId(body);

    if (!portalId) {
      console.error('[AUTH] No portal ID found in request');
      res.status(400).json({
        error: 'Unable to determine portal ID from request'
      });
      return;
    }

    console.log(`[AUTH] Authenticating request for portal ${portalId}`);

    // Get valid access token (will auto-refresh if needed)
    const accessToken = await getValidAccessToken(portalId);

    // Create HubSpot client with the token
    const hubspotClient = new Client({ accessToken });

    // Attach to request for use in route handlers
    req.portalId = portalId;
    req.hubspotClient = hubspotClient;

    next();
  } catch (error: any) {
    console.error('[AUTH] Authentication error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: error.message
    });
  }
}
