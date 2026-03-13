const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const DocumentInterview = require("../models/DocumentInterview");
const { authMiddleware } = require("./auth");
const {
  evaluateDocumentInterviewAnswer,
  generateDocumentIdealAnswer,
  generateDocumentInterviewSummary,
} = require("../services/grokService");
const {
  compareAnswers,
  parseQuestionAnswerDocument,
} = require("../utils/documentInterview");

const router = express.Router();

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
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, and DOCX files are allowed"));
    }
  },
});

function getMinWordsForDifficulty(difficulty = "medium") {
  const level = String(difficulty || "medium").toLowerCase();
  if (level === "easy") return 1;
  if (level === "hard") return 4;
  return 2;
}

async function extractText(filePath, sourceName) {
  const ext = path.extname(sourceName || filePath).toLowerCase();

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

router.post(
  "/upload",
  authMiddleware,
  upload.single("document"),
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
      const session = new DocumentInterview({
        sessionId,
        userName: userName.trim(),
        sourceDocument: {
          fileName: req.file.originalname,
          fileType: path.extname(req.file.originalname).toLowerCase(),
        },
        config: {
          role: role || "Software Engineer",
          difficulty: difficulty || "medium",
          totalQuestions: parseInt(totalQuestions, 10) || 8,
          timePerQuestion: parseInt(timePerQuestion, 10) || 120,
        },
        status: "parsing",
      });

      await session.save();

      const rawText = await extractText(req.file.path, req.file.originalname);

      if (!rawText || rawText.trim().length < 60) {
        session.status = "ready";
        await session.save();
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
          error:
            "Could not extract enough readable text from the document. Upload a cleaner PDF/DOCX.",
        });
      }

      const extracted = parseQuestionAnswerDocument(rawText);
      if (!extracted.length) {
        session.status = "ready";
        await session.save();
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
          error:
            "No interview questions were detected. Use a document with clear question formatting.",
        });
      }

      session.sourceDocument.rawText = rawText.substring(0, 20000);
      session.sourceDocument.extracted = extracted;
      session.status = "ready";
      await session.save();

      fs.unlink(req.file.path, () => {});

      const withAnswers = extracted.filter((item) => item.hasProvidedAnswer);

      return res.json({
        sessionId,
        status: "ready",
        parsed: {
          totalQuestionsFound: extracted.length,
          answerKeyCoverage: Math.round(
            (withAnswers.length / extracted.length) * 100,
          ),
          withAnswers: withAnswers.length,
          withoutAnswers: extracted.length - withAnswers.length,
          sampleQuestions: extracted.slice(0, 3).map((item) => item.question),
        },
      });
    } catch (err) {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
      console.error("Document upload error:", err);
      return res.status(500).json({
        error: err.message || "Failed to process uploaded document",
      });
    }
  },
);

router.post("/generate-questions", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await DocumentInterview.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const extracted = session.sourceDocument?.extracted || [];
    if (!extracted.length) {
      return res.status(400).json({
        error: "Document is not parsed yet or contains no valid questions",
      });
    }

    const selected = extracted
      .slice(0, session.config.totalQuestions)
      .map((q) => ({
        question: q.question,
        providedAnswer: q.providedAnswer || "",
        hasProvidedAnswer: Boolean(q.providedAnswer),
      }));

    session.questions = selected;
    session.status = "in-progress";
    session.startedAt = new Date();
    await session.save();

    return res.json({
      sessionId,
      questions: selected.map((q, index) => ({
        index,
        question: q.question,
        hasProvidedAnswer: q.hasProvidedAnswer,
      })),
      config: session.config,
    });
  } catch (err) {
    console.error("Document question generation error:", err);
    return res.status(500).json({
      error: err.message || "Failed to prepare interview questions",
    });
  }
});

router.post("/evaluate-answer", authMiddleware, async (req, res) => {
  try {
    const { sessionId, questionIndex, transcript, duration } = req.body;

    if (!sessionId || questionIndex === undefined) {
      return res
        .status(400)
        .json({ error: "sessionId and questionIndex are required" });
    }

    const rawTranscript = String(transcript || "");
    if (rawTranscript.length > 12000) {
      return res.status(400).json({
        error:
          "Answer is too long. Please keep each response under 12000 characters.",
      });
    }

    const safeTranscript = rawTranscript.trim();
    const wordCount = safeTranscript.split(/\s+/).filter(Boolean).length;
    const session = await DocumentInterview.findOne({ sessionId });
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

    let referenceAnswer = (question.providedAnswer || "").trim();
    let referenceSource = "provided";

    if (!referenceAnswer) {
      referenceSource = "ai-generated";
      const generated = await generateDocumentIdealAnswer(question.question);
      referenceAnswer = generated.idealAnswer || "";
    }

    const similarity = compareAnswers(safeTranscript, referenceAnswer);

    const evaluation = await evaluateDocumentInterviewAnswer({
      question: question.question,
      userAnswer: safeTranscript,
      referenceAnswer,
      referenceSource,
      semanticSimilarity: similarity.semanticSimilarity,
      missingTerms: similarity.missingKeyTerms,
      difficulty: session.config?.difficulty || "medium",
    });

    const response = {
      questionIndex,
      question: question.question,
      transcript: safeTranscript,
      duration: duration || 0,
      referenceSource,
      referenceAnswer,
      evaluation: {
        ...evaluation,
        semanticSimilarity: similarity.semanticSimilarity,
        matchedKeyTerms: similarity.matchedKeyTerms,
        missingKeyTerms: similarity.missingKeyTerms,
      },
    };

    const existingIdx = session.responses.findIndex(
      (item) => item.questionIndex === questionIndex,
    );

    if (existingIdx >= 0) {
      session.responses[existingIdx] = response;
    } else {
      session.responses.push(response);
    }

    await session.save();

    return res.json({
      questionIndex,
      evaluation: response.evaluation,
      referenceSource,
      referenceAnswer,
      matchedKeyTerms: similarity.matchedKeyTerms,
      missingKeyTerms: similarity.missingKeyTerms,
      answeredCount: session.responses.length,
      totalQuestions: session.questions.length,
    });
  } catch (err) {
    console.error("Document answer evaluation error:", err);
    return res.status(500).json({
      error: err.message || "Failed to evaluate answer",
    });
  }
});

router.post("/anti-cheat", authMiddleware, async (req, res) => {
  try {
    const { sessionId, type } = req.body;

    const session = await DocumentInterview.findOne({ sessionId });
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

    return res.json({
      tabSwitches: session.antiCheating.tabSwitches,
      fullscreenExits: session.antiCheating.fullscreenExits,
      totalWarnings: session.antiCheating.warnings.length,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to log anti-cheat event" });
  }
});

router.post("/complete", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await DocumentInterview.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const responses = session.responses || [];
    const totalDuration = responses.reduce(
      (sum, r) => sum + (r.duration || 0),
      0,
    );

    const average = (field) => {
      if (!responses.length) return 0;
      return (
        responses.reduce((sum, r) => sum + (r.evaluation?.[field] || 0), 0) /
        responses.length
      );
    };

    const relevanceScore = average("relevance");
    const accuracyScore = average("accuracy");
    const communicationScore = average("communicationClarity");
    const semanticSimilarityScore = average("semanticSimilarity");

    const summary = await generateDocumentInterviewSummary(
      responses,
      session.config,
    );

    session.results = {
      overallScore:
        summary.overallScore ||
        Math.round((relevanceScore + accuracyScore + communicationScore) / 3),
      relevanceScore: Math.round(relevanceScore),
      accuracyScore: Math.round(accuracyScore),
      communicationScore: Math.round(communicationScore),
      semanticSimilarityScore: Math.round(semanticSimilarityScore),
      questionsAnswered: responses.length,
      totalDuration,
      grade: summary.grade || "N/A",
      summary: summary.summary || "",
      topStrengths: summary.topStrengths || [],
      areasToImprove: summary.areasToImprove || [],
      interviewReady: Boolean(summary.interviewReady),
    };

    session.status = "completed";
    session.completedAt = new Date();
    await session.save();

    return res.json({
      sessionId,
      results: session.results,
      antiCheating: {
        tabSwitches: session.antiCheating.tabSwitches,
        fullscreenExits: session.antiCheating.fullscreenExits,
      },
      responses: responses.map((item) => ({
        question: item.question,
        transcript: item.transcript,
        referenceSource: item.referenceSource,
        referenceAnswer: item.referenceAnswer || "",
        evaluation: item.evaluation,
        duration: item.duration,
      })),
    });
  } catch (err) {
    console.error("Document interview completion error:", err);
    return res.status(500).json({
      error: err.message || "Failed to complete interview",
    });
  }
});

router.get("/session/:sessionId", async (req, res) => {
  try {
    const session = await DocumentInterview.findOne({
      sessionId: req.params.sessionId,
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.get("/history/:userName", async (req, res) => {
  try {
    const sessions = await DocumentInterview.find({
      userName: req.params.userName,
      status: "completed",
    })
      .sort({ completedAt: -1 })
      .limit(20)
      .select("sessionId config.role config.difficulty results completedAt");

    return res.json(sessions);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch history" });
  }
});

module.exports = router;
