const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error(
    "FATAL: JWT_SECRET environment variable is required in production",
  );
  process.exit(1);
}
if (!JWT_SECRET && process.env.NODE_ENV !== "production") {
  console.warn("JWT_SECRET is not set. Using development fallback secret.");
}
const SAFE_JWT_SECRET = JWT_SECRET || "dev_only_secret_change_in_production";
const JWT_EXPIRES = "7d";

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Standard user fields returned in auth responses
function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar,
    country: user.country,
    xp: user.xp,
    level: user.level,
    streak: user.streak,
    achievements: user.achievements,
    theme: user.theme,
    totalQuizzes: user.totalQuizzes,
    totalCorrect: user.totalCorrect,
    totalQuestions: user.totalQuestions,
    totalInterviews: user.totalInterviews,
    bestAccuracy: user.bestAccuracy,
    topicStats: user.topicStats,
    accuracyHistory: user.accuracyHistory,
  };
}

// Middleware to verify JWT
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(token, SAFE_JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── POST /api/auth/register ───
router.post("/register", async (req, res) => {
  try {
    const { email, password, displayName, country } = req.body;

    if (!email || !password || !displayName) {
      return res
        .status(400)
        .json({ error: "Email, password, and name are required" });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password,
      displayName: displayName.trim(),
      country: country || "",
    });

    const token = jwt.sign({ userId: user._id }, SAFE_JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });

    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ─── POST /api/auth/login ───
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, SAFE_JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });

    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── GET /api/auth/me ───
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─── PUT /api/auth/profile ───
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { displayName, country, theme } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (displayName) user.displayName = displayName.trim();
    if (country !== undefined) user.country = country;
    if (theme) user.theme = theme;

    await user.save();
    res.json({
      user: {
        displayName: user.displayName,
        country: user.country,
        theme: user.theme,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ─── POST /api/auth/record-quiz ───
// Record quiz results to user profile (called after quiz submission)
router.post("/record-quiz", authMiddleware, async (req, res) => {
  try {
    const { topic, accuracy, score, totalQuestions, difficulty } = req.body;
    const normalizedTopic = String(topic || "").trim();
    const normalizedAccuracy = Math.min(
      100,
      Math.max(0, Math.round(Number(accuracy) || 0)),
    );
    const normalizedScore = Math.max(0, Number(score) || 0);
    const normalizedTotalQuestions = Math.max(0, Number(totalQuestions) || 0);

    // Atomic increment for core stats
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $inc: {
          totalQuizzes: 1,
          totalCorrect: normalizedScore,
          totalQuestions: normalizedTotalQuestions,
        },
      },
      { new: true },
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    // Update bestAccuracy if improved
    if (normalizedAccuracy > user.bestAccuracy) {
      user.bestAccuracy = normalizedAccuracy;
    }

    // Update topic stats
    const topicIdx = user.topicStats.findIndex(
      (t) => t.topic.toLowerCase() === normalizedTopic.toLowerCase(),
    );
    if (topicIdx >= 0) {
      const ts = user.topicStats[topicIdx];
      ts.quizCount += 1;
      ts.totalCorrect += normalizedScore;
      ts.totalQuestions += normalizedTotalQuestions;
      ts.avgAccuracy = Math.round((ts.totalCorrect / ts.totalQuestions) * 100);
      ts.lastPlayed = new Date();
    } else {
      user.topicStats.push({
        topic: normalizedTopic,
        quizCount: 1,
        totalCorrect: normalizedScore,
        totalQuestions: normalizedTotalQuestions,
        avgAccuracy: normalizedAccuracy,
        lastPlayed: new Date(),
      });
    }

    // Add accuracy history point
    user.accuracyHistory.push({
      date: new Date().toISOString().split("T")[0],
      accuracy: normalizedAccuracy,
      topic: normalizedTopic,
    });
    // Keep last 100 entries
    if (user.accuracyHistory.length > 100) {
      user.accuracyHistory = user.accuracyHistory.slice(-100);
    }

    // Award XP
    let xpEarned = 10; // base XP for completing
    if (normalizedAccuracy >= 90) xpEarned += 20;
    else if (normalizedAccuracy >= 70) xpEarned += 10;
    else if (normalizedAccuracy >= 50) xpEarned += 5;
    if (difficulty === "hard") xpEarned += 10;
    else if (difficulty === "medium") xpEarned += 5;

    const newAchievements = user.addXP(xpEarned, "quiz");
    await user.save();

    res.json({
      xpEarned,
      totalXP: user.xp,
      level: user.level,
      streak: user.streak,
      newAchievements,
      user: {
        xp: user.xp,
        level: user.level,
        streak: user.streak,
        totalQuizzes: user.totalQuizzes,
        totalCorrect: user.totalCorrect,
        bestAccuracy: user.bestAccuracy,
        achievements: user.achievements,
        topicStats: user.topicStats,
      },
    });
  } catch (err) {
    console.error("Record quiz error:", err.message);
    res.status(500).json({ error: "Failed to record quiz" });
  }
});

// ─── POST /api/auth/record-interview ───
router.post("/record-interview", authMiddleware, async (req, res) => {
  try {
    const { overallScore } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $inc: { totalInterviews: 1 } },
      { new: true },
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    let xpEarned = 25;
    if (overallScore >= 80) xpEarned += 25;
    else if (overallScore >= 60) xpEarned += 15;

    const newAchievements = user.addXP(xpEarned, "interview");
    await user.save();

    res.json({
      xpEarned,
      totalXP: user.xp,
      level: user.level,
      newAchievements,
      user: {
        xp: user.xp,
        level: user.level,
        totalInterviews: user.totalInterviews,
        achievements: user.achievements,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to record interview" });
  }
});

// ─── GET /api/auth/leaderboard ───
// User-based leaderboard with XP
router.get("/leaderboard", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ totalQuizzes: { $gt: 0 } })
      .select(
        "displayName country xp level streak totalQuizzes bestAccuracy achievements",
      )
      .sort({ xp: -1 })
      .limit(50)
      .lean();

    res.json(users);
  } catch (err) {
    res.json([]);
  }
});

// ─── DELETE /api/auth/clear-data ───
// Clear all user data (stats) but keep account — requires password
router.delete("/clear-data", authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Verify password before destructive action
    if (!password) {
      return res
        .status(400)
        .json({ error: "Password is required to clear data" });
    }
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    user.xp = 0;
    user.level = 1;
    user.streak = 0;
    user.lastActiveDate = "";
    user.achievements = [];
    user.totalQuizzes = 0;
    user.totalCorrect = 0;
    user.totalQuestions = 0;
    user.totalInterviews = 0;
    user.bestAccuracy = 0;
    user.topicStats = [];
    user.accuracyHistory = [];

    await user.save();
    res.json({ success: true, message: "All data cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear data" });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
