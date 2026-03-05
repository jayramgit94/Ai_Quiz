require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const quizRoutes = require("./routes/quiz");
const interviewRoutes = require("./routes/interview");
const leaderboardRoutes = require("./routes/leaderboard");
const resumeInterviewRoutes = require("./routes/resume-interview");
const authRoutes = require("./routes/auth");

const app = express();

// ─── MIDDLEWARE ───
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// ─── ROUTES ───
app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/resume-interview", resumeInterviewRoutes);

// ─── HEALTH CHECK ───
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── MONGODB + START ───
const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ai_quiz";

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
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
