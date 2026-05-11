import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  setAuthCookie, 
  clearAuthCookie, 
  sendOTPEmail, 
  calculateSuspiciousScore,
  verifyCaptcha,
  authenticateToken,
} from "./auth_helpers";
import rateLimit from "express-rate-limit";

// Input Validation Schemas
const registrationSchema = z.object({
  fullName: z.string().min(3, "Name too short").max(50),
  email: z.string().email("Invalid email format"),
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  roomNumber: z.string().min(1, "Room number required"),
  hostelBlock: z.string().min(1, "Block required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  deviceFingerprint: z.string().optional(),
  captchaToken: z.string().min(1, "CAPTCHA verification required"),
});

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: "Too many attempts, please try again later." }
});

const regLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3,
  message: { message: "Registration limit reached for today (max 3 per IP)." }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  async function getMergedAttendance(dateStr: string) {
    const actual = await storage.getAttendanceByDate(dateStr);
    const ongoing = await storage.getOngoingAbsences(dateStr);
    const approvedLeave = await storage.getApprovedLeaveByDate(dateStr);

    const synthetic: any[] = [];
    ongoing.forEach(abs => {
      if (dateStr < (abs.returnDate || "")) {
        synthetic.push({ ...abs, id: abs.id + '-b', date: dateStr, mealType: 'breakfast' });
        synthetic.push({ ...abs, id: abs.id + '-d', date: dateStr, mealType: 'dinner' });
      } else if (dateStr === abs.returnDate && abs.returnMealType === 'dinner') {
        synthetic.push({ ...abs, id: abs.id + '-b', date: dateStr, mealType: 'breakfast' });
      }
    });

    approvedLeave.forEach(lr => {
      if (dateStr < lr.endDate) {
        synthetic.push({ userId: lr.userId, status: 'absent', absentReason: `Leave: ${lr.reason}`, id: lr.id + '-lb', date: dateStr, mealType: 'breakfast' });
        synthetic.push({ userId: lr.userId, status: 'absent', absentReason: `Leave: ${lr.reason}`, id: lr.id + '-ld', date: dateStr, mealType: 'dinner' });
      } else if (dateStr === lr.endDate) {
        if (lr.returnMealType === 'dinner') {
          synthetic.push({ userId: lr.userId, status: 'absent', absentReason: `Leave: ${lr.reason}`, id: lr.id + '-lb', date: dateStr, mealType: 'breakfast' });
        }
      }
    });

    const merged = [...synthetic];
    actual.forEach(att => {
      const idx = merged.findIndex(m => m.userId === att.userId && m.mealType === att.mealType);
      if (idx !== -1) merged.splice(idx, 1);
      merged.push(att);
    });
    return merged;
  }

  // --- Auth & Registration ---

  app.post("/api/register", regLimiter, async (req, res) => {
    try {
      // 1. Input Validation
      const validation = registrationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      
      const { fullName, phoneNumber, roomNumber, hostelBlock, email, password, deviceFingerprint, captchaToken } = validation.data;

      // 2. CAPTCHA Verification
      const isCaptchaValid = await verifyCaptcha(captchaToken);
      if (!isCaptchaValid) {
        return res.status(400).json({ message: "CAPTCHA verification failed. Please try again." });
      }

      // 3. Uniqueness Checks
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) return res.status(400).json({ message: "Email already registered." });

      const existingPhone = await storage.getUserByPhoneNumber(phoneNumber);
      if (existingPhone) return res.status(400).json({ message: "Phone number already registered." });

      // 4. User ID Generation
      const namePart = fullName.substring(0, 3).toUpperCase();
      const phonePart = phoneNumber.slice(-3);
      let userId = `${namePart}${phonePart}`;
      
      let collision = await storage.getUserByUserId(userId);
      let counter = 1;
      while (collision) {
        userId = `${namePart}${phonePart}${counter}`;
        collision = await storage.getUserByUserId(userId);
        counter++;
      }

      // 5. Suspicious Activity Scoring
      const ip = req.ip || req.headers['x-forwarded-for'] || "";
      const score = await calculateSuspiciousScore({ email, ip: String(ip), fingerprint: deviceFingerprint || "", phoneNumber });
      
      // 6. Security Prep
      const hashed = await hashPassword(password);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const activeCount = await storage.getActiveStudentCount();
      if (activeCount >= 150) {
        return res.status(400).json({ message: "Hostel is currently at full capacity (150 students)." });
      }

      // 7. Create Inactive Account
      const user = await storage.createUser({
        fullName,
        phoneNumber,
        roomNumber,
        hostelBlock,
        userId,
        password: hashed,
        email,
        otp,
        otpExpiry,
        isVerified: false,
        isApproved: false,
        isSuspicious: score > 5,
        suspiciousScore: score,
        ipAddress: String(ip),
        deviceFingerprint,
        registrationDate: new Date().toISOString(),
      });

      // 8. Send OTP
      await sendOTPEmail(email, otp);

      res.status(201).json({ 
        message: "Registration successful. Please check your email for the OTP.",
        userId: user.userId,
        email: user.email
      });
    } catch (e: any) {
      console.error("Registration error:", e);
      res.status(500).json({ message: e.message || "Error during registration." });
    }
  });

  app.post("/api/verify-otp", async (req, res) => {
    const { userId, otp } = req.body;
    const user = await storage.getUserByUserId(userId);

    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.isVerified) return res.status(400).json({ message: "Account already verified." });
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP code." });
    
    if (new Date(user.otpExpiry!) < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    await storage.updateUser(user.id, { isVerified: true, otp: null, otpExpiry: null });
    res.json({ message: "Email verified successfully. Please wait for admin approval." });
  });

  app.post("/api/resend-otp", authLimiter, async (req, res) => {
    const { userId } = req.body;
    const user = await storage.getUserByUserId(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await storage.updateUser(user.id, { otp, otpExpiry });
    await sendOTPEmail(user.email, otp);

    res.json({ message: "A new OTP has been sent to your email." });
  });

  app.post("/api/login", authLimiter, async (req, res) => {
    const { userId, password, role } = req.body;
    const user = await storage.getUserByUserId(userId);

    if (!user || user.role !== role) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (user.isBanned) return res.status(403).json({ message: "Your account is banned." });

    // Check Lockout
    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 60000);
      return res.status(403).json({ message: `Account locked due to multiple failed attempts. Try again in ${waitMinutes} minutes.` });
    }

    // Password check — supports legacy plaintext passwords and auto-migrates to bcrypt
    const isHashed = user.password.startsWith("$2a$") || user.password.startsWith("$2b$");
    let match = false;
    
    if (isHashed) {
      match = await comparePassword(password, user.password);
    } else {
      // Legacy plaintext password — direct comparison + auto-migrate
      match = (password === user.password);
      if (match) {
        const hashed = await hashPassword(password);
        await storage.updateUser(user.id, { password: hashed });
      }
    }

    if (!match) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updateData: any = { failedLoginAttempts: attempts };
      
      if (attempts >= 5) {
        updateData.lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins lock
        updateData.failedLoginAttempts = 0;
      }
      
      await storage.updateUser(user.id, updateData);
      return res.status(401).json({ message: attempts >= 5 ? "Too many failed attempts. Account locked for 15 minutes." : "Invalid credentials." });
    }

    // Reset failed attempts on success
    if (user.failedLoginAttempts > 0) {
      await storage.updateUser(user.id, { failedLoginAttempts: 0, lockUntil: null });
    }

    if (!user.isVerified && user.role === 'student') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await storage.updateUser(user.id, { otp, otpExpiry });
      try {
        await sendOTPEmail(user.email, otp);
      } catch (e) {
        console.error("Failed to send migration OTP:", e);
      }
      return res.status(403).json({ 
        message: "Email verification required. We've sent a code to your email.", 
        needsVerification: true,
        userId: user.userId,
        email: user.email
      });
    }

    if (!user.isApproved) {
      return res.status(401).json({ message: "Your account is pending admin approval." });
    }

    if (user.role === 'student' && user.status !== 'Active') {
      return res.status(401).json({ message: `Access denied. Status: ${user.status}.` });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.json({ 
      id: user.id, 
      userId: user.userId, 
      fullName: user.fullName, 
      role: user.role,
      status: user.status 
    });
  });


  app.post("/api/logout", (req, res) => {
    clearAuthCookie(res);
    res.json({ message: "Logged out." });
  });

  app.get("/api/me", authenticateToken, (req, res) => {
    res.json((req as any).user);
  });

  // --- Admin User Management ---

  app.get("/api/admin/suspicious-accounts", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const users = await storage.getSuspiciousUsers();
    res.json(users);
  });

  app.post("/api/admin/ban-user/:id", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const id = req.params.id as string;
    await storage.updateUser(id, { isBanned: true });
    res.json({ message: "User banned successfully." });
  });

  app.post("/api/admin/unban-user/:id", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const id = req.params.id as string;
    await storage.updateUser(id, { isBanned: false });
    res.json({ message: "User unbanned successfully." });
  });

  // --- Settings ---

  app.get("/api/settings", async (req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.post("/api/settings", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    try {
      const s = await storage.updateSettings(req.body);
      res.json(s);
    } catch {
      res.status(500).json({ message: "Failed to update settings." });
    }
  });

  // --- Attendance ---

  app.get("/api/attendance/today", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId required" });
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayStr = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0') + '-' + String(nowIST.getDate()).padStart(2, '0');
    
    const tomorrow = new Date(nowIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    const [todayAtt, tomAtt] = await Promise.all([
      getMergedAttendance(todayStr),
      getMergedAttendance(tomStr)
    ]);

    const userAttendance = [
      ...todayAtt.filter((a: any) => a.userId === String(userId) && a.mealType === 'dinner'),
      ...tomAtt.filter((a: any) => a.userId === String(userId) && a.mealType === 'breakfast')
    ];
    res.json(userAttendance);
  });

  app.get("/api/attendance/sunday-token", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId required" });
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const d = nowIST.getDay();
    if (d === 0) { // Sunday
      if (nowIST.getHours() >= 13) return res.json({ token: null });
      const targetDate = new Date(nowIST);
      targetDate.setDate(targetDate.getDate() - 1);
      const dateStr = targetDate.getFullYear() + '-' + String(targetDate.getMonth() + 1).padStart(2, '0') + '-' + String(targetDate.getDate()).padStart(2, '0');
      const att = await storage.getAttendanceByUserAndDate(String(userId), dateStr, 'dinner');
      return res.json({ token: att?.sundayToken || null });
    } else if (d === 6) { // Saturday
      const dateStr = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0') + '-' + String(nowIST.getDate()).padStart(2, '0');
      const att = await storage.getAttendanceByUserAndDate(String(userId), dateStr, 'dinner');
      return res.json({ token: att?.sundayToken || null });
    }
    res.json({ token: null });
  });

  app.post("/api/attendance", authenticateToken, async (req, res) => {
    const { status, absentReason, returnDate, returnMealType, selectedMealType } = req.body;
    const user = (req as any).user;

    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();
    const todayStr = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0') + '-' + String(nowIST.getDate()).padStart(2, '0');
    
    const tomorrow = new Date(nowIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    const s = await storage.getSettings();
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const inWindow = (start: string, end: string) => {
      const s2 = toMin(start), e2 = toMin(end);
      return e2 < s2 ? (currentMinutes >= s2 || currentMinutes <= e2) : (currentMinutes >= s2 && currentMinutes <= e2);
    };

    let timeBoxedMeal = "";
    if (inWindow(s.breakfastStart, s.breakfastEnd)) timeBoxedMeal = "breakfast";
    else if (inWindow(s.dinnerStart, s.dinnerEnd)) timeBoxedMeal = "dinner";

    let mealType = selectedMealType || timeBoxedMeal;

    if (status === "present") {
      if (!timeBoxedMeal) return res.status(400).json({ message: "Outside attendance windows." });
      if (selectedMealType && selectedMealType !== timeBoxedMeal) return res.status(400).json({ message: "Active window mismatch." });
      mealType = timeBoxedMeal;
    } else if (status === "absent") {
      if (!mealType || !absentReason || !returnDate || !returnMealType) return res.status(400).json({ message: "Missing absent details." });
    }

    const targetDateStr = (mealType === 'breakfast') ? tomStr : todayStr;
    const existing = await storage.getAttendanceByUserAndDate(user.userId, targetDateStr, mealType);
    if (existing) return res.status(400).json({ message: "Already marked attendance." });

    const att = await storage.markAttendance({
      userId: user.userId,
      date: targetDateStr,
      mealType,
      timestamp: new Date().toISOString(),
      status: status || "present",
      absentReason: absentReason || null,
      returnDate: returnDate || null,
      returnMealType: returnMealType || null
    });

    res.status(201).json(att);
  });

  // --- Admin Attendance ---

  app.post("/api/admin/verify-attendance", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const { id, verifiedByAdmin } = req.body;
    const attRec = await storage.getAttendanceById(id);
    if (!attRec) return res.status(404).json({ message: "Attendance not found" });

    let sundayToken = undefined;
    if (verifiedByAdmin && attRec.status === 'present' && attRec.mealType === 'dinner') {
      const parts = attRec.date.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (dateObj.getDay() === 6) { // Saturday
          const allDinners = await storage.getAttendanceByDate(attRec.date);
          const presents = allDinners.filter(a => a.mealType === 'dinner' && a.status === 'present');
          presents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const rank = presents.findIndex(a => a.id === attRec.id) + 1;
          const sundayDate = new Date(dateObj);
          sundayDate.setDate(sundayDate.getDate() + 1);
          const sunDateStr = sundayDate.getFullYear() + '-' + String(sundayDate.getMonth() + 1).padStart(2, '0') + '-' + String(sundayDate.getDate()).padStart(2, '0');
          sundayToken = rank > 0 ? `${String(rank).padStart(2, '0')}:${sunDateStr}` : `00:${sunDateStr}`;
        }
      }
    } else if (!verifiedByAdmin) {
      sundayToken = null;
    }

    const att = await storage.verifyAttendance(id, verifiedByAdmin, sundayToken);
    res.json(att);
  });

  app.delete("/api/admin/delete-student/:id", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const id = req.params.id as string;
    const student = await storage.getUser(id);
    if (!student) return res.status(404).json({ message: "Student not found." });
    
    if (!student.isApproved) {
      await storage.deleteUser(id);
      return res.json({ message: "Rejected and removed." });
    } else {
      const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const leaveMonthYear = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0');
      await storage.updateUser(id, { status: 'Left Hostel', leavingMonthYear: leaveMonthYear });
      return res.json({ message: "Marked as Left." });
    }
  });

  app.post("/api/admin/update-student-status/:id", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const id = req.params.id as string;
    const { status } = req.body;
    const updateData: any = { status };
    if (status === 'Left Hostel') {
      const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      updateData.leavingMonthYear = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0');
    } else if (status === 'Active') {
      updateData.leavingMonthYear = null;
    }
    const updated = await storage.updateUser(id, updateData);
    res.json(updated);
  });

  app.post("/api/admin/approve-user/:id", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const id = req.params.id as string;
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const joiningMonthYear = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0');
    const updated = await storage.updateUser(id, { isApproved: true, status: 'Active', joiningMonthYear });
    res.json(updated);
  });

  app.post("/api/admin/warn-student", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const { userId } = req.body;
    const user = await storage.getUserByUserId(userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    const updated = await storage.updateUser(user.id, { warnings: (user.warnings || 0) + 1 });
    res.json(updated);
  });

  app.post("/api/admin/remove-warning", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const { userId } = req.body;
    const user = await storage.getUserByUserId(userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    const updated = await storage.updateUser(user.id, { warnings: Math.max(0, (user.warnings || 0) - 1) });
    res.json(updated);
  });

  app.post("/api/admin/cancel-absence", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const { id, markPresent } = req.body;
    const att = await storage.getAttendanceById(id);
    if (!att) return res.status(404).json({ message: "Not found" });
    if (markPresent) {
      await storage.verifyAttendance(id, true);
      await storage.updateAttendance(id, { status: 'present', absentReason: null, returnDate: null, returnMealType: null });
    } else {
      await storage.deleteAttendance(id);
    }
    res.json({ message: "Success" });
  });

  // --- Leave Requests ---

  app.post("/api/leave-request", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const { reason, startDate, endDate, returnMealType } = req.body;
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const monthYear = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0');
    const existing = await storage.getPendingLeaveRequestForUser(user.userId, monthYear);
    if (existing) return res.status(400).json({ message: "Pending request exists." });
    const lr = await storage.createLeaveRequest({ userId: user.userId, reason, startDate, endDate, returnMealType, monthYear, timestamp: new Date().toISOString() });
    res.status(201).json(lr);
  });

  app.get("/api/leave-request", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const requests = await storage.getLeaveRequestsByUser(user.userId);
    res.json(requests);
  });

  app.get("/api/admin/leave-requests", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const requests = await storage.getAllLeaveRequests();
    res.json(requests);
  });

  app.post("/api/admin/process-leave/:id", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const id = req.params.id as string;
    const { status, adminNote } = req.body;
    const lr = await storage.updateLeaveRequestStatus(id, status, adminNote);
    res.json(lr);
  });

  // --- Dashboard Data ---

  app.get("/api/admin/dashboard", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    await storage.deleteExpiredPendingUsers();
    const students = await storage.getAllStudents();
    const activeStudents = students.filter(s => s.status === 'Active' && s.isApproved);
    const leftStudents = students.filter(s => s.status === 'Left Hostel');
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dateStr = req.query.date ? String(req.query.date) : nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0') + '-' + String(nowIST.getDate()).padStart(2, '0');
    const todayAttendance = await getMergedAttendance(dateStr);

    let sundayTokens: Record<string, string> = {};
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (dateObj.getDay() === 0 && nowIST.getHours() < 13) {
        dateObj.setDate(dateObj.getDate() - 1);
        const prevDateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
        const prevAtt = await storage.getAttendanceByDate(prevDateStr);
        prevAtt.forEach(a => { if (a.mealType === 'dinner' && a.sundayToken) sundayTokens[a.userId] = a.sundayToken; });
      } else if (dateObj.getDay() === 6) {
        todayAttendance.forEach(a => { if (a.mealType === 'dinner' && a.sundayToken) sundayTokens[a.userId] = a.sundayToken; });
      }
    }

    res.json({ date: dateStr, students, stats: { totalActive: activeStudents.length, totalLeft: leftStudents.length, availableSeats: 150 - activeStudents.length }, attendances: todayAttendance, sundayTokens });
  });

  app.get("/api/admin/monthly-data", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    const monthYear = String(req.query.monthYear);
    const students = await storage.getAllStudents();
    const approvedStudents = students.filter(s => s.isApproved);
    const monthlyAttendance = await storage.getMonthlyAttendance(monthYear);
    const leaveRequests = await storage.getAllLeaveRequests();
    res.json({ students: approvedStudents, attendance: monthlyAttendance, leaveRequests: leaveRequests.filter(lr => lr.status === 'approved' && lr.monthYear === monthYear) });
  });

  app.post("/api/change-password", authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = (req as any).user;
    const match = await comparePassword(currentPassword, user.password);
    if (!match) return res.status(401).json({ message: "Invalid current password." });
    const hashed = await hashPassword(newPassword);
    await storage.updateUser(user.id, { password: hashed });
    res.json({ message: "Success" });
  });

  return httpServer;
}
