const express = require("express");
const crypto = require("crypto");
const {
  generateLiveInterviewQuestion,
  evaluateLiveInterviewAnswer,
} = require("../services/grokService");

const router = express.Router();

// ─── POST /api/interview/start ───
// Start a new live interview session
router.post("/start", async (req, res) => {
  try {
    const { topic, difficulty = "medium" } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const sessionId = crypto.randomUUID();

    const currentQuestion = await generateLiveInterviewQuestion(
      topic.trim(),
      difficulty,
      1,
    );

    res.json({
      sessionId,
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
// Submit an answer and get evaluation + follow-up (open-ended)
router.post("/answer", async (req, res) => {
  try {
    const {
      sessionId,
      topic,
      difficulty = "medium",
      previousQuestion,
      userAnswer,
      questionNumber = 1,
    } = req.body;

    if (!topic || !previousQuestion || !userAnswer) {
      return res.status(400).json({
        error: "topic, previousQuestion, and userAnswer are required",
      });
    }

    const evaluation = await evaluateLiveInterviewAnswer({
      topic: topic.trim(),
      question: previousQuestion,
      userAnswer,
      difficulty,
      questionNumber,
    });

    const followUpQuestion = await generateLiveInterviewQuestion(
      topic.trim(),
      difficulty,
      Number(questionNumber) + 1,
      `Previous question: ${previousQuestion}\nCandidate answer: ${userAnswer}\nFeedback summary: ${evaluation.feedback}`,
    );

    res.json({
      sessionId,
      evaluation,
      feedback: evaluation.feedback,
      guidance: evaluation.guidance,
      referenceAnswer: evaluation.referenceAnswer,
      semanticSimilarity: evaluation.semanticSimilarity,
      matchedKeyTerms: evaluation.matchedKeyTerms,
      missingKeyTerms: evaluation.missingKeyTerms,
      followUpQuestion,
      questionNumber: Number(questionNumber) + 1,
    });
  } catch (err) {
    console.error("Interview answer error:", err.message);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
});

module.exports = router;
