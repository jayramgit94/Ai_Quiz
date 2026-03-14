const express = require("express");
const LeaderboardEntry = require("../models/LeaderboardEntry");
const DailyChallenge = require("../models/DailyChallenge");
const User = require("../models/User");
const QuizSession = require("../models/QuizSession");
const ResumeInterview = require("../models/ResumeInterview");
const DocumentInterview = require("../models/DocumentInterview");
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

function getUtcDayOfYear(date = new Date()) {
  const year = date.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 0);
  const currentDay = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  return Math.floor((currentDay - startOfYear) / 86400000);
}

function toSafeDate(value) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function mergeByKey(primary = [], secondary = [], getKey = (item) => item.id) {
  const merged = new Map();
  [...secondary, ...primary].forEach((item, index) => {
    const key = getKey(item) || `fallback-${index}`;
    if (!merged.has(key)) {
      merged.set(key, item);
      return;
    }

    const existing = merged.get(key);
    const existingTime =
      toSafeDate(
        existing?.completedAt || existing?.startedAt || existing?.createdAt,
      )?.getTime() || 0;
    const currentTime =
      toSafeDate(
        item?.completedAt || item?.startedAt || item?.createdAt,
      )?.getTime() || 0;
    if (currentTime > existingTime) {
      merged.set(key, item);
    }
  });

  return [...merged.values()].sort((a, b) => {
    const at =
      toSafeDate(a?.completedAt || a?.startedAt || a?.createdAt)?.getTime() ||
      0;
    const bt =
      toSafeDate(b?.completedAt || b?.startedAt || b?.createdAt)?.getTime() ||
      0;
    return bt - at;
  });
}

function mapQuizSessionToHistory(session) {
  const answerMap = new Map(
    (session?.answers || []).map((answer) => [answer.questionIndex, answer]),
  );

  return {
    sessionId: session?.sessionId || "",
    topic: session?.topic || "",
    difficulty: session?.difficulty || "medium",
    score: Number(session?.score || 0),
    totalQuestions: Number(session?.totalQuestions || 0),
    accuracy: Number(session?.accuracy || 0),
    speedScore: Number(session?.speedScore || 0),
    finalScore: Number(session?.finalScore || 0),
    weakTopics: Array.isArray(session?.weakTopics) ? session.weakTopics : [],
    strongTopics: Array.isArray(session?.strongTopics)
      ? session.strongTopics
      : [],
    nextDifficulty: session?.nextDifficulty || "medium",
    questionDetails: (session?.questions || []).map((question, index) => {
      const answer = answerMap.get(index) || {};
      return {
        questionIndex: index,
        question: question?.question || "",
        options: Array.isArray(question?.options) ? question.options : [],
        selectedAnswer: answer?.selectedAnswer || "",
        correctAnswer: question?.correctAnswer || "",
        isCorrect: Boolean(answer?.isCorrect),
        confidence: answer?.confidence || "medium",
        timeTaken: Number(answer?.timeTaken || 0),
        explanation: question?.explanation || "",
        interviewTip: question?.interviewTip || "",
        topic: question?.topic || session?.topic || "",
        difficulty: question?.difficulty || session?.difficulty || "medium",
      };
    }),
    completedAt: session?.updatedAt || session?.createdAt || new Date(),
    createdAt: session?.createdAt || new Date(),
  };
}

function mapResumeSessionToHistory(session) {
  return {
    sessionId: session?.sessionId || "",
    type: "resume",
    role: session?.config?.role || "Software Engineer",
    difficulty: session?.config?.difficulty || "medium",
    status: session?.status || "completed",
    overallScore: Number(session?.results?.overallScore || 0),
    grade: session?.results?.grade || "N/A",
    questionCount: Number(session?.results?.questionsAnswered || 0),
    durationSeconds: Number(session?.results?.totalDuration || 0),
    questionDetails: (session?.responses || []).map((item, index) => ({
      questionIndex: Number(item?.questionIndex ?? index),
      question: item?.question || "",
      userAnswer: item?.transcript || "",
      referenceAnswer: item?.referenceAnswer || "",
      score: Number(item?.evaluation?.score || 0),
      relevance: Number(item?.evaluation?.relevance || 0),
      accuracy: Number(item?.evaluation?.depth || 0),
      communication: Number(item?.evaluation?.communication || 0),
      semanticSimilarity: Number(item?.evaluation?.semanticSimilarity || 0),
      feedback: item?.evaluation?.feedback || "",
      duration: Number(item?.duration || 0),
    })),
    startedAt: session?.startedAt || session?.createdAt || null,
    completedAt: session?.completedAt || session?.updatedAt || null,
    createdAt: session?.createdAt || null,
  };
}

function mapDocumentSessionToHistory(session) {
  return {
    sessionId: session?.sessionId || "",
    type: "document",
    role: session?.config?.role || "Software Engineer",
    difficulty: session?.config?.difficulty || "medium",
    status: session?.status || "completed",
    overallScore: Number(session?.results?.overallScore || 0),
    grade: session?.results?.grade || "N/A",
    questionCount: Number(session?.results?.questionsAnswered || 0),
    durationSeconds: Number(session?.results?.totalDuration || 0),
    questionDetails: (session?.responses || []).map((item, index) => ({
      questionIndex: Number(item?.questionIndex ?? index),
      question: item?.question || "",
      userAnswer: item?.transcript || "",
      referenceAnswer: item?.referenceAnswer || "",
      score: Number(item?.evaluation?.score || 0),
      relevance: Number(item?.evaluation?.relevance || 0),
      accuracy: Number(item?.evaluation?.accuracy || 0),
      communication: Number(item?.evaluation?.communicationClarity || 0),
      semanticSimilarity: Number(item?.evaluation?.semanticSimilarity || 0),
      feedback: item?.evaluation?.feedback || "",
      duration: Number(item?.duration || 0),
    })),
    startedAt: session?.startedAt || session?.createdAt || null,
    completedAt: session?.completedAt || session?.updatedAt || null,
    createdAt: session?.createdAt || null,
  };
}

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
    const topic = String(req.params.topic || "").trim();
    if (!topic || topic.length > 100) {
      return res.status(400).json({ error: "Invalid topic" });
    }

    const entries = await LeaderboardEntry.find({
      topic: { $regex: new RegExp(escapeRegex(topic), "i") },
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

// ─── GET /api/leaderboard/progress/by-name/:userName ───
// Get user's learning progress / dashboard data
router.get("/progress/by-name/:userName", async (req, res) => {
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

// ─── GET /api/leaderboard/progress/me ───
// Authenticated learning cockpit data from current user profile
router.get("/progress/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select(
        "displayName totalQuizzes totalCorrect totalQuestions topicStats accuracyHistory quizHistory interviewHistory currentInterview",
      )
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const topicHistoryFromProfile = (user.topicStats || []).map((t) => ({
      topic: t.topic || "Unknown",
      quizCount: Number(t.quizCount || 0),
      totalCorrect: Number(t.totalCorrect || 0),
      totalQuestions: Number(t.totalQuestions || 0),
      lastDifficulty: "mixed",
      lastPlayed: t.lastPlayed || null,
    }));

    // Enrich with latest difficulty from leaderboard entries when available.
    let topicHistory = topicHistoryFromProfile;
    if (user.displayName) {
      const latestEntries = await LeaderboardEntry.find({
        userName: {
          $regex: new RegExp(`^${escapeRegex(user.displayName)}$`, "i"),
        },
      })
        .sort({ date: -1 })
        .limit(300)
        .lean();

      if (latestEntries.length) {
        const difficultyByTopic = new Map();
        for (const entry of latestEntries) {
          const key = String(entry.topic || "Unknown");
          if (!difficultyByTopic.has(key)) {
            difficultyByTopic.set(key, entry.difficulty || "mixed");
          }
        }

        topicHistory = topicHistory.map((t) => ({
          ...t,
          lastDifficulty: difficultyByTopic.get(t.topic) || t.lastDifficulty,
        }));
      }
    }

    topicHistory.sort((a, b) => b.quizCount - a.quizCount);

    const totalQuizzes = Number(user.totalQuizzes || 0);
    const totalCorrect = Number(user.totalCorrect || 0);
    const totalQuestions = Number(user.totalQuestions || 0);
    const averageAccuracy = totalQuestions
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0;

    const [quizSessions, resumeSessions, documentSessions] = await Promise.all([
      QuizSession.find({
        userName: {
          $regex: new RegExp(`^${escapeRegex(user.displayName || "")}$`, "i"),
        },
        completed: true,
      })
        .sort({ updatedAt: -1 })
        .limit(120)
        .lean(),
      ResumeInterview.find({
        $or: [
          { userId: req.userId },
          {
            userName: {
              $regex: new RegExp(
                `^${escapeRegex(user.displayName || "")}$`,
                "i",
              ),
            },
          },
        ],
        status: "completed",
      })
        .sort({ completedAt: -1, updatedAt: -1 })
        .limit(120)
        .lean(),
      DocumentInterview.find({
        $or: [
          { userId: req.userId },
          {
            userName: {
              $regex: new RegExp(
                `^${escapeRegex(user.displayName || "")}$`,
                "i",
              ),
            },
          },
        ],
        status: "completed",
      })
        .sort({ completedAt: -1, updatedAt: -1 })
        .limit(120)
        .lean(),
    ]);

    const mergedQuizHistory = mergeByKey(
      Array.isArray(user.quizHistory) ? user.quizHistory : [],
      quizSessions.map(mapQuizSessionToHistory),
      (item) => item?.sessionId,
    );

    const mergedInterviewHistory = mergeByKey(
      Array.isArray(user.interviewHistory) ? user.interviewHistory : [],
      [
        ...resumeSessions.map(mapResumeSessionToHistory),
        ...documentSessions.map(mapDocumentSessionToHistory),
      ],
      (item) => `${item?.type || "other"}:${item?.sessionId || ""}`,
    );

    return res.json({
      overallStats: {
        totalQuizzes,
        totalCorrect,
        averageAccuracy,
      },
      topicHistory,
      accuracyHistory: user.accuracyHistory || [],
      quizHistory: mergedQuizHistory,
      interviewHistory: mergedInterviewHistory,
      currentInterview: user.currentInterview || null,
    });
  } catch (err) {
    console.error("My progress error:", err.message);
    return res.status(500).json({
      overallStats: { totalQuizzes: 0, totalCorrect: 0, averageAccuracy: 0 },
      topicHistory: [],
      accuracyHistory: [],
      quizHistory: [],
      interviewHistory: [],
      currentInterview: null,
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
    const dayOfYear = getUtcDayOfYear();
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
