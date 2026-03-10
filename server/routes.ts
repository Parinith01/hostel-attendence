import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/settings", async (req, res) => {
    const s = await storage.getSettings();
    res.json(s);
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
    const att = await storage.verifyAttendance(id, verifiedByAdmin);
    if (!att) return res.status(404).json({ message: "Attendance not found" });
    res.json(att);
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
    const { userId, status, absentReason, selectedMealType } = req.body;
    const user = await storage.getUserByUserId(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Always use IST since admins configure time slots in Indian time
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();
    const dateStr = nowIST.getFullYear() + '-' +
      String(nowIST.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowIST.getDate()).padStart(2, '0');

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
    }

    if (status === "absent" && !absentReason) {
      return res.status(400).json({ message: "Must provide a reason when marking absent." });
    }

    const existing = await storage.getAttendanceByUserAndDate(userId, dateStr, mealType);
    if (existing) {
      return res.status(400).json({ message: `Already marked attendance for ${mealType} today.` });
    }

    const att = await storage.markAttendance({
      userId,
      date: dateStr,
      mealType,
      timestamp: new Date().toISOString(),
      status: status || "present",
      absentReason: absentReason || null
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
    const todayAttendance = await storage.getAttendanceByDate(dateStr);

    res.json({
      date: dateStr,
      students,
      attendances: todayAttendance
    });
  });

  return httpServer;
}
