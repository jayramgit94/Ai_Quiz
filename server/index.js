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
const reviewRoutes = require("./routes/reviews");
const adminRoutes = require("./routes/admin");

const app = express();
app.disable("x-powered-by");

// In serverless environments, fail fast instead of buffering DB operations
// while disconnected (prevents 10s buffering timeouts in request handlers).
mongoose.set("bufferCommands", false);
mongoose.set("bufferTimeoutMS", 0);

// ─── SECURITY MIDDLEWARE ───
app.use(helmet());
app.use(compression());

const isDev = process.env.NODE_ENV !== "production";

// Trust reverse proxy in production-style deployments so rate limiting
// can identify client IP correctly via X-Forwarded-For.
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", true);
} else if (process.env.TRUST_PROXY === "false") {
  app.set("trust proxy", false);
} else if (!isDev || Boolean(process.env.VERCEL)) {
  app.set("trust proxy", 1);
}

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
const apiRateLimitMax = Number(
  process.env.API_RATE_LIMIT_MAX || (isDev ? 2000 : 600),
);
const aiRateLimitMax = Number(process.env.AI_RATE_LIMIT_MAX || (isDev ? 240 : 80));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", limiter);

// Separate limiter for expensive AI-driven endpoints.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: aiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please retry in a moment." },
});
app.use("/api/quiz/generate", aiLimiter);
app.use("/api/interview", aiLimiter);
app.use("/api/resume-interview", aiLimiter);
app.use("/api/document-interview", aiLimiter);

// Stricter rate limit for auth endpoints
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authRateLimitMax,
  message: { error: "Too many auth attempts, please try again later" },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use(express.json({ limit: "10mb" }));

// Guard against hung requests so processes do not pile up under load.
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 290000);
app.use((req, res, next) => {
  res.setTimeout(requestTimeoutMs, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timed out. Please retry." });
    }
  });
  next();
});

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ai_quiz";

let mongoConnectPromise = null;

async function connectDB() {
  const state = mongoose.connection.readyState;
  if (state === 1) return mongoose.connection;
  if (state === 2 && mongoConnectPromise) return mongoConnectPromise;

  if (!mongoConnectPromise) {
    mongoConnectPromise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: Number(
          process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000,
        ),
        socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
        maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
        minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 1),
      })
      .then((conn) => {
        console.log("✅ MongoDB connected");
        return conn;
      })
      .catch((err) => {
        mongoConnectPromise = null;
        throw err;
      });
  }

  return mongoConnectPromise;
}

// Ensure DB is connected before handling API routes (except health endpoint).
app.use("/api", async (req, res, next) => {
  if (req.path === "/health") return next();

  try {
    await connectDB();
    return next();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    return res.status(503).json({
      error: "Database is temporarily unavailable. Please retry shortly.",
    });
  }
});

// ─── ROUTES ───
app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/resume-interview", resumeInterviewRoutes);
app.use("/api/document-interview", documentInterviewRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);

// ─── HEALTH CHECK ───
app.get("/api/health", async (req, res) => {
  try {
    await connectDB();
  } catch {
    // Health endpoint should still respond even when DB is unavailable.
  }

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

// Connect on import (for serverless warm starts)
connectDB().catch((err) => {
  console.error("❌ Initial MongoDB connect error:", err.message);
});

// Only start listening when run directly (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    connectDB().catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
    });
  });
}

module.exports = app;
