const express = require("express");
const crypto = require("crypto");
const QuizSession = require("../models/QuizSession");
const { generateQuizQuestions, expandTopic } = require("../services/grokService");
const { calculateScores } = require("../utils/scoring");
const { validateQuestionSet } = require("../utils/validation");

const router = express.Router();

// ─── POST /api/quiz/generate ───
// Generate a new quiz using Grok AI
router.post("/generate", async (req, res) => {
  try {
    const { topic, difficulty = "medium", count = 5, userName = "Anonymous" } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const numQuestions = Math.min(Math.max(parseInt(count) || 5, 1), 20);

    // Smart Topic Expansion — get subtopics for better questions
    let subtopics = [];
    try {
      subtopics = await expandTopic(topic.trim());
    } catch (e) {
      console.warn("Topic expansion failed, using raw topic:", e.message);
    }

    // Generate questions via Grok API
    const rawQuestions = await generateQuizQuestions(
      topic.trim(),
      difficulty,
      numQuestions,
      subtopics
    );

    // Anti-Hallucination Validation Layer
    const { validQuestions, issues } = validateQuestionSet(rawQuestions);

    if (validQuestions.length === 0) {
      return res.status(500).json({
        error: "AI generated questions failed validation. Please try again.",
        issues,
      });
    }

    // Create session
    const sessionId = crypto.randomUUID();

    // Save to DB (non-blocking, don't fail if DB is down)
    try {
      await QuizSession.create({
        sessionId,
        userName: userName || "Anonymous",
        topic: topic.trim(),
        difficulty,
        questions: validQuestions,
        totalQuestions: validQuestions.length,
      });
    } catch (dbErr) {
      console.warn("DB save failed (quiz will still work):", dbErr.message);
    }

    res.json({
      sessionId,
      questions: validQuestions,
      topic: topic.trim(),
      difficulty,
      subtopics,
    });
  } catch (err) {
    console.error("Quiz generation error:", err.message);
    res.status(500).json({
      error: err.message || "Failed to generate quiz. Please try again.",
    });
  }
});

// ─── POST /api/quiz/submit ───
// Submit quiz answers and get scored results
router.post("/submit", async (req, res) => {
  try {
    const { sessionId, answers } = req.body;

    if (!sessionId || !answers) {
      return res.status(400).json({ error: "sessionId and answers are required" });
    }

    // Get session from DB
    let session;
    try {
      session = await QuizSession.findOne({ sessionId });
    } catch (dbErr) {
      console.warn("DB read failed:", dbErr.message);
    }

    if (!session) {
      return res.status(404).json({ error: "Quiz session not found" });
    }

    // Calculate all scores
    const results = calculateScores(session.questions, answers);

    // Update session in DB
    try {
      session.answers = answers;
      session.score = results.score;
      session.accuracy = results.accuracy;
      session.speedScore = results.speedScore;
      session.finalScore = results.finalScore;
      session.weakTopics = results.weakTopics;
      session.strongTopics = results.strongTopics;
      session.nextDifficulty = results.nextDifficulty;
      session.confidenceStats = results.confidenceStats;
      session.completed = true;
      await session.save();
    } catch (dbErr) {
      console.warn("DB update failed:", dbErr.message);
    }

    res.json(results);
  } catch (err) {
    console.error("Submit error:", err.message);
    res.status(500).json({ error: "Failed to submit quiz" });
  }
});

// ─── GET /api/quiz/session/:sessionId ───
// Get existing quiz session
router.get("/session/:sessionId", async (req, res) => {
  try {
    const session = await QuizSession.findOne({ sessionId: req.params.sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (err) {
    console.error("Session fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// ─── POST /api/quiz/expand-topic ───
// Expand keyword into subtopics using AI
router.post("/expand-topic", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: "Keyword is required" });
    }

    const subtopics = await expandTopic(keyword.trim());
    res.json({ keyword: keyword.trim(), subtopics });
  } catch (err) {
    console.error("Topic expansion error:", err.message);
    res.status(500).json({ error: "Failed to expand topic" });
  }
});

module.exports = router;
