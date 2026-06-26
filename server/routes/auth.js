const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const QuizSession = require("../models/QuizSession");
const ResumeInterview = require("../models/ResumeInterview");
const DocumentInterview = require("../models/DocumentInterview");

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
    quizHistory: user.quizHistory || [],
    interviewHistory: user.interviewHistory || [],
    currentInterview: user.currentInterview || null,
  };
}

function toDateOrNow(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function normalizeInterviewQuestionDetails(details = []) {
  const list = Array.isArray(details) ? details : [];
  return list.slice(0, 60).map((item, index) => ({
    questionIndex: Number(item?.questionIndex ?? index),
    question: String(item?.question || ""),
    userAnswer: String(item?.userAnswer || item?.transcript || ""),
    referenceAnswer: String(item?.referenceAnswer || ""),
    score: clampScore(item?.score ?? item?.evaluation?.score),
    relevance: clampScore(item?.relevance ?? item?.evaluation?.relevance),
    accuracy: clampScore(item?.accuracy ?? item?.evaluation?.accuracy),
    communication: clampScore(
      item?.communication ??
        item?.evaluation?.communication ??
        item?.evaluation?.communicationClarity,
    ),
    semanticSimilarity: clampScore(
      item?.semanticSimilarity ?? item?.evaluation?.semanticSimilarity,
    ),
    feedback: String(item?.feedback || item?.evaluation?.feedback || ""),
    duration: Math.max(0, Number(item?.duration || 0)),
  }));
}

function normalizeQuizQuestionDetails(details = []) {
  const list = Array.isArray(details) ? details : [];
  return list.slice(0, 60).map((item, index) => ({
    questionIndex: Number(item?.questionIndex ?? index),
    question: String(item?.question || ""),
    options: Array.isArray(item?.options) ? item.options.map(String) : [],
    selectedAnswer: String(item?.selectedAnswer || ""),
    correctAnswer: String(item?.correctAnswer || ""),
    isCorrect: Boolean(item?.isCorrect),
    confidence: String(item?.confidence || "medium"),
    timeTaken: Math.max(0, Number(item?.timeTaken || 0)),
    explanation: String(item?.explanation || ""),
    interviewTip: String(item?.interviewTip || ""),
    topic: String(item?.topic || ""),
    difficulty: String(item?.difficulty || ""),
  }));
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

// Optional JWT — attaches userId when token is valid, continues as guest otherwise
function optionalAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, SAFE_JWT_SECRET);
    req.userId = decoded.userId;
  } catch {
    // ignore invalid token for optional auth
  }
  return next();
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
// Record quiz results from a completed server-graded session
router.post("/record-quiz", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await QuizSession.findOne({ sessionId }).lean();
    if (!session) {
      return res.status(404).json({ error: "Quiz session not found" });
    }
    if (!session.completed) {
      return res.status(400).json({ error: "Quiz is not completed yet" });
    }

    if (
      session.userId &&
      String(session.userId) !== String(req.userId)
    ) {
      return res.status(403).json({ error: "Session does not belong to you" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const alreadyRecorded = (user.quizHistory || []).some(
      (item) => item.sessionId === sessionId,
    );
    if (alreadyRecorded) {
      return res.json({
        xpEarned: 0,
        totalXP: user.xp,
        level: user.level,
        streak: user.streak,
        newAchievements: [],
        user: {
          xp: user.xp,
          level: user.level,
          streak: user.streak,
          totalQuizzes: user.totalQuizzes,
          totalCorrect: user.totalCorrect,
          bestAccuracy: user.bestAccuracy,
          achievements: user.achievements,
          topicStats: user.topicStats,
          quizHistory: user.quizHistory,
        },
      });
    }

    const normalizedTopic = String(session.topic || "").trim();
    const normalizedAccuracy = Math.min(
      100,
      Math.max(0, Math.round(Number(session.accuracy) || 0)),
    );
    const normalizedScore = Math.max(0, Number(session.score) || 0);
    const normalizedTotalQuestions = Math.max(
      0,
      Number(session.totalQuestions) || 0,
    );
    const difficulty = session.difficulty || "medium";

    user.totalQuizzes += 1;
    user.totalCorrect += normalizedScore;
    user.totalQuestions += normalizedTotalQuestions;

    if (normalizedAccuracy > user.bestAccuracy) {
      user.bestAccuracy = normalizedAccuracy;
    }

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

    user.accuracyHistory.push({
      date: new Date().toISOString().split("T")[0],
      accuracy: normalizedAccuracy,
      topic: normalizedTopic,
    });
    if (user.accuracyHistory.length > 100) {
      user.accuracyHistory = user.accuracyHistory.slice(-100);
    }

    const answerMap = new Map(
      (session.answers || []).map((ans) => [ans.questionIndex, ans]),
    );
    const questionDetails = normalizeQuizQuestionDetails(
      (session.questions || []).map((q, index) => {
        const ans = answerMap.get(index) || {};
        return {
          questionIndex: index,
          question: q.question,
          options: q.options || [],
          selectedAnswer: ans.selectedAnswer || "",
          correctAnswer: q.correctAnswer || "",
          isCorrect: Boolean(ans.isCorrect),
          confidence: ans.confidence || "medium",
          timeTaken: ans.timeTaken || 0,
          explanation: q.explanation || "",
          interviewTip: q.interviewTip || "",
          topic: q.topic || normalizedTopic,
          difficulty: q.difficulty || difficulty,
        };
      }),
    );

    user.quizHistory = Array.isArray(user.quizHistory) ? user.quizHistory : [];
    user.quizHistory.push({
      sessionId: String(sessionId).trim(),
      topic: normalizedTopic,
      difficulty,
      score: normalizedScore,
      totalQuestions: normalizedTotalQuestions,
      accuracy: normalizedAccuracy,
      speedScore: Math.max(0, Number(session.speedScore) || 0),
      finalScore: Math.max(0, Number(session.finalScore) || 0),
      weakTopics: Array.isArray(session.weakTopics)
        ? session.weakTopics.map(String)
        : [],
      strongTopics: Array.isArray(session.strongTopics)
        ? session.strongTopics.map(String)
        : [],
      nextDifficulty: String(session.nextDifficulty || difficulty),
      questionDetails,
      completedAt: new Date(),
    });
    if (user.quizHistory.length > 150) {
      user.quizHistory = user.quizHistory.slice(-150);
    }

    if (!session.userId) {
      await QuizSession.updateOne({ sessionId }, { $set: { userId: req.userId } });
    }

    let xpEarned = 10;
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
        quizHistory: user.quizHistory,
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
    const {
      overallScore,
      sessionId,
      interviewType,
      role,
      difficulty,
      status,
      grade,
      questionCount,
      durationSeconds,
      startedAt,
      completedAt,
      questionDetails,
    } = req.body || {};

    const normalizedType = ["resume", "document", "live"].includes(
      String(interviewType || "").toLowerCase(),
    )
      ? String(interviewType).toLowerCase()
      : "other";
    const normalizedStatus = ["in-progress", "completed", "abandoned"].includes(
      String(status || "").toLowerCase(),
    )
      ? String(status).toLowerCase()
      : "completed";

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const alreadyRecorded = (user.interviewHistory || []).some(
      (item) =>
        item.sessionId === String(sessionId || "").trim() &&
        item.type === normalizedType,
    );

    if (alreadyRecorded) {
      return res.json({
        xpEarned: 0,
        totalXP: user.xp,
        level: user.level,
        newAchievements: [],
        user: {
          xp: user.xp,
          level: user.level,
          totalInterviews: user.totalInterviews,
          achievements: user.achievements,
          interviewHistory: user.interviewHistory,
          currentInterview: user.currentInterview,
        },
      });
    }

    if (normalizedStatus === "completed") {
      user.totalInterviews += 1;
    }

    let resolvedQuestionDetails = normalizeInterviewQuestionDetails(
      questionDetails || [],
    );
    if (!resolvedQuestionDetails.length && sessionId) {
      if (normalizedType === "resume") {
        const session = await ResumeInterview.findOne({ sessionId }).lean();
        resolvedQuestionDetails = normalizeInterviewQuestionDetails(
          (session?.responses || []).map((item) => ({
            questionIndex: item.questionIndex,
            question: item.question,
            transcript: item.transcript,
            referenceAnswer: item.referenceAnswer,
            evaluation: item.evaluation,
            duration: item.duration,
          })),
        );
      }
      if (normalizedType === "document") {
        const session = await DocumentInterview.findOne({ sessionId }).lean();
        resolvedQuestionDetails = normalizeInterviewQuestionDetails(
          (session?.responses || []).map((item) => ({
            questionIndex: item.questionIndex,
            question: item.question,
            transcript: item.transcript,
            referenceAnswer: item.referenceAnswer,
            evaluation: item.evaluation,
            duration: item.duration,
          })),
        );
      }
    }

    user.interviewHistory = Array.isArray(user.interviewHistory)
      ? user.interviewHistory
      : [];
    user.interviewHistory.push({
      sessionId: String(sessionId || "").trim(),
      type: normalizedType,
      role: String(role || "").trim(),
      difficulty: String(difficulty || "medium").trim(),
      status: normalizedStatus,
      overallScore: Math.max(0, Math.min(100, Number(overallScore) || 0)),
      grade: String(grade || "N/A").trim(),
      questionCount: Math.max(0, Number(questionCount) || 0),
      durationSeconds: Math.max(0, Number(durationSeconds) || 0),
      questionDetails: resolvedQuestionDetails,
      startedAt: startedAt ? new Date(startedAt) : undefined,
      completedAt: completedAt
        ? new Date(completedAt)
        : normalizedStatus === "completed"
          ? new Date()
          : undefined,
    });
    if (user.interviewHistory.length > 120) {
      user.interviewHistory = user.interviewHistory.slice(-120);
    }
    if (normalizedStatus === "completed") {
      user.currentInterview = null;
    }

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
        interviewHistory: user.interviewHistory,
        currentInterview: user.currentInterview,
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
    user.quizHistory = [];
    user.interviewHistory = [];
    user.currentInterview = null;

    await user.save();
    res.json({ success: true, message: "All data cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear data" });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
