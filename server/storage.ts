import { users, attendance, settings, leaveRequests, type User, type InsertUser, type Attendance, type InsertAttendance, type Settings, type LeaveRequest, type InsertLeaveRequest } from "../shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, lt, gte, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUserId(userId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUsersByIP(ip: string): Promise<User[]>;
  getUsersByFingerprint(fingerprint: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  deleteUnverifiedUsers(): Promise<number>;
  deleteExpiredPendingUsers(): Promise<number>;
  getAllStudents(status?: string): Promise<User[]>;
  getSuspiciousUsers(): Promise<User[]>;
  getActiveStudentCount(): Promise<number>;
  getMonthlyAttendance(monthYear: string): Promise<Attendance[]>;

  markAttendance(attendance: InsertAttendance): Promise<Attendance>;
  getAttendanceByDate(date: string): Promise<Attendance[]>;
  getOngoingAbsences(dateStr: string): Promise<Attendance[]>;
  getAttendanceByUserAndDate(userId: string, date: string, mealType: string): Promise<Attendance | undefined>;
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
  getAttendanceById(id: string): Promise<Attendance | undefined>;
  verifyAttendance(id: string, verified: boolean, sundayToken?: string | null): Promise<Attendance | undefined>;
  updateAttendance(id: string, data: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  deleteAttendance(id: string): Promise<boolean>;
  getMonthlyAbsentCount(userId: string, monthYear: string): Promise<number>;

  // Leave Requests
  createLeaveRequest(req: InsertLeaveRequest): Promise<LeaveRequest>;
  getAllLeaveRequests(): Promise<LeaveRequest[]>;
  getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]>;
  updateLeaveRequestStatus(id: string, status: string, adminNote?: string): Promise<LeaveRequest | undefined>;
  getPendingLeaveRequestForUser(userId: string, monthYear: string): Promise<LeaveRequest | undefined>;
  getApprovedLeaveByDate(dateStr: string): Promise<LeaveRequest[]>;
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
      email: "admin@hostel.com",
      password: "password123",
      fullName: "System Admin",
      phoneNumber: "0000000000",
      roomNumber: "N/A",
      hostelBlock: "Admin Block",
      role: "admin",
      isApproved: true,
      isVerified: true
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.phoneNumber === phoneNumber);
  }

  async getUsersByIP(ip: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.ipAddress === ip);
  }

  async getUsersByFingerprint(fingerprint: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.deviceFingerprint === fingerprint);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      email: insertUser.email,
      roomNumber: insertUser.roomNumber ?? null,
      hostelBlock: insertUser.hostelBlock ?? null,
      role: insertUser.role ?? "student",
      warnings: insertUser.warnings ?? 0,
      isVerified: insertUser.isVerified ?? false,
      otp: insertUser.otp ?? null,
      otpExpiry: insertUser.otpExpiry ?? null,
      isApproved: insertUser.isApproved ?? false,
      registrationDate: insertUser.registrationDate ?? new Date().toISOString(),
      status: insertUser.status ?? "Active",
      joiningMonthYear: insertUser.joiningMonthYear ?? null,
      leavingMonthYear: insertUser.leavingMonthYear ?? null,
      createdAt: new Date().toISOString(),
      ipAddress: insertUser.ipAddress ?? null,
      deviceFingerprint: insertUser.deviceFingerprint ?? null,
      suspiciousScore: insertUser.suspiciousScore ?? 0,
      isSuspicious: insertUser.isSuspicious ?? false,
      isBanned: insertUser.isBanned ?? false,
      failedLoginAttempts: insertUser.failedLoginAttempts ?? 0,
      lockUntil: insertUser.lockUntil ?? null,
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
      email: updateData.email ?? user.email,
      roomNumber: updateData.roomNumber ?? user.roomNumber,
      hostelBlock: updateData.hostelBlock ?? user.hostelBlock,
      role: updateData.role ?? user.role,
      warnings: updateData.warnings ?? user.warnings,
      isVerified: updateData.isVerified ?? user.isVerified,
      otp: updateData.otp ?? user.otp,
      otpExpiry: updateData.otpExpiry ?? user.otpExpiry,
      isApproved: updateData.isApproved ?? user.isApproved,
      registrationDate: updateData.registrationDate ?? user.registrationDate,
      status: updateData.status ?? user.status,
      joiningMonthYear: updateData.joiningMonthYear ?? user.joiningMonthYear,
      leavingMonthYear: updateData.leavingMonthYear ?? user.leavingMonthYear,
      ipAddress: updateData.ipAddress ?? user.ipAddress,
      deviceFingerprint: updateData.deviceFingerprint ?? user.deviceFingerprint,
      suspiciousScore: updateData.suspiciousScore ?? user.suspiciousScore,
      isSuspicious: updateData.isSuspicious ?? user.isSuspicious,
      isBanned: updateData.isBanned ?? user.isBanned,
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async deleteUnverifiedUsers(): Promise<number> {
    let count = 0;
    for (const [id, user] of Array.from(this.users.entries())) {
      if (user.role === "student" && !user.isVerified) {
        this.users.delete(id);
        count++;
      }
    }
    return count;
  }
  
  async deleteExpiredPendingUsers(): Promise<number> {
    let count = 0;
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    
    for (const [id, user] of Array.from(this.users.entries())) {
      if (user.role === "student" && !user.isApproved && user.registrationDate) {
        const regTime = new Date(user.registrationDate).getTime();
        if (now - regTime > fortyEightHours) {
          this.users.delete(id);
          count++;
        }
      }
    }
    return count;
  }

  async getAllStudents(status?: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.role === "student" && (!status || u.status === status))
      .sort((a, b) => {
        const roomCompare = (a.roomNumber || "").localeCompare(b.roomNumber || "", undefined, { numeric: true });
        if (roomCompare !== 0) return roomCompare;
        return (a.fullName || "").localeCompare(b.fullName || "");
      });
  }

  async getSuspiciousUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.isSuspicious || u.suspiciousScore > 5);
  }

  async getActiveStudentCount(): Promise<number> {
    return Array.from(this.users.values()).filter(u => u.role === "student" && u.status === "Active").length;
  }

  async getMonthlyAttendance(monthYear: string): Promise<Attendance[]> {
    return Array.from(this.attendances.values()).filter(a => a.date.startsWith(monthYear));
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

  async updateAttendance(id: string, data: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const att = this.attendances.get(id);
    if (!att) return undefined;
    const updated = { ...att, ...data };
    this.attendances.set(id, updated);
    return updated;
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

  async getApprovedLeaveByDate(dateStr: string): Promise<LeaveRequest[]> {
    return Array.from(this.leaveRequestsStore.values()).filter(lr => 
      lr.status === 'approved' && lr.startDate <= dateStr && lr.endDate >= dateStr
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return user;
  }

  async getUsersByIP(ip: string): Promise<User[]> {
    if (!db) return [];
    return await db.select().from(users).where(eq(users.ipAddress, ip));
  }

  async getUsersByFingerprint(fingerprint: string): Promise<User[]> {
    if (!db) return [];
    return await db.select().from(users).where(eq(users.deviceFingerprint, fingerprint));
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

  async deleteUnverifiedUsers(): Promise<number> {
    if (!db) return 0;
    const deletedUsers = await db.delete(users).where(
      and(eq(users.role, "student"), eq(users.isVerified, false))
    ).returning();
    return deletedUsers.length;
  }
  
  async deleteExpiredPendingUsers(): Promise<number> {
    if (!db) return 0;
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const deleted = await db.delete(users).where(
      and(
        eq(users.role, "student"),
        eq(users.isApproved, false),
        lt(users.registrationDate, fortyEightHoursAgo)
      )
    ).returning();
    
    return deleted.length;
  }

  async getActiveStudentCount(): Promise<number> {
    if (!db) return 0;
    const list = await db.select().from(users).where(and(eq(users.role, "student"), eq(users.status, "Active")));
    return list.length;
  }

  async getAllStudents(status?: string): Promise<User[]> {
    if (!db) return [];
    const condition = status 
      ? and(eq(users.role, "student"), eq(users.status, status))
      : eq(users.role, "student");
    const list = await db.select().from(users).where(condition);
    return list.sort((a, b) => {
      const roomCompare = (a.roomNumber || "").localeCompare(b.roomNumber || "", undefined, { numeric: true });
      if (roomCompare !== 0) return roomCompare;
      return (a.fullName || "").localeCompare(b.fullName || "");
    });
  }

  async getSuspiciousUsers(): Promise<User[]> {
    if (!db) return [];
    return await db.select().from(users).where(sql`${users.isSuspicious} = true OR ${users.suspiciousScore} > 5`);
  }

  async getMonthlyAttendance(monthYear: string): Promise<Attendance[]> {
    if (!db) return [];
    return await db.select().from(attendance).where(sql`${attendance.date} LIKE ${monthYear + '%'}`);
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

  async updateAttendance(id: string, data: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    if (!db) return undefined;
    const [att] = await db.update(attendance).set(data).where(eq(attendance.id, id)).returning();
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

  async getApprovedLeaveByDate(dateStr: string): Promise<LeaveRequest[]> {
    if (!db) return [];
    return await db.select().from(leaveRequests).where(
      and(
        eq(leaveRequests.status, 'approved'),
        sql`${leaveRequests.startDate} <= ${dateStr}`,
        sql`${leaveRequests.endDate} >= ${dateStr}`
      )
    );
  }
}

// Auto-switch to Real DB if a string connection replaces to process.env.DATABASE_URL
export const storage = db ? new DatabaseStorage() : new MemStorage();
