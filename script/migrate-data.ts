import "dotenv/config";
import { Client } from "pg";

async function migrateData() {
  const oldUrl = process.env.OLD_DATABASE_URL;
  const newUrl = process.env.NEW_DATABASE_URL;

  if (!oldUrl || !newUrl) {
    console.error("❌ Please add OLD_DATABASE_URL and NEW_DATABASE_URL to your .env file.");
    process.exit(1);
  }

  console.log("🔌 Connecting to databases...");
  const oldClient = new Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newClient = new Client({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  await oldClient.connect();
  await newClient.connect();

  try {
    console.log("📦 Fetching old data...");
    const { rows: users } = await oldClient.query('SELECT * FROM users');
    const { rows: attendances } = await oldClient.query('SELECT * FROM attendance');
    const { rows: leaveRequests } = await oldClient.query('SELECT * FROM leave_requests');
    const { rows: settings } = await oldClient.query('SELECT * FROM settings');

    console.log(`Found: ${users.length} users, ${attendances.length} attendance records, ${leaveRequests.length} leave requests.`);

    console.log("🚀 Inserting into new database...");

    // Migrate Users
    for (const user of users) {
      await newClient.query(
        `INSERT INTO users (id, user_id, password, full_name, phone_number, room_number, hostel_block, role) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
        [user.id, user.user_id, user.password, user.full_name, user.phone_number, user.room_number, user.hostel_block, user.role]
      );
    }
    console.log("✅ Users migrated.");

    // Migrate Settings
    for (const setting of settings) {
      await newClient.query(
        `INSERT INTO settings (id, breakfast_start, breakfast_end, dinner_start, dinner_end) 
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [setting.id, setting.breakfast_start, setting.breakfast_end, setting.dinner_start, setting.dinner_end]
      );
    }
    console.log("✅ Settings migrated.");

    // Migrate Attendance
    for (const att of attendances) {
      await newClient.query(
        `INSERT INTO attendance (id, user_id, date, meal_type, timestamp, status, absent_reason, return_date, return_meal_type, sunday_token, verified_by_admin) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [att.id, att.user_id, att.date, att.meal_type, att.timestamp, att.status, att.absent_reason, att.return_date, att.return_meal_type, att.sunday_token, att.verified_by_admin]
      );
    }
    console.log("✅ Attendance migrated.");

    // Migrate Leave Requests
    for (const lr of leaveRequests) {
      await newClient.query(
        `INSERT INTO leave_requests (id, user_id, reason, start_date, end_date, return_meal_type, status, admin_note, timestamp, month_year) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
        [lr.id, lr.user_id, lr.reason, lr.start_date, lr.end_date, lr.return_meal_type, lr.status, lr.admin_note, lr.timestamp, lr.month_year]
      );
    }
    console.log("✅ Leave Requests migrated.");

    console.log("🎉 All data successfully migrated to the new database!");

  } catch (error) {
    console.error("❌ Error during migration:", error);
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

migrateData();
