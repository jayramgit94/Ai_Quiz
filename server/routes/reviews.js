const express = require("express");
const Review = require("../models/Review");
const User = require("../models/User");
const { authMiddleware } = require("./auth");

const router = express.Router();

router.get("/hero", async (req, res) => {
  try {
    const reviews = await Review.find({})
      .select("displayName rating note createdAt")
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    res.json({ reviews });
  } catch (err) {
    console.error("Hero reviews error:", err.message);
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { rating, note } = req.body;

    if (!rating || !note) {
      return res.status(400).json({ error: "Rating and note are required" });
    }

    const safeRating = Number(rating);
    if (!Number.isFinite(safeRating) || safeRating < 1 || safeRating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const cleanedNote = String(note).trim();
    if (cleanedNote.length < 8) {
      return res
        .status(400)
        .json({ error: "Please write at least 8 characters" });
    }

    const user = await User.findById(req.userId)
      .select("displayName email")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const review = await Review.create({
      userId: req.userId,
      displayName: user?.displayName || "User",
      email: String(user.email || "")
        .trim()
        .toLowerCase(),
      rating: safeRating,
      note: cleanedNote,
    });

    res.status(201).json({
      review: {
        id: review._id,
        displayName: review.displayName,
        rating: review.rating,
        note: review.note,
        createdAt: review.createdAt,
      },
    });
  } catch (err) {
    console.error("Publish review error:", err.message);
    res.status(500).json({ error: "Failed to publish review" });
  }
});

module.exports = router;
