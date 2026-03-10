import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_fgr5zsBQ6cOA@ep-odd-math-ahstfyfq-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

async function seed() {
    await pool.query(
        `INSERT INTO users (id, user_id, password, full_name, phone_number, room_number, hostel_block, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO NOTHING`,
        [randomUUID(), 'admin123', 'password123', 'System Admin', '0000000000', 'N/A', 'Admin Block', 'admin']
    );
    console.log('✅ Admin user seeded into Neon!');
    await pool.end();
}

seed().catch(e => { console.error('❌', e.message); pool.end(); });
