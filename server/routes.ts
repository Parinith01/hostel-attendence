import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
    const hour = now.getHours();

    let mealType = "";
    if (hour >= 6 && hour < 9) {
      mealType = "breakfast";
    } else if (hour >= 18 && hour < 22) {
      mealType = "dinner";
    } else {
      return res.status(400).json({ message: "Outside attendance windows (6AM-9AM / 6PM-10PM)." });
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
