-- Migration: Create OAuth tokens table
-- Database: PostgreSQL
-- Description: Stores OAuth access and refresh tokens for each HubSpot portal

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  portal_id BIGINT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by portal_id
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_portal_id ON oauth_tokens(portal_id);

-- Index for finding expired tokens
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before UPDATE
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE oauth_tokens IS 'Stores OAuth 2.0 tokens for HubSpot portals';
COMMENT ON COLUMN oauth_tokens.portal_id IS 'HubSpot portal ID (unique identifier for each customer)';
COMMENT ON COLUMN oauth_tokens.access_token IS 'OAuth access token for API calls';
COMMENT ON COLUMN oauth_tokens.refresh_token IS 'OAuth refresh token to get new access tokens';
COMMENT ON COLUMN oauth_tokens.expires_at IS 'Unix timestamp (milliseconds) when access token expires';
COMMENT ON COLUMN oauth_tokens.created_at IS 'When the tokens were first stored';
COMMENT ON COLUMN oauth_tokens.updated_at IS 'When the tokens were last updated';
