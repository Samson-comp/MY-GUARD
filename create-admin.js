import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before creating an admin account.");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Set a valid ADMIN_EMAIL.");
if (!password || password.length < 14) throw new Error("Set ADMIN_PASSWORD to a unique password of at least 14 characters.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query("INSERT INTO admins (email, password_hash) VALUES ($1, $2)", [email, passwordHash]);
    console.log(`Admin account created for ${email}. Remove ADMIN_PASSWORD from the environment after this command.`);
} finally {
    await pool.end();
}
