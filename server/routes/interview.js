const express = require("express");
const {
  generateInterviewQuestion,
  evaluateInterviewAnswer,
} = require("../services/grokService");

const router = express.Router();

// ─── POST /api/interview/start ───
// Start a new interview session
router.post("/start", async (req, res) => {
  try {
    const { topic, difficulty = "medium" } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const currentQuestion = await generateInterviewQuestion(
      topic.trim(),
      difficulty,
      1,
    );

    res.json({
      currentQuestion,
      questionNumber: 1,
      topic: topic.trim(),
      difficulty,
    });
  } catch (err) {
    console.error("Interview start error:", err.message);
    res.status(500).json({ error: "Failed to start interview" });
  }
});

// ─── POST /api/interview/answer ───
// Submit an answer and get evaluation + follow-up
router.post("/answer", async (req, res) => {
  try {
    const {
      topic,
      previousQuestion,
      userAnswer,
      questionNumber = 1,
      options,
      correctAnswer,
    } = req.body;

    if (!topic || !previousQuestion || !userAnswer) {
      return res.status(400).json({
        error: "topic, previousQuestion, and userAnswer are required",
      });
    }

    const result = await evaluateInterviewAnswer(
      topic.trim(),
      previousQuestion,
      userAnswer,
      questionNumber,
      options,
      correctAnswer,
    );

    res.json(result);
  } catch (err) {
    console.error("Interview answer error:", err.message);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
});

module.exports = router;
