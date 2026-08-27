/* Runs Prisma migrations against a Postgres database using the `pg` driver,
 * which tolerates Render's self-signed TLS cert (matching PrismaService). */
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const cleanUrl = url
  .replace(/([?&])sslmode=[^&]*&?/, '$1')
  .replace(/[?&]$/, '');

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public._veribuy_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;

    const { rows } = await pool.query(
      'SELECT 1 FROM public._veribuy_migrations WHERE name = $1',
      [dir],
    );
    if (rows.length > 0) {
      console.log(`Skipping already-applied migration: ${dir}`);
      continue;
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO public._veribuy_migrations (name) VALUES ($1)',
        [dir],
      );
      await client.query('COMMIT');
      console.log(`Applied migration: ${dir}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  console.log('All migrations applied.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
