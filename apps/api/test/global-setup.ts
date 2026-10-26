import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Fresh schema on a dedicated SQLite file so tests never touch dev data.
export default function setup() {
  rmSync('prisma/test.db', { force: true });
  rmSync('prisma/test.db-journal', { force: true });
  execSync('npx prisma db push --skip-generate --force-reset', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
