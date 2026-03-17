import { users, attendance, settings, leaveRequests, type User, type InsertUser, type Attendance, type InsertAttendance, type Settings, type LeaveRequest, type InsertLeaveRequest } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, lt, gte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUserId(userId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllStudents(): Promise<User[]>;

  markAttendance(attendance: InsertAttendance): Promise<Attendance>;
  getAttendanceByDate(date: string): Promise<Attendance[]>;
  getOngoingAbsences(dateStr: string): Promise<Attendance[]>;
  getAttendanceByUserAndDate(userId: string, date: string, mealType: string): Promise<Attendance | undefined>;
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
  getAttendanceById(id: string): Promise<Attendance | undefined>;
  verifyAttendance(id: string, verified: boolean, sundayToken?: string | null): Promise<Attendance | undefined>;
  deleteAttendance(id: string): Promise<boolean>;
  getMonthlyAbsentCount(userId: string, monthYear: string): Promise<number>;

  // Leave Requests
  createLeaveRequest(req: InsertLeaveRequest): Promise<LeaveRequest>;
  getAllLeaveRequests(): Promise<LeaveRequest[]>;
  getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]>;
  updateLeaveRequestStatus(id: string, status: string, adminNote?: string): Promise<LeaveRequest | undefined>;
  getPendingLeaveRequestForUser(userId: string, monthYear: string): Promise<LeaveRequest | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private attendances: Map<string, Attendance>;
  private settingsConfig: Settings;
  private leaveRequestsStore: Map<string, LeaveRequest>;

  constructor() {
    this.users = new Map();
    this.attendances = new Map();
    this.leaveRequestsStore = new Map();
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
    return Array.from(this.users.values())
      .filter(u => u.role === "student")
      .sort((a, b) => {
        const roomCompare = (a.roomNumber || "").localeCompare(b.roomNumber || "", undefined, { numeric: true });
        if (roomCompare !== 0) return roomCompare;
        return (a.fullName || "").localeCompare(b.fullName || "");
      });
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
      returnDate: insertAttendance.returnDate ?? null,
      returnMealType: insertAttendance.returnMealType ?? null,
      sundayToken: insertAttendance.sundayToken ?? null,
      verifiedByAdmin: false,
    };
    this.attendances.set(id, att);
    return att;
  }

  async getAttendanceByDate(date: string): Promise<Attendance[]> {
    return Array.from(this.attendances.values()).filter(a => a.date === date);
  }

  async getOngoingAbsences(dateStr: string): Promise<Attendance[]> {
    return Array.from(this.attendances.values()).filter(a => {
      if (a.status !== 'absent' || !a.returnDate || !a.returnMealType) return false;
      if (a.date >= dateStr) return false;
      return a.returnDate >= dateStr;
    });
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

  async getAttendanceById(id: string): Promise<Attendance | undefined> {
    return this.attendances.get(id);
  }

  async verifyAttendance(id: string, verified: boolean, sundayToken?: string | null): Promise<Attendance | undefined> {
    const att = this.attendances.get(id);
    if (!att) return undefined;
    att.verifiedByAdmin = verified;
    if (sundayToken !== undefined) {
      if (sundayToken === null) att.sundayToken = null;
      else att.sundayToken = sundayToken;
    }
    this.attendances.set(id, att);
    return att;
  }

  async deleteAttendance(id: string): Promise<boolean> {
    return this.attendances.delete(id);
  }

  async getMonthlyAbsentCount(userId: string, monthYear: string): Promise<number> {
    return Array.from(this.attendances.values()).filter(a =>
      a.userId === userId && a.status === 'absent' && a.date.startsWith(monthYear)
    ).length;
  }

  async createLeaveRequest(req: InsertLeaveRequest): Promise<LeaveRequest> {
    const id = randomUUID();
    const lr: LeaveRequest = {
      id,
      userId: req.userId,
      reason: req.reason,
      startDate: req.startDate,
      endDate: req.endDate,
      returnMealType: req.returnMealType,
      status: 'pending',
      adminNote: null,
      timestamp: req.timestamp,
      monthYear: req.monthYear,
    };
    this.leaveRequestsStore.set(id, lr);
    return lr;
  }

  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    return Array.from(this.leaveRequestsStore.values()).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]> {
    return Array.from(this.leaveRequestsStore.values())
      .filter(lr => lr.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async updateLeaveRequestStatus(id: string, status: string, adminNote?: string): Promise<LeaveRequest | undefined> {
    const lr = this.leaveRequestsStore.get(id);
    if (!lr) return undefined;
    const updated = { ...lr, status, adminNote: adminNote ?? lr.adminNote };
    this.leaveRequestsStore.set(id, updated);
    return updated;
  }

  async getPendingLeaveRequestForUser(userId: string, monthYear: string): Promise<LeaveRequest | undefined> {
    return Array.from(this.leaveRequestsStore.values()).find(
      lr => lr.userId === userId && lr.monthYear === monthYear && lr.status === 'pending'
    );
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
    // Fetch all and sort in memory for natural alphanumeric sorting (Drizzle's order by is strictly lexical)
    const list = await db.select().from(users).where(eq(users.role, "student"));
    return list.sort((a, b) => {
      const roomCompare = (a.roomNumber || "").localeCompare(b.roomNumber || "", undefined, { numeric: true });
      if (roomCompare !== 0) return roomCompare;
      return (a.fullName || "").localeCompare(b.fullName || "");
    });
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

  async getOngoingAbsences(dateStr: string): Promise<Attendance[]> {
    if (!db) return [];
    const allAbsences = await db.select().from(attendance)
      .where(and(
        eq(attendance.status, 'absent'),
        lt(attendance.date, dateStr),
        gte(attendance.returnDate, dateStr)
      ));
    return allAbsences;
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

  async verifyAttendance(id: string, verified: boolean, sundayToken?: string | null): Promise<Attendance | undefined> {
    if (!db) return undefined;
    const updateData: any = { verifiedByAdmin: verified };
    if (sundayToken !== undefined) {
      updateData.sundayToken = sundayToken;
    }
    const [att] = await db.update(attendance).set(updateData).where(eq(attendance.id, id)).returning();
    return att;
  }

  async getAttendanceById(id: string): Promise<Attendance | undefined> {
    if (!db) return undefined;
    const [att] = await db.select().from(attendance).where(eq(attendance.id, id));
    return att;
  }
  async deleteAttendance(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(attendance).where(eq(attendance.id, id));
    return true;
  }

  async getMonthlyAbsentCount(userId: string, monthYear: string): Promise<number> {
    if (!db) return 0;
    // Count distinct absence records where date starts with monthYear
    const rows = await db.select().from(attendance).where(
      and(eq(attendance.userId, userId), eq(attendance.status, 'absent'))
    );
    return rows.filter(r => r.date.startsWith(monthYear)).length;
  }

  async createLeaveRequest(req: InsertLeaveRequest): Promise<LeaveRequest> {
    if (!db) throw new Error("DB not connected");
    const [lr] = await db.insert(leaveRequests).values(req).returning();
    return lr;
  }

  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    if (!db) return [];
    const rows = await db.select().from(leaveRequests);
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]> {
    if (!db) return [];
    const rows = await db.select().from(leaveRequests).where(eq(leaveRequests.userId, userId));
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async updateLeaveRequestStatus(id: string, status: string, adminNote?: string): Promise<LeaveRequest | undefined> {
    if (!db) return undefined;
    const updateData: any = { status };
    if (adminNote !== undefined) updateData.adminNote = adminNote;
    const [lr] = await db.update(leaveRequests).set(updateData).where(eq(leaveRequests.id, id)).returning();
    return lr;
  }

  async getPendingLeaveRequestForUser(userId: string, monthYear: string): Promise<LeaveRequest | undefined> {
    if (!db) return undefined;
    const [lr] = await db.select().from(leaveRequests).where(
      and(eq(leaveRequests.userId, userId), eq(leaveRequests.monthYear, monthYear), eq(leaveRequests.status, 'pending'))
    );
    return lr;
  }
}

// Auto-switch to Real DB if a string connection replaces to process.env.DATABASE_URL
export const storage = db ? new DatabaseStorage() : new MemStorage();
