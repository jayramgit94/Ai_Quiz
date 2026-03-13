const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Review = require("../models/Review");

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "dev_only_secret_change_in_production";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "jayramsang";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "942143";

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
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

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  const token = jwt.sign({ role: "admin", username }, JWT_SECRET, {
    expiresIn: "24h",
  });

  res.json({ token, admin: { username } });
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

module.exports = router;
