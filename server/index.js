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

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    // Start server anyway for development without DB
    console.log("⚠️  Starting server without MongoDB...");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (no DB)`);
    });
  });
