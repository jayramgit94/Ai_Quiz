const express = require("express");
const crypto = require("crypto");
const QuizSession = require("../models/QuizSession");
const User = require("../models/User");
const {
  generateQuizQuestions,
  expandTopic,
} = require("../services/grokService");
const {
  gradeAnswersFromSession,
  calculateScores,
} = require("../utils/scoring");
const { validateQuestionSet } = require("../utils/validation");
const {
  stripQuizQuestionsForClient,
  sanitizeQuizSessionForClient,
  normalizeAnswerLetter,
} = require("../utils/sessionHelpers");
const { optionalAuthMiddleware } = require("./auth");

const router = express.Router();

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function productionError(err, fallback) {
  return process.env.NODE_ENV === "production"
    ? fallback
    : err?.message || fallback;
}

// ─── POST /api/quiz/generate ───
router.post("/generate", optionalAuthMiddleware, async (req, res) => {
  try {
    const {
      topic,
      difficulty = "medium",
      count = 5,
      userName = "Anonymous",
    } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const safeDifficulty = VALID_DIFFICULTIES.has(difficulty)
      ? difficulty
      : "medium";
    const numQuestions = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);

    let subtopics = [];
    try {
      subtopics = await expandTopic(topic.trim());
    } catch (e) {
      console.warn("Topic expansion failed, using raw topic:", e.message);
    }

    const rawQuestions = await generateQuizQuestions(
      topic.trim(),
      safeDifficulty,
      numQuestions,
      subtopics,
    );

    const { validQuestions, issues } = validateQuestionSet(rawQuestions);

    if (validQuestions.length === 0) {
      return res.status(500).json({
        error: "AI generated questions failed validation. Please try again.",
        issues,
      });
    }

    const sessionId = crypto.randomUUID();
    let resolvedUserName = String(userName || "Anonymous").trim() || "Anonymous";

    if (req.userId) {
      const user = await User.findById(req.userId).select("displayName").lean();
      if (user?.displayName) resolvedUserName = user.displayName;
    }

    try {
      await QuizSession.create({
        sessionId,
        userId: req.userId || null,
        userName: resolvedUserName,
        topic: topic.trim(),
        difficulty: safeDifficulty,
        questions: validQuestions,
        totalQuestions: validQuestions.length,
      });
    } catch (dbErr) {
      console.warn("DB save failed (quiz will still work):", dbErr.message);
    }

    res.json({
      sessionId,
      questions: stripQuizQuestionsForClient(validQuestions),
      topic: topic.trim(),
      difficulty: safeDifficulty,
      subtopics,
    });
  } catch (err) {
    console.error("Quiz generation error:", err.message);
    res.status(500).json({
      error: productionError(err, "Failed to generate quiz. Please try again."),
    });
  }
});

// ─── POST /api/quiz/check-answer ───
router.post("/check-answer", async (req, res) => {
  try {
    const { sessionId, questionIndex, selectedAnswer } = req.body;

    if (!sessionId || questionIndex === undefined || !selectedAnswer) {
      return res.status(400).json({
        error: "sessionId, questionIndex, and selectedAnswer are required",
      });
    }

    const session = await QuizSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Quiz session not found" });
    }

    if (session.completed) {
      return res.status(409).json({ error: "Quiz already submitted" });
    }

    const index = Number(questionIndex);
    const question = session.questions[index];
    if (!question) {
      return res.status(400).json({ error: "Invalid question index" });
    }

    const selectedLetter = normalizeAnswerLetter(selectedAnswer);
    const correctLetter = normalizeAnswerLetter(question.correctAnswer);
    const isCorrect = selectedLetter === correctLetter;

    res.json({
      isCorrect,
      correctAnswer: correctLetter,
      explanation: question.explanation || "",
      interviewTip: question.interviewTip || "",
    });
  } catch (err) {
    console.error("Check answer error:", err.message);
    res.status(500).json({ error: "Failed to check answer" });
  }
});

// ─── POST /api/quiz/submit ───
router.post("/submit", async (req, res) => {
  try {
    const { sessionId, answers } = req.body;

    if (!sessionId || !answers) {
      return res
        .status(400)
        .json({ error: "sessionId and answers are required" });
    }

    const graded = await QuizSession.findOneAndUpdate(
      { sessionId, completed: false },
      { $set: { completed: true } },
      { returnDocument: "before" },
    );

    if (!graded) {
      const existing = await QuizSession.findOne({ sessionId });
      if (!existing) {
        return res.status(404).json({ error: "Quiz session not found" });
      }
      if (existing.completed) {
        return res.status(409).json({ error: "Quiz already submitted" });
      }
      return res.status(500).json({ error: "Failed to submit quiz" });
    }

    const gradedAnswers = gradeAnswersFromSession(
      graded.questions,
      answers,
    );
    const results = calculateScores(graded.questions, gradedAnswers);

    try {
      await QuizSession.updateOne(
        { sessionId },
        {
          $set: {
            answers: gradedAnswers,
            score: results.score,
            accuracy: results.accuracy,
            speedScore: results.speedScore,
            finalScore: results.finalScore,
            weakTopics: results.weakTopics,
            strongTopics: results.strongTopics,
            nextDifficulty: results.nextDifficulty,
            confidenceStats: results.confidenceStats,
            completed: true,
          },
        },
      );
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
router.get("/session/:sessionId", optionalAuthMiddleware, async (req, res) => {
  try {
    const session = await QuizSession.findOne({
      sessionId: req.params.sessionId,
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const isOwner =
      req.userId &&
      session.userId &&
      String(session.userId) === String(req.userId);

    if (!session.completed && !isOwner) {
      return res.json(sanitizeQuizSessionForClient(session));
    }

    res.json(sanitizeQuizSessionForClient(session, { includeAnswers: true }));
  } catch (err) {
    console.error("Session fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// ─── POST /api/quiz/expand-topic ───
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
