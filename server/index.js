require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const quizRoutes = require("./routes/quiz");
const interviewRoutes = require("./routes/interview");
const leaderboardRoutes = require("./routes/leaderboard");
const resumeInterviewRoutes = require("./routes/resume-interview");
const documentInterviewRoutes = require("./routes/document-interview");
const authRoutes = require("./routes/auth");

const app = express();

// ─── SECURITY MIDDLEWARE ───
app.use(helmet());
app.use(compression());

const isDev = process.env.NODE_ENV !== "production";

// Build allowed origins: localhost:* in dev + explicit CLIENT_URL(s) in prod
// CLIENT_URL supports comma-separated list: CLIENT_URL=https://a.vercel.app,https://b.vercel.app
// VERCEL_URL is auto-injected by Vercel on every deployment (no https:// prefix)
const allowedOrigins = [
  ...(isDev
    ? [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
      ]
    : []),
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((u) => u.trim())
    : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, mobile apps, server-side)
      if (!origin) return callback(null, true);
      // Normalize: strip trailing slash browsers sometimes append
      const normalizedOrigin = origin.replace(/\/$/, "");
      // In dev, allow any localhost origin regardless of port
      if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin)) {
        return callback(null, true);
      }
      if (
        allowedOrigins.some((o) => o.replace(/\/$/, "") === normalizedOrigin) ||
        /^https:\/\/ai-quiz[\w-]*\.vercel\.app$/.test(normalizedOrigin)
      ) {
        return callback(null, true);
      }
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts, please try again later" },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use(express.json({ limit: "10mb" }));

// ─── ROUTES ───
app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/resume-interview", resumeInterviewRoutes);
app.use("/api/document-interview", documentInterviewRoutes);

// ─── HEALTH CHECK ───
app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbStatus = dbState === 1 ? "connected" : "disconnected";
  res.json({
    status: dbState === 1 ? "ok" : "degraded",
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// ─── GLOBAL ERROR HANDLER ───
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ─── MONGODB + START ───
const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ai_quiz";

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
  }
}

// Connect on import (for serverless warm starts)
connectDB();

// Only start listening when run directly (not on Vercel)
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  });
}

module.exports = app;
