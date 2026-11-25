import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running database migrations.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
    const schema = await readFile(fileURLToPath(new URL("../schema.sql", import.meta.url)), "utf8");
    await pool.query(schema);
    console.log("Database schema is up to date.");
} finally {
    await pool.end();
}
