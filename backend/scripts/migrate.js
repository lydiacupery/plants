// Migration script - runs automatically on build
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('[MIGRATION] Starting database migrations...');

  if (!process.env.DATABASE_URL) {
    console.log('[MIGRATION] No DATABASE_URL found - skipping migrations (development mode?)');
    process.exit(0);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('[MIGRATION] Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_create_oauth_tokens.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRATION] Running migration: 001_create_oauth_tokens.sql');

    // Run migration
    await client.query(migrationSQL);

    console.log('[MIGRATION] ✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    // Check if error is because table already exists
    if (error.message && error.message.includes('already exists')) {
      console.log('[MIGRATION] ℹ️  Tables already exist - skipping');
      process.exit(0);
    }

    console.error('[MIGRATION] ❌ Migration failed:', error.message);

    // In production, don't fail the build if migration fails
    // (table might already exist)
    if (process.env.NODE_ENV === 'production') {
      console.log('[MIGRATION] Continuing with build despite migration error...');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

runMigrations();
