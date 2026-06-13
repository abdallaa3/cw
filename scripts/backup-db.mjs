import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Put it in .env.local or pass it before running npm run backup.");
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const backupDir = join(root, "backups");
const output = join(backupDir, `Code-Wave-Academy-DB-Backup-${date}.sql`);
mkdirSync(backupDir, { recursive: true });

const child = spawn("pg_dump", [databaseUrl, "--file", output, "--clean", "--if-exists"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`Backup created: ${output}`);
    return;
  }
  console.error("pg_dump failed. Install PostgreSQL tools and make sure pg_dump is available in PATH.");
  process.exit(code || 1);
});
