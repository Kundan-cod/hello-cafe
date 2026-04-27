import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { defineConfig } from "prisma/config";

// Determine which schema to use based on DATABASE_URL
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
try {
  require(join(__dirname, "node_modules/dotenv/config"));
} catch {
  // dotenv not needed when DATABASE_URL is already set
}

// Use SQLite schema for local development (file: or .db in URL)
const dbUrl = process.env.DATABASE_URL || '';
const schema = (dbUrl.startsWith('file:') || dbUrl.includes('.db'))
  ? "prisma/schema-sqlite.prisma"
  : "prisma/schema.prisma";

export default defineConfig({
  schema,
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});