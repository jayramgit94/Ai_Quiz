const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Review = require("../models/Review");
const ResumeInterview = require("../models/ResumeInterview");
const DocumentInterview = require("../models/DocumentInterview");

const router = express.Router();

const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "admin").trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "@123456").trim();

if (!JWT_SECRET && process.env.NODE_ENV !== "production") {
  console.warn("JWT_SECRET is not set. Using development fallback secret.");
}

const SAFE_JWT_SECRET = JWT_SECRET || "dev_only_secret_change_in_production";

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  try {
    const payload = jwt.verify(token, SAFE_JWT_SECRET);
    if (payload?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid admin token" });
  }
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return res.status(503).json({
      error: "Admin login is not configured on the server.",
    });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  const token = jwt.sign({ role: "admin", username }, SAFE_JWT_SECRET, {
    expiresIn: "24h",
  });

  res.json({ token, admin: { username } });
});

router.get("/status", (req, res) => {
  res.json({
    configured: Boolean(ADMIN_USERNAME && ADMIN_PASSWORD),
  });
});

router.get("/overview", adminAuth, async (req, res) => {
  try {
    const [users, reviews] = await Promise.all([
      User.find({})
        .select(
          "displayName email xp level streak totalQuizzes totalInterviews bestAccuracy totalCorrect totalQuestions updatedAt createdAt",
        )
        .sort({ updatedAt: -1 })
        .lean(),
      Review.find({})
        .select("displayName rating note createdAt")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const totals = users.reduce(
      (acc, u) => {
        acc.totalQuizzes += u.totalQuizzes || 0;
        acc.totalInterviews += u.totalInterviews || 0;
        acc.totalXp += u.xp || 0;
        acc.totalCorrect += u.totalCorrect || 0;
        acc.totalQuestions += u.totalQuestions || 0;
        if (u.updatedAt && new Date(u.updatedAt).getTime() >= sevenDaysAgo) {
          acc.activeLast7Days += 1;
        }
        return acc;
      },
      {
        totalQuizzes: 0,
        totalInterviews: 0,
        totalXp: 0,
        totalCorrect: 0,
        totalQuestions: 0,
        activeLast7Days: 0,
      },
    );

    const avgXp = users.length ? Math.round(totals.totalXp / users.length) : 0;
    const overallAccuracy = totals.totalQuestions
      ? Math.round((totals.totalCorrect / totals.totalQuestions) * 100)
      : 0;
    const avgReviewRating = reviews.length
      ? Number(
          (
            reviews.reduce((sum, item) => sum + (item.rating || 0), 0) /
            reviews.length
          ).toFixed(1),
        )
      : 0;

    const topUsers = [...users]
      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 10)
      .map((u) => ({
        displayName: u.displayName,
        email: u.email,
        xp: u.xp || 0,
        level: u.level || 1,
        streak: u.streak || 0,
        totalQuizzes: u.totalQuizzes || 0,
        totalInterviews: u.totalInterviews || 0,
        bestAccuracy: u.bestAccuracy || 0,
        updatedAt: u.updatedAt,
      }));

    const recentUsers = [...users]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8)
      .map((u) => ({
        displayName: u.displayName,
        email: u.email,
        createdAt: u.createdAt,
      }));

    const recentReviews = reviews.slice(0, 10).map((item) => ({
      displayName: item.displayName,
      rating: item.rating,
      note: item.note,
      createdAt: item.createdAt,
    }));

    res.json({
      summary: {
        totalUsers: users.length,
        activeLast7Days: totals.activeLast7Days,
        totalQuizzes: totals.totalQuizzes,
        totalInterviews: totals.totalInterviews,
        averageXp: avgXp,
        overallAccuracy,
        totalReviews: reviews.length,
        averageReviewRating: avgReviewRating,
      },
      topUsers,
      recentUsers,
      recentReviews,
    });
  } catch (err) {
    console.error("Admin overview error:", err.message);
    res.status(500).json({ error: "Failed to load admin overview" });
  }
});

router.get("/users", adminAuth, async (req, res) => {
  try {
    const users = await User.find({})
      .select(
        "displayName email avatar country xp level streak totalQuizzes totalInterviews bestAccuracy totalCorrect totalQuestions createdAt updatedAt currentInterview",
      )
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      users: users.map((u) => ({
        id: String(u._id),
        displayName: u.displayName || "",
        email: u.email || "",
        country: u.country || "",
        xp: u.xp || 0,
        level: u.level || 1,
        streak: u.streak || 0,
        totalQuizzes: u.totalQuizzes || 0,
        totalInterviews: u.totalInterviews || 0,
        bestAccuracy: u.bestAccuracy || 0,
        totalCorrect: u.totalCorrect || 0,
        totalQuestions: u.totalQuestions || 0,
        currentInterview: u.currentInterview || null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
    });
  } catch (err) {
    console.error("Admin users list error:", err.message);
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.get("/users/:userId", adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("-password").lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [resumeSessions, documentSessions] = await Promise.all([
      ResumeInterview.find({
        $or: [{ userId: user._id }, { userName: user.displayName }],
      })
        .select(
          "sessionId status config role userName startedAt completedAt createdAt updatedAt results responses",
        )
        .sort({ createdAt: -1 })
        .limit(80)
        .lean(),
      DocumentInterview.find({
        $or: [{ userId: user._id }, { userName: user.displayName }],
      })
        .select(
          "sessionId status config role userName startedAt completedAt createdAt updatedAt results responses",
        )
        .sort({ createdAt: -1 })
        .limit(80)
        .lean(),
    ]);

    const mapSessionToItem = (item, type) => ({
      type,
      sessionId: item.sessionId,
      status: item.status,
      role: item?.config?.role || "Software Engineer",
      difficulty: item?.config?.difficulty || "medium",
      overallScore: item?.results?.overallScore || 0,
      grade: item?.results?.grade || "N/A",
      questionsAnswered: item?.results?.questionsAnswered || 0,
      totalDuration: item?.results?.totalDuration || 0,
      startedAt: item.startedAt || null,
      completedAt: item.completedAt || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });

    const combinedSessionsRaw = [
      ...resumeSessions.map((item) => mapSessionToItem(item, "resume")),
      ...documentSessions.map((item) => mapSessionToItem(item, "document")),
      ...((user.interviewHistory || []).map((item) => ({
        type: item.type || "other",
        sessionId: item.sessionId || "",
        status: item.status || "completed",
        role: item.role || "",
        difficulty: item.difficulty || "medium",
        overallScore: item.overallScore || 0,
        grade: item.grade || "N/A",
        questionsAnswered: item.questionCount || 0,
        totalDuration: item.durationSeconds || 0,
        startedAt: item.startedAt || null,
        completedAt: item.completedAt || null,
        createdAt: item.completedAt || item.startedAt || null,
        updatedAt: item.completedAt || item.startedAt || null,
      })) || []),
    ];

    const deduped = new Map();
    for (const session of combinedSessionsRaw) {
      const key = `${session.type || "other"}:${session.sessionId || ""}:${session.status || "unknown"}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, session);
        continue;
      }
      const existingTime = new Date(
        existing.completedAt || existing.updatedAt || existing.createdAt || 0,
      ).getTime();
      const currentTime = new Date(
        session.completedAt || session.updatedAt || session.createdAt || 0,
      ).getTime();
      if (currentTime > existingTime) {
        deduped.set(key, session);
      }
    }

    const combinedSessions = [...deduped.values()]
      .sort((a, b) => {
        const at = new Date(
          a.completedAt || a.updatedAt || a.createdAt || 0,
        ).getTime();
        const bt = new Date(
          b.completedAt || b.updatedAt || b.createdAt || 0,
        ).getTime();
        return bt - at;
      })
      .slice(0, 200);

    const ongoing = combinedSessions.filter((s) => s.status === "in-progress");
    const completed = combinedSessions.filter((s) => s.status === "completed");

    res.json({
      user,
      interviewData: {
        currentInterview: user.currentInterview || null,
        ongoing,
        all: combinedSessions,
        completedCount: completed.length,
      },
    });
  } catch (err) {
    console.error("Admin user profile error:", err.message);
    res.status(500).json({ error: "Failed to load user profile" });
  }
});

module.exports = router;
