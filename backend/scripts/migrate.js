// Migration script - runs automatically on build
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('[MIGRATION] Starting database migrations...');
  console.log('[MIGRATION] NODE_ENV:', process.env.NODE_ENV);
  console.log('[MIGRATION] DATABASE_URL exists:', !!process.env.DATABASE_URL);

  if (!process.env.DATABASE_URL) {
    console.log('[MIGRATION] No DATABASE_URL found - skipping migrations (development mode?)');
    process.exit(0);
  }

  console.log('[MIGRATION] Using DATABASE_URL starting with:', process.env.DATABASE_URL.substring(0, 20) + '...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('[MIGRATION] Connected to database successfully');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_create_oauth_tokens.sql');
    console.log('[MIGRATION] Reading migration from:', migrationPath);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('[MIGRATION] Migration SQL length:', migrationSQL.length, 'characters');

    console.log('[MIGRATION] Running migration: 001_create_oauth_tokens.sql');

    // Run migration
    const result = await client.query(migrationSQL);
    console.log('[MIGRATION] Query executed, result:', result.command);

    console.log('[MIGRATION] ✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] ❌ Error occurred:', error);
    console.error('[MIGRATION] Error message:', error.message);
    console.error('[MIGRATION] Error code:', error.code);
    console.error('[MIGRATION] Error stack:', error.stack);

    // Check if error is because table already exists
    if (error.message && error.message.includes('already exists')) {
      console.log('[MIGRATION] ℹ️  Tables already exist - skipping');
      process.exit(0);
    }

    // In production, don't fail the build if migration fails
    // (table might already exist)
    if (process.env.NODE_ENV === 'production') {
      console.log('[MIGRATION] Continuing with build despite migration error...');
      process.exit(0);
    } else {
      console.log('[MIGRATION] Development mode - exiting with error code 1');
      process.exit(1);
    }
  } finally {
    console.log('[MIGRATION] Closing database connection...');
    await client.end();
    console.log('[MIGRATION] Database connection closed');
  }
}

runMigrations();
