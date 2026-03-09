import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
    // Let's not throw an error if no DB is provided, so they don't break their local DEV immediately 
    // until they provide it. If we throw, the app crashes and local dev is broken!
    console.warn("⚠️ DATABASE_URL is missing. App will fall back to using in-memory mock database temporarily.");
}

export const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : null;

export const db = pool ? drizzle(pool, { schema }) : null;
