import { Pool } from 'pg';

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_fgr5zsBQ6cOA@ep-odd-math-ahstfyfq-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

async function updateAdmin() {
    const result = await pool.query(
        `UPDATE users SET user_id = $1, password = $2 WHERE role = 'admin' RETURNING user_id, role`,
        ['jss123', 'jmbh@2026']
    );
    if (result.rowCount === 0) {
        console.log('❌ No admin user found to update!');
    } else {
        console.log('✅ Admin updated successfully:', result.rows[0]);
    }
    await pool.end();
}

updateAdmin().catch(e => { console.error('❌', e.message); pool.end(); });
