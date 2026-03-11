import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  async function getMergedAttendance(dateStr: string) {
    const actual = await storage.getAttendanceByDate(dateStr);
    const ongoing = await storage.getOngoingAbsences(dateStr);

    const synthetic: any[] = [];
    ongoing.forEach(abs => {
      if (dateStr < (abs.returnDate || "")) {
        synthetic.push({ ...abs, id: abs.id + '-b', date: dateStr, mealType: 'breakfast' });
        synthetic.push({ ...abs, id: abs.id + '-d', date: dateStr, mealType: 'dinner' });
      } else if (dateStr === abs.returnDate && abs.returnMealType === 'dinner') {
        synthetic.push({ ...abs, id: abs.id + '-b', date: dateStr, mealType: 'breakfast' });
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

  app.get("/api/settings", async (req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.get("/api/attendance/today", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId required" });
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayStr = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0') + '-' + String(nowIST.getDate()).padStart(2, '0');
    
    // Calculate tomorrow's date string
    const tomorrow = new Date(nowIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    // Get dinner for today and breakfast for tomorrow (both merged with ongoing absences)
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
      // Expire token strictly at 1:00 PM (13:00) on Sunday
      if (nowIST.getHours() >= 13) {
        return res.json({ token: null });
      }
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

  app.post("/api/settings", async (req, res) => {
    try {
      const s = await storage.updateSettings(req.body);
      res.json(s);
    } catch {
      res.status(500).json({ message: "Failed to update settings." });
    }
  });

  app.post("/api/admin/verify-attendance", async (req, res) => {
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
          
          // Generate a unique token for this specific Sunday
          // Format: Rank:SundayDate (e.g., 01:2025-03-16)
          const sundayDate = new Date(dateObj);
          sundayDate.setDate(sundayDate.getDate() + 1);
          const sunDateStr = sundayDate.getFullYear() + '-' + String(sundayDate.getMonth() + 1).padStart(2, '0') + '-' + String(sundayDate.getDate()).padStart(2, '0');
          
          sundayToken = rank > 0 ? `${String(rank).padStart(2, '0')}:${sunDateStr}` : `00:${sunDateStr}`;
        }
      }
    } else if (!verifiedByAdmin) {
      sundayToken = null; // Clear if not verified
    }

    const att = await storage.verifyAttendance(id, verifiedByAdmin, sundayToken);
    res.json(att);
  });

  app.delete("/api/admin/students/:id", async (req, res) => {
    const { id } = req.params;
    const deleted = await storage.deleteUser(id);
    if (!deleted) return res.status(404).json({ message: "Student not found." });
    res.json({ message: "Student removed successfully." });
  });

  // Admin: Cancel/remove an absence record so student can re-vote
  app.delete("/api/admin/attendance/:id", async (req, res) => {
    const { id } = req.params;
    const att = await storage.getAttendanceById(id);
    if (!att) return res.status(404).json({ message: "Attendance record not found." });
    if (att.status !== 'absent') return res.status(400).json({ message: "Can only cancel absent records." });
    const deleted = await storage.deleteAttendance(id);
    if (!deleted) return res.status(500).json({ message: "Failed to remove attendance record." });
    res.json({ message: "Absence record removed. Student can now re-vote." });
  });

  // Admin: Directly mark a student present (bypasses time window, for special cases)
  app.post("/api/admin/mark-present", async (req, res) => {
    const { userId, mealType, date } = req.body;
    if (!userId || !mealType || !date) return res.status(400).json({ message: "userId, mealType and date are required." });
    const user = await storage.getUserByUserId(userId);
    if (!user) return res.status(404).json({ message: "Student not found." });
    const existing = await storage.getAttendanceByUserAndDate(userId, date, mealType);
    if (existing) return res.status(400).json({ message: "Attendance already exists for this meal." });
    const att = await storage.markAttendance({
      userId, date, mealType,
      timestamp: new Date().toISOString(),
      status: 'present',
      absentReason: null, returnDate: null, returnMealType: null
    });
    res.status(201).json(att);
  });

  app.post("/api/register", async (req, res) => {
    try {
      const existingUser = await storage.getUserByUserId(req.body.userId);
      if (existingUser) {
        return res.status(400).json({ message: "User ID already exists." });
      }
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (e) {
      res.status(500).json({ message: "Error during registration." });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { userId, password, role } = req.body;
    const user = await storage.getUserByUserId(userId);

    if (!user || user.password !== password || user.role !== role) {
      return res.status(401).json({ message: "Invalid credentials or portal selection." });
    }

    res.json(user);
  });

  app.post("/api/attendance", async (req, res) => {
    const { userId, status, absentReason, returnDate, returnMealType, selectedMealType } = req.body;
    const user = await storage.getUserByUserId(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Always use IST since admins configure time slots in Indian time
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();
    
    // Today's date string
    const todayStr = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0') + '-' + String(nowIST.getDate()).padStart(2, '0');
    
    // Tomorrow's date string
    const tomorrow = new Date(nowIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    const s = await storage.getSettings();

    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const inWindow = (start: string, end: string) => {
      const s2 = toMin(start), e2 = toMin(end);
      return e2 < s2
        ? (currentMinutes >= s2 || currentMinutes <= e2)  // crosses midnight
        : (currentMinutes >= s2 && currentMinutes <= e2);
    };

    let timeBoxedMeal = "";
    if (inWindow(s.breakfastStart, s.breakfastEnd)) {
      timeBoxedMeal = "breakfast";
    } else if (inWindow(s.dinnerStart, s.dinnerEnd)) {
      timeBoxedMeal = "dinner";
    }

    let mealType = selectedMealType || timeBoxedMeal;

    if (status === "present") {
      if (!timeBoxedMeal) {
        return res.status(400).json({ message: `Outside attendance windows (Breakfast: ${s.breakfastStart}-${s.breakfastEnd} / Dinner: ${s.dinnerStart}-${s.dinnerEnd}).` });
      }
      if (selectedMealType && selectedMealType !== timeBoxedMeal) {
        return res.status(400).json({ message: `You can only mark present for the active meal window.` });
      }
      mealType = timeBoxedMeal;
    } else if (status === "absent") {
      if (!mealType) {
        return res.status(400).json({ message: "Must select a meal type when marking absent." });
      }
      if (!absentReason) {
        return res.status(400).json({ message: "Must provide a reason when marking absent." });
      }
      if (!returnDate) {
        return res.status(400).json({ message: "Must provide a return date when marking absent." });
      }
      if (!returnMealType) {
        return res.status(400).json({ message: "Must specify the return meal (breakfast or dinner)." });
      }
    }

    // TARGET DATE LOGIC: 
    // Breakfast window is for TOMORROW'S breakfast.
    // Dinner window is for TODAY'S dinner.
    const targetDateStr = (mealType === 'breakfast') ? tomStr : todayStr;

    const existing = await storage.getAttendanceByUserAndDate(userId, targetDateStr, mealType);
    if (existing) {
      return res.status(400).json({ message: `Already marked attendance for ${mealType === 'breakfast' ? "tomorrow's" : "today's"} ${mealType}.` });
    }

    const att = await storage.markAttendance({
      userId,
      date: targetDateStr,
      mealType,
      timestamp: new Date().toISOString(),
      status: status || "present",
      absentReason: absentReason || null,
      returnDate: returnDate || null,
      returnMealType: returnMealType || null
    });

    res.status(201).json({
      ...att,
      message: `Successfully marked ${mealType} as ${status || "present"}.`
    });
  });

  app.get("/api/admin/dashboard", async (req, res) => {
    const students = await storage.getAllStudents();
    // Use IST date for admin dashboard too
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dateStr = req.query.date
      ? String(req.query.date)
      : nowIST.getFullYear() + '-' +
      String(nowIST.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowIST.getDate()).padStart(2, '0');
    const todayAttendance = await getMergedAttendance(dateStr);

    let sundayTokens: Record<string, string> = {};
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (dateObj.getDay() === 0) { // Sunday
        // Expire tokens strictly at 1:00 PM (13:00) on Sunday for admin view too
        if (nowIST.getHours() < 13) {
          dateObj.setDate(dateObj.getDate() - 1); // Get Saturday
          const prevDateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
          const prevAtt = await storage.getAttendanceByDate(prevDateStr);
          prevAtt.forEach(a => {
            if (a.mealType === 'dinner' && a.sundayToken) {
              sundayTokens[a.userId] = a.sundayToken;
            }
          });
        }
      } else if (dateObj.getDay() === 6) { // Saturday
        todayAttendance.forEach(a => {
          if (a.mealType === 'dinner' && a.sundayToken) {
            sundayTokens[a.userId] = a.sundayToken;
          }
        });
      }
    }

    res.json({
      date: dateStr,
      students,
      attendances: todayAttendance,
      sundayTokens,
    });
  });

  return httpServer;
}
