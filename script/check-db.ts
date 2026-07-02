import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const result = await pool.query(
    "SELECT user_id, date, meal_type, status, return_date, return_meal_type FROM attendance ORDER BY date DESC, meal_type"
  );

  console.log("ALL RECORDS:");
  result.rows.forEach(r => {
    console.log(`${r.user_id} | ${r.date} | ${r.meal_type} | ${r.status} | return_date=${r.return_date} | return_meal=${r.return_meal_type}`);
  });
  await pool.end();
}

run().catch(e => { console.error("ERROR:", e.message); pool.end(); });
