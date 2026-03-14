const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const ResumeInterview = require("../models/ResumeInterview");
const User = require("../models/User");
const { authMiddleware } = require("./auth");
const {
  parseResumeContent,
  generateResumeQuestions,
  evaluateSpokenAnswer,
  generateInterviewSummary,
  generateDocumentIdealAnswer,
} = require("../services/grokService");
const { compareAnswers } = require("../utils/documentInterview");

const router = express.Router();

// ─── FILE UPLOAD CONFIG ───
const uploadDir = path.resolve(
  process.env.VERCEL
    ? path.join("/tmp", "uploads")
    : path.join(__dirname, "..", "uploads"),
);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx", ".doc"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed"));
    }
  },
});

function getMinWordsForDifficulty(difficulty = "medium") {
  const level = String(difficulty || "medium").toLowerCase();
  if (level === "easy") return 1;
  if (level === "hard") return 4;
  return 2;
}

/**
 * Extract text from uploaded file
 */
async function extractText(filePath, fileType) {
  const ext = path.extname(fileType || filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === ".docx" || ext === ".doc") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

// ═══════════════════════════════════════════════════════════
// POST /upload - Upload resume, parse it, create session
// ═══════════════════════════════════════════════════════════
router.post(
  "/upload",
  authMiddleware,
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { userName, role, difficulty, totalQuestions, timePerQuestion } =
        req.body;

      if (!userName || !userName.trim()) {
        return res.status(400).json({ error: "userName is required" });
      }

      const sessionId = crypto.randomUUID();

      // Create initial session
      const session = new ResumeInterview({
        sessionId,
        userId: req.userId,
        userName: userName.trim(),
        resume: {
          fileName: req.file.originalname,
          fileType: path.extname(req.file.originalname).toLowerCase(),
        },
        config: {
          role: role || "Software Engineer",
          difficulty: difficulty || "medium",
          totalQuestions: parseInt(totalQuestions) || 8,
          timePerQuestion: parseInt(timePerQuestion) || 120,
        },
        status: "parsing",
      });

      await session.save();

      await User.findByIdAndUpdate(req.userId, {
        $set: {
          currentInterview: {
            sessionId,
            type: "resume",
            role: role || "Software Engineer",
            difficulty: difficulty || "medium",
            status: "parsing",
            updatedAt: new Date(),
          },
        },
      });

      // Extract text from file
      const rawText = await extractText(req.file.path, req.file.originalname);

      if (!rawText || rawText.trim().length < 50) {
        session.status = "ready";
        await session.save();
        // Clean up uploaded file
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
          error:
            "Could not extract enough text from the resume. Please upload a valid PDF or DOCX.",
        });
      }

      // Parse resume with AI
      const parsed = await parseResumeContent(rawText);

      session.resume.rawText = rawText.substring(0, 10000);
      session.resume.parsed = parsed;
      session.status = "ready";
      await session.save();

      await User.findByIdAndUpdate(req.userId, {
        $set: {
          currentInterview: {
            sessionId,
            type: "resume",
            role: role || "Software Engineer",
            difficulty: difficulty || "medium",
            status: "ready",
            updatedAt: new Date(),
          },
        },
      });

      // Clean up uploaded file
      fs.unlink(req.file.path, () => {});

      res.json({
        sessionId,
        status: "ready",
        parsed: {
          name: parsed.name,
          skills: parsed.skills,
          technologies: parsed.technologies,
          projectCount: (parsed.projects || []).length,
          experienceCount: (parsed.experience || []).length,
          summary: parsed.summary,
        },
      });
    } catch (err) {
      // Clean up file on error
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
      console.error("Resume upload error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to process resume" });
    }
  },
);

// ═══════════════════════════════════════════════════════════
// POST /generate-questions - Generate interview questions from parsed resume
// ═══════════════════════════════════════════════════════════
router.post("/generate-questions", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await ResumeInterview.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!session.resume?.parsed) {
      return res.status(400).json({ error: "Resume not yet parsed" });
    }

    const questions = await generateResumeQuestions(
      session.resume.parsed,
      session.config,
    );

    session.questions = questions;
    session.status = "in-progress";
    session.startedAt = new Date();
    await session.save();

    await User.findByIdAndUpdate(req.userId, {
      $set: {
        currentInterview: {
          sessionId,
          type: "resume",
          role: session.config?.role || "Software Engineer",
          difficulty: session.config?.difficulty || "medium",
          status: "in-progress",
          updatedAt: new Date(),
        },
      },
    });

    res.json({
      sessionId,
      questions: questions.map((q, i) => ({
        index: i,
        question: q.question,
        category: q.category,
        difficulty: q.difficulty,
        context: q.context,
      })),
      config: session.config,
    });
  } catch (err) {
    console.error("Question generation error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to generate questions" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /evaluate-answer - Evaluate a single spoken answer
// ═══════════════════════════════════════════════════════════
router.post("/evaluate-answer", authMiddleware, async (req, res) => {
  try {
    const { sessionId, questionIndex, transcript, duration } = req.body;

    if (!sessionId || questionIndex === undefined) {
      return res
        .status(400)
        .json({ error: "sessionId and questionIndex required" });
    }

    const rawTranscript = String(transcript || "");
    if (rawTranscript.length > 10000) {
      return res.status(400).json({
        error:
          "Answer is too long. Please keep each response under 10000 characters.",
      });
    }

    const safeTranscript = rawTranscript.trim();
    const wordCount = safeTranscript.split(/\s+/).filter(Boolean).length;

    const session = await ResumeInterview.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const minWords = getMinWordsForDifficulty(session.config?.difficulty);
    if (!safeTranscript || wordCount < minWords) {
      return res.status(400).json({
        error: `No meaningful answer detected. Please provide at least ${minWords} word${minWords > 1 ? "s" : ""}.`,
      });
    }

    const question = session.questions[questionIndex];
    if (!question) {
      return res.status(400).json({ error: "Invalid question index" });
    }

    const expectedTopics = question.expectedTopics || [];

    let referenceAnswer = "";
    let referenceSource = "expected-topics";

    if (expectedTopics.length) {
      referenceAnswer = `A strong answer should clearly cover: ${expectedTopics.join(", ")}.`;
    } else {
      referenceSource = "ai-generated";
      const generated = await generateDocumentIdealAnswer(question.question);
      referenceAnswer = generated.idealAnswer || "";
    }

    if (!referenceAnswer.trim()) {
      const generatedFallback = await generateDocumentIdealAnswer(
        question.question,
      );
      referenceSource = "ai-generated";
      referenceAnswer =
        generatedFallback.idealAnswer ||
        "Give a structured answer with definition, reasoning, and an example.";
    }

    const similarity = compareAnswers(safeTranscript, referenceAnswer);

    // Evaluate with AI
    const evaluation = await evaluateSpokenAnswer(
      question.question,
      safeTranscript,
      expectedTopics,
      question.category,
      session.config?.difficulty || "medium",
    );

    const mergedEvaluation = {
      ...evaluation,
      semanticSimilarity: similarity.semanticSimilarity,
      matchedKeyTerms: similarity.matchedKeyTerms,
      missingKeyTerms: similarity.missingKeyTerms,
    };

    // Store response
    const response = {
      questionIndex,
      question: question.question,
      category: question.category,
      expectedTopics,
      transcript: safeTranscript,
      wordCount,
      duration: duration || 0,
      referenceSource,
      referenceAnswer,
      evaluation: mergedEvaluation,
    };

    // Check if already answered (update) or new
    const existingIdx = session.responses.findIndex(
      (r) => r.questionIndex === questionIndex,
    );
    if (existingIdx >= 0) {
      session.responses[existingIdx] = response;
    } else {
      session.responses.push(response);
    }

    await session.save();

    res.json({
      questionIndex,
      evaluation: mergedEvaluation,
      referenceSource,
      referenceAnswer,
      answeredCount: session.responses.length,
      totalQuestions: session.questions.length,
    });
  } catch (err) {
    console.error("Answer evaluation error:", err);
    res.status(500).json({ error: err.message || "Failed to evaluate answer" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /anti-cheat - Log anti-cheating violations
// ═══════════════════════════════════════════════════════════
router.post("/anti-cheat", authMiddleware, async (req, res) => {
  try {
    const { sessionId, type } = req.body;

    const session = await ResumeInterview.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (type === "tab-switch") {
      session.antiCheating.tabSwitches += 1;
    } else if (type === "fullscreen-exit") {
      session.antiCheating.fullscreenExits += 1;
    }

    session.antiCheating.warnings.push({
      type,
      timestamp: new Date(),
    });

    await session.save();

    res.json({
      tabSwitches: session.antiCheating.tabSwitches,
      fullscreenExits: session.antiCheating.fullscreenExits,
      totalWarnings: session.antiCheating.warnings.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to log anti-cheat event" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /complete - Complete interview and generate summary
// ═══════════════════════════════════════════════════════════
router.post("/complete", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await ResumeInterview.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Calculate scores
    const responses = session.responses || [];
    const totalDuration = responses.reduce(
      (sum, r) => sum + (r.duration || 0),
      0,
    );

    const technicalResponses = responses.filter(
      (r) => r.category === "technical",
    );
    const technicalScore =
      technicalResponses.length > 0
        ? technicalResponses.reduce(
            (s, r) => s + (r.evaluation?.score || 0),
            0,
          ) / technicalResponses.length
        : 0;

    const commScores = responses.map((r) => r.evaluation?.communication || 0);
    const communicationScore =
      commScores.length > 0
        ? commScores.reduce((a, b) => a + b, 0) / commScores.length
        : 0;

    const avgWordCount =
      responses.length > 0
        ? responses.reduce((s, r) => s + (r.wordCount || 0), 0) /
          responses.length
        : 0;
    const confidenceScore = Math.min(100, avgWordCount * 2);

    // Get AI summary
    const summary = await generateInterviewSummary(
      session.resume.parsed,
      responses,
      session.config,
    );

    session.results = {
      overallScore: summary.overallScore || 0,
      technicalScore: Math.round(technicalScore),
      communicationScore: Math.round(communicationScore),
      confidenceScore: Math.round(confidenceScore),
      questionsAnswered: responses.length,
      totalDuration,
      grade: summary.grade || "N/A",
      summary: summary.summary || "",
      topStrengths: summary.topStrengths || [],
      areasToImprove: summary.areasToImprove || [],
      interviewReady: summary.interviewReady || false,
    };

    session.status = "completed";
    session.completedAt = new Date();
    await session.save();

    await User.findByIdAndUpdate(req.userId, {
      $set: { currentInterview: null },
    });

    res.json({
      sessionId,
      results: session.results,
      antiCheating: {
        tabSwitches: session.antiCheating.tabSwitches,
        fullscreenExits: session.antiCheating.fullscreenExits,
      },
      responses: responses.map((r) => ({
        question: r.question,
        category: r.category,
        transcript: r.transcript,
        referenceSource: r.referenceSource,
        referenceAnswer: r.referenceAnswer || "",
        evaluation: r.evaluation,
        duration: r.duration,
      })),
    });
  } catch (err) {
    console.error("Interview completion error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to complete interview" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /session/:sessionId - Get session data
// ═══════════════════════════════════════════════════════════
router.get("/session/:sessionId", async (req, res) => {
  try {
    const session = await ResumeInterview.findOne({
      sessionId: req.params.sessionId,
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /history/:userName - Get user's interview history
// ═══════════════════════════════════════════════════════════
router.get("/history/:userName", async (req, res) => {
  try {
    const sessions = await ResumeInterview.find({
      userName: req.params.userName,
      status: "completed",
    })
      .sort({ completedAt: -1 })
      .limit(20)
      .select("sessionId config.role config.difficulty results completedAt");

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

module.exports = router;
