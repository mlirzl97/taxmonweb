import { readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const versions = new Map();

for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"))) {
  const match = /^(\d+)_/.exec(file);
  if (!match) continue;
  const files = versions.get(match[1]) ?? [];
  files.push(file);
  versions.set(match[1], files);
}

const duplicates = [...versions.entries()].filter(([, files]) => files.length > 1);
if (duplicates.length > 0) {
  for (const [version, files] of duplicates) console.error(`${version}: ${files.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Migration versions OK (${versions.size} unique versions).`);
}
