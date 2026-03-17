import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  roomNumber: text("room_number"),
  hostelBlock: text("hostel_block"),
  role: text("role").notNull().default("student"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  userId: true,
  password: true,
  fullName: true,
  phoneNumber: true,
  roomNumber: true,
  hostelBlock: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  mealType: text("meal_type").notNull(), // 'breakfast' | 'dinner'
  timestamp: text("timestamp").notNull(),
  status: text("status").notNull().default("present"), // 'present' | 'absent'
  absentReason: text("absent_reason"),
  returnDate: text("return_date"), // YYYY-MM-DD
  returnMealType: text("return_meal_type"), // 'breakfast' | 'dinner'
  sundayToken: text("sunday_token"),
  verifiedByAdmin: boolean("verified_by_admin").default(false),
});

export const settings = pgTable("settings", {
  id: text("id").primaryKey(), // will always be 'default'
  breakfastStart: text("breakfast_start").notNull().default("06:00"),
  breakfastEnd: text("breakfast_end").notNull().default("09:00"),
  dinnerStart: text("dinner_start").notNull().default("18:00"),
  dinnerEnd: text("dinner_end").notNull().default("22:00"),
});

export type Settings = typeof settings.$inferSelect;

export const insertAttendanceSchema = createInsertSchema(attendance).pick({
  userId: true,
  date: true,
  mealType: true,
  timestamp: true,
  status: true,
  absentReason: true,
  returnDate: true,
  returnMealType: true,
  sundayToken: true,
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull(),
  startDate: text("start_date").notNull(),   // YYYY-MM-DD
  endDate: text("end_date").notNull(),        // YYYY-MM-DD
  returnMealType: text("return_meal_type").notNull(), // 'breakfast' | 'dinner'
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  adminNote: text("admin_note"),
  timestamp: text("timestamp").notNull(),
  monthYear: text("month_year").notNull(), // 'YYYY-MM' for easy monthly queries
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).pick({
  userId: true,
  reason: true,
  startDate: true,
  endDate: true,
  returnMealType: true,
  monthYear: true,
  timestamp: true,
});

export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
