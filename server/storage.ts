import { users, attendance, settings, type User, type InsertUser, type Attendance, type InsertAttendance, type Settings } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUserId(userId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllStudents(): Promise<User[]>;

  markAttendance(attendance: InsertAttendance): Promise<Attendance>;
  getAttendanceByDate(date: string): Promise<Attendance[]>;
  getAttendanceByUserAndDate(userId: string, date: string, mealType: string): Promise<Attendance | undefined>;
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
  verifyAttendance(id: string, verified: boolean): Promise<Attendance | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private attendances: Map<string, Attendance>;
  private settingsConfig: Settings;

  constructor() {
    this.users = new Map();
    this.attendances = new Map();
    this.settingsConfig = { id: 'default', breakfastStart: '06:00', breakfastEnd: '09:00', dinnerStart: '18:00', dinnerEnd: '22:00' };

    // Seed an admin user
    this.createUser({
      userId: "admin123",
      password: "password123",
      fullName: "System Admin",
      phoneNumber: "0000000000",
      roomNumber: "N/A",
      hostelBlock: "Admin Block",
      role: "admin"
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUserId(userId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.userId === userId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      roomNumber: insertUser.roomNumber ?? null,
      hostelBlock: insertUser.hostelBlock ?? null,
      role: insertUser.role ?? "student",
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updatedUser = {
      ...user,
      ...updateData,
      roomNumber: updateData.roomNumber ?? user.roomNumber,
      hostelBlock: updateData.hostelBlock ?? user.hostelBlock,
      role: updateData.role ?? user.role,
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllStudents(): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.role === "student");
  }

  async markAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const id = randomUUID();
    const att: Attendance = {
      id,
      userId: insertAttendance.userId,
      date: insertAttendance.date,
      mealType: insertAttendance.mealType,
      timestamp: insertAttendance.timestamp,
      status: insertAttendance.status ?? 'present',
      absentReason: insertAttendance.absentReason ?? null,
      verifiedByAdmin: false,
    };
    this.attendances.set(id, att);
    return att;
  }

  async getAttendanceByDate(date: string): Promise<Attendance[]> {
    return Array.from(this.attendances.values()).filter(a => a.date === date);
  }

  async getAttendanceByUserAndDate(userId: string, date: string, mealType: string): Promise<Attendance | undefined> {
    return Array.from(this.attendances.values()).find(a => a.userId === userId && a.date === date && a.mealType === mealType);
  }

  async getSettings(): Promise<Settings> {
    return this.settingsConfig;
  }

  async updateSettings(updateData: Partial<Settings>): Promise<Settings> {
    this.settingsConfig = { ...this.settingsConfig, ...updateData };
    return this.settingsConfig;
  }

  async verifyAttendance(id: string, verified: boolean): Promise<Attendance | undefined> {
    const att = this.attendances.get(id);
    if (!att) return undefined;
    att.verifiedByAdmin = verified;
    this.attendances.set(id, att);
    return att;
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUserId(userId: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.userId, userId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error("DB not connected");
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getAllStudents(): Promise<User[]> {
    if (!db) return [];
    return await db.select().from(users).where(eq(users.role, "student"));
  }

  async markAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    if (!db) throw new Error("DB not connected");
    const [att] = await db.insert(attendance).values(insertAttendance).returning();
    return att;
  }

  async getAttendanceByDate(dateStr: string): Promise<Attendance[]> {
    if (!db) return [];
    return await db.select().from(attendance).where(eq(attendance.date, dateStr));
  }

  async getAttendanceByUserAndDate(userId: string, dateStr: string, mealType: string): Promise<Attendance | undefined> {
    if (!db) return undefined;
    const [att] = await db.select().from(attendance)
      .where(
        and(
          eq(attendance.userId, userId),
          eq(attendance.date, dateStr),
          eq(attendance.mealType, mealType)
        )
      );
    return att;
  }

  async getSettings(): Promise<Settings> {
    if (!db) return { id: 'default', breakfastStart: '06:00', breakfastEnd: '09:00', dinnerStart: '18:00', dinnerEnd: '22:00' };
    const [setting] = await db.select().from(settings).where(eq(settings.id, 'default'));
    if (!setting) {
      const [newSetting] = await db.insert(settings).values({ id: 'default' }).returning();
      return newSetting;
    }
    return setting;
  }

  async updateSettings(updateData: Partial<Settings>): Promise<Settings> {
    if (!db) throw new Error("DB not connected");
    await this.getSettings(); // ensure it exists
    const [updated] = await db.update(settings).set(updateData).where(eq(settings.id, 'default')).returning();
    return updated;
  }

  async verifyAttendance(id: string, verified: boolean): Promise<Attendance | undefined> {
    if (!db) return undefined;
    const [att] = await db.update(attendance).set({ verifiedByAdmin: verified }).where(eq(attendance.id, id)).returning();
    return att;
  }
}

// Auto-switch to Real DB if a string connection replaces to process.env.DATABASE_URL
export const storage = db ? new DatabaseStorage() : new MemStorage();
