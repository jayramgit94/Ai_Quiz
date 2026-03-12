const express = require("express");
const LeaderboardEntry = require("../models/LeaderboardEntry");
const DailyChallenge = require("../models/DailyChallenge");
const { generateQuizQuestions } = require("../services/grokService");
const { validateQuestionSet } = require("../utils/validation");
const { authMiddleware } = require("./auth");

const router = express.Router();

// Escape special regex characters to prevent NoSQL injection
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── DAILY TOPICS POOL ───
const DAILY_TOPICS = [
  "DBMS",
  "Operating Systems",
  "Computer Networks",
  "Data Structures",
  "Algorithms",
  "OOP Concepts",
  "System Design",
  "SQL",
  "JavaScript",
  "Python",
  "Java",
  "Web Development",
  "REST APIs",
  "Cloud Computing",
  "Cybersecurity",
];

// ─── POST /api/leaderboard/add ───
// Add entry to leaderboard (authenticated)
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const {
      userName,
      score,
      accuracy,
      speedScore = 0,
      finalScore = 0,
      topic,
      difficulty = "medium",
      totalQuestions = 0,
    } = req.body;

    if (!userName || score === undefined || !topic) {
      return res
        .status(400)
        .json({ error: "userName, score, and topic are required" });
    }

    const entry = await LeaderboardEntry.create({
      userName: userName.trim(),
      score,
      accuracy: accuracy || 0,
      speedScore,
      finalScore,
      topic: topic.trim(),
      difficulty,
      totalQuestions,
      date: new Date(),
    });

    res.json({ success: true, entry });
  } catch (err) {
    console.error("Leaderboard add error:", err.message);
    res.status(500).json({ error: "Failed to add to leaderboard" });
  }
});

// ─── GET /api/leaderboard/today ───
// Get today's leaderboard
router.get("/today", async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const entries = await LeaderboardEntry.find({ date: { $gte: todayStart } })
      .sort({ finalScore: -1 })
      .limit(50)
      .lean();

    res.json(entries);
  } catch (err) {
    console.error("Today leaderboard error:", err.message);
    res.json([]);
  }
});

// ─── GET /api/leaderboard/all ───
// Get all-time leaderboard
router.get("/all", async (req, res) => {
  try {
    const entries = await LeaderboardEntry.find()
      .sort({ finalScore: -1 })
      .limit(100)
      .lean();

    res.json(entries);
  } catch (err) {
    console.error("All leaderboard error:", err.message);
    res.json([]);
  }
});

// ─── GET /api/leaderboard/topic/:topic ───
// Get leaderboard for specific topic
router.get("/topic/:topic", async (req, res) => {
  try {
    const entries = await LeaderboardEntry.find({
      topic: { $regex: new RegExp(escapeRegex(req.params.topic), "i") },
    })
      .sort({ finalScore: -1 })
      .limit(50)
      .lean();

    res.json(entries);
  } catch (err) {
    console.error("Topic leaderboard error:", err.message);
    res.json([]);
  }
});

// ─── GET /api/leaderboard/progress/:userName ───
// Get user's learning progress / dashboard data
router.get("/progress/:userName", async (req, res) => {
  try {
    const userName = req.params.userName;

    const entries = await LeaderboardEntry.find({
      userName: { $regex: new RegExp(`^${escapeRegex(userName)}$`, "i") },
    })
      .sort({ date: -1 })
      .lean();

    if (entries.length === 0) {
      return res.json({
        overallStats: {
          totalQuizzes: 0,
          totalCorrect: 0,
          averageAccuracy: 0,
        },
        topicHistory: [],
      });
    }

    // Overall stats
    const totalQuizzes = entries.length;
    const totalCorrect = entries.reduce((sum, e) => sum + (e.score || 0), 0);
    const averageAccuracy = Math.round(
      entries.reduce((sum, e) => sum + (e.accuracy || 0), 0) / totalQuizzes,
    );

    // Topic breakdown with heatmap data
    const topicMap = {};
    entries.forEach((e) => {
      const t = e.topic || "Unknown";
      if (!topicMap[t]) {
        topicMap[t] = {
          topic: t,
          quizCount: 0,
          totalCorrect: 0,
          totalQuestions: 0,
          lastDifficulty: e.difficulty,
        };
      }
      topicMap[t].quizCount++;
      topicMap[t].totalCorrect += e.score || 0;
      topicMap[t].totalQuestions += e.totalQuestions || 0;
      topicMap[t].lastDifficulty = e.difficulty;
    });

    const topicHistory = Object.values(topicMap).sort(
      (a, b) => b.quizCount - a.quizCount,
    );

    res.json({
      overallStats: {
        totalQuizzes,
        totalCorrect,
        averageAccuracy,
      },
      topicHistory,
    });
  } catch (err) {
    console.error("Progress error:", err.message);
    res.json({
      overallStats: { totalQuizzes: 0, totalCorrect: 0, averageAccuracy: 0 },
      topicHistory: [],
    });
  }
});

// ─── GET /api/leaderboard/daily-challenge ───
// Get or generate today's daily challenge
router.get("/daily-challenge", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    // Check if today's challenge already exists
    let challenge;
    try {
      challenge = await DailyChallenge.findOne({ date: today });
    } catch (dbErr) {
      console.warn("DB read for daily challenge failed:", dbErr.message);
    }

    if (challenge) {
      return res.json({
        topic: challenge.topic,
        difficulty: challenge.difficulty,
        questions: challenge.questions,
        date: today,
      });
    }

    // Generate new daily challenge
    // Pick a random topic based on day of year for consistency
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000,
    );
    const topicIndex = dayOfYear % DAILY_TOPICS.length;
    const topic = DAILY_TOPICS[topicIndex];
    const difficulty = "medium";
    const count = 5;

    const rawQuestions = await generateQuizQuestions(topic, difficulty, count);
    const { validQuestions } = validateQuestionSet(rawQuestions);

    if (validQuestions.length === 0) {
      return res
        .status(500)
        .json({ error: "Failed to generate daily challenge" });
    }

    // Save to DB
    try {
      challenge = await DailyChallenge.create({
        date: today,
        topic,
        difficulty,
        questions: validQuestions,
      });
    } catch (dbErr) {
      console.warn("DB save for daily challenge failed:", dbErr.message);
    }

    res.json({
      topic,
      difficulty,
      questions: validQuestions,
      date: today,
    });
  } catch (err) {
    console.error("Daily challenge error:", err.message);
    res.status(500).json({ error: "Failed to load daily challenge" });
  }
});

module.exports = router;
