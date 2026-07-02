import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { type Response, type Request, type NextFunction } from "express";
import { storage } from "./storage";
import nodemailer from "nodemailer";
import { type User } from "../shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "hostel-attendance-secret-key-2024";
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Disposable email domains (expanded)
const DISPOSABLE_DOMAINS = [
  "mailinator.com", "yopmail.com", "tempmail.com", "guerrillamail.com", 
  "sharklasers.com", "10minutemail.com", "trashmail.com", "dispostable.com",
  "getnada.com", "maildrop.cc", "mail-temporaire.fr", "temp-mail.org"
];

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
}

export async function verifyCaptcha(token: string): Promise<boolean> {
  // In production, use your secret key from environment variables
  const secret = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA"; // Testing secret
  
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token })
    });
    const data = await response.json();
    return data.success;
  } catch (err) {
    console.error("Captcha verification failed:", err);
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateToken(user: User): string {
  return jwt.sign({ id: user.id, userId: user.userId, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie("token");
}

export async function sendOTPEmail(email: string, otp: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Hostel Management" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your Verification Code: ${otp}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; background-color: #0f172a; color: #f8fafc; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 40px 20px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 28px; letter-spacing: 1px; text-transform: uppercase;">Hostel Security</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #38bdf8; margin-top: 0;">Verification Required</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #94a3b8;">Welcome to the Hostel Attendance System. To secure your account, please use the following One-Time Password (OTP) to complete your action. This code will expire in <b>5 minutes</b>.</p>
          
          <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #334155; padding: 30px; text-align: center; border-radius: 16px; margin: 30px 0;">
            <span style="font-size: 42px; font-weight: 800; letter-spacing: 8px; color: #06b6d4; text-shadow: 0 0 10px rgba(6, 182, 212, 0.3);">${otp}</span>
          </div>
          
          <p style="font-size: 14px; color: #64748b; text-align: center;">If you did not request this code, please secure your account immediately.</p>
        </div>
        <div style="background-color: #1e293b; padding: 20px; text-align: center; border-top: 1px solid #334155;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">&copy; 2024 Hostel Management System. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Email sending failed:", err);
    throw new Error("Failed to send OTP email.");
  }
}

export async function calculateSuspiciousScore(data: {
  email: string;
  ip: string;
  fingerprint: string;
  phoneNumber: string;
}): Promise<number> {
  let score = 0;

  // 1. Same IP Check (+1)
  const sameIPUsers = await storage.getUsersByIP(data.ip);
  if (sameIPUsers.length > 0) score += 1;

  // 2. Same Device Check (+3)
  const sameDeviceUsers = await storage.getUsersByFingerprint(data.fingerprint);
  if (sameDeviceUsers.length > 0) score += 3;

  // 3. Disposable Email Check (+3)
  if (isDisposableEmail(data.email)) score += 3;

  // 4. Same Phone Number Check (+5)
  const samePhoneUser = await storage.getUserByPhoneNumber(data.phoneNumber);
  if (samePhoneUser) score += 5;

  // 5. Multiple registrations quickly (Check last 1 hour from same IP)
  // This is partially covered by IP rate limiting but we can add score too
  const recentIPRegs = sameIPUsers.filter(u => {
    if (!u.createdAt) return false;
    const regDate = new Date(u.createdAt).getTime();
    return (Date.now() - regDate) < 60 * 60 * 1000; // 1 hour
  });
  if (recentIPRegs.length >= 2) score += 2;

  return score;
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.id);

    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ message: "User not found" });
    }

    if (user.isBanned) {
      clearAuthCookie(res);
      return res.status(403).json({ message: "Your account has been banned." });
    }

    (req as any).user = user;
    next();
  } catch (err) {
    clearAuthCookie(res);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

