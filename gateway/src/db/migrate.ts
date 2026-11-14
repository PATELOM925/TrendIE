import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  console.log(`Found ${files.length} migration files in ${migrationsDir}`);
  for (const file of files) {
    console.log(`Applying migration: ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`Applied: ${file}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete.');
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
