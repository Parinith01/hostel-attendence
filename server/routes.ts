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

    // Strict mock checking:
    if (!user || user.password !== password || user.role !== role) {
      return res.status(401).json({ message: "Invalid credentials or portal selection." });
    }

    res.json(user);
  });

  app.post("/api/attendance", async (req, res) => {
    const { userId } = req.body;
    const user = await storage.getUserByUserId(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const now = new Date();
    const hourStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const s = await storage.getSettings();

    let mealType = "";
    if (hourStr >= s.breakfastStart && hourStr <= s.breakfastEnd) {
      mealType = "breakfast";
    } else if (hourStr >= s.dinnerStart && hourStr <= s.dinnerEnd) {
      mealType = "dinner";
    } else {
      return res.status(400).json({ message: `Outside attendance windows (Breakfast: ${s.breakfastStart}-${s.breakfastEnd} / Dinner: ${s.dinnerStart}-${s.dinnerEnd}).` });
    }

    const dateStr = now.toISOString().split('T')[0];
    const existing = await storage.getAttendanceByUserAndDate(userId, dateStr, mealType);
    if (existing) {
      return res.status(400).json({ message: `Already marked attendance for ${mealType} today.` });
    }

    const att = await storage.markAttendance({
      userId,
      date: dateStr,
      mealType,
      timestamp: now.toISOString()
    });

    res.status(201).json({
      ...att,
      message: `Successfully marked ${mealType} attendance.`
    });
  });

  app.get("/api/admin/dashboard", async (req, res) => {
    const students = await storage.getAllStudents();
    const now = new Date();
    const dateStr = req.query.date ? String(req.query.date) : now.toISOString().split('T')[0];
    const todayAttendance = await storage.getAttendanceByDate(dateStr);

    res.json({
      date: dateStr,
      students,
      attendances: todayAttendance
    });
  });

  return httpServer;
}
