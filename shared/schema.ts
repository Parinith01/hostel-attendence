import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean } from "drizzle-orm/pg-core";
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
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;
