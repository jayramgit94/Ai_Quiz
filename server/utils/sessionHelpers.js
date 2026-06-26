const mongoose = require("mongoose");

function normalizeAnswerLetter(value) {
  if (!value) return "";
  return String(value).trim().charAt(0).toUpperCase();
}

function assertSessionOwner(session, userId) {
  if (!session?.userId || !userId) return false;
  return String(session.userId) === String(userId);
}

function requireSessionOwner(session, userId, res) {
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return false;
  }
  if (!assertSessionOwner(session, userId)) {
    res.status(403).json({ error: "You do not have access to this session" });
    return false;
  }
  return true;
}

function stripQuizQuestionsForClient(questions = []) {
  return questions.map((q) => ({
    question: q.question,
    options: q.options,
    explanation: q.explanation || "",
    example: q.example || "",
    interviewTip: q.interviewTip || "",
    difficulty: q.difficulty || "medium",
    topic: q.topic || "",
  }));
}

function sanitizeQuizSessionForClient(session, { includeAnswers = false } = {}) {
  if (!session) return null;
  const doc = session.toObject ? session.toObject() : session;
  const payload = {
    sessionId: doc.sessionId,
    userName: doc.userName,
    topic: doc.topic,
    difficulty: doc.difficulty,
    totalQuestions: doc.totalQuestions,
    completed: doc.completed,
    score: doc.score,
    accuracy: doc.accuracy,
    speedScore: doc.speedScore,
    finalScore: doc.finalScore,
    weakTopics: doc.weakTopics || [],
    strongTopics: doc.strongTopics || [],
    nextDifficulty: doc.nextDifficulty,
    confidenceStats: doc.confidenceStats,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  if (doc.completed || includeAnswers) {
    payload.questions = (doc.questions || []).map((q, i) => {
      const ans = (doc.answers || []).find((a) => a.questionIndex === i);
      return {
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        example: q.example,
        interviewTip: q.interviewTip,
        selectedAnswer: ans?.selectedAnswer,
        isCorrect: ans?.isCorrect,
        confidence: ans?.confidence,
        timeTaken: ans?.timeTaken,
      };
    });
    payload.answers = doc.answers || [];
  } else {
    payload.questions = stripQuizQuestionsForClient(doc.questions || []);
  }

  return payload;
}

function sanitizeResumeSessionForClient(session, { full = false } = {}) {
  if (!session) return null;
  const doc = session.toObject ? session.toObject() : session;
  const base = {
    sessionId: doc.sessionId,
    userName: doc.userName,
    config: doc.config,
    status: doc.status,
    questions: doc.questions,
    responses: doc.responses?.map((r) => ({
      questionIndex: r.questionIndex,
      question: r.question,
      category: r.category,
      transcript: r.transcript,
      wordCount: r.wordCount,
      duration: r.duration,
      evaluation: r.evaluation,
      referenceAnswer: r.referenceAnswer,
      answeredAt: r.answeredAt,
    })),
    antiCheating: doc.antiCheating,
    results: doc.results,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
    createdAt: doc.createdAt,
  };

  if (full) {
    base.resume = {
      fileName: doc.resume?.fileName,
      fileType: doc.resume?.fileType,
      parsed: doc.resume?.parsed,
      rawText: doc.resume?.rawText,
    };
  } else {
    base.resume = {
      fileName: doc.resume?.fileName,
      parsed: {
        name: doc.resume?.parsed?.name,
        skills: doc.resume?.parsed?.skills,
        technologies: doc.resume?.parsed?.technologies,
        projectCount: (doc.resume?.parsed?.projects || []).length,
        experienceCount: (doc.resume?.parsed?.experience || []).length,
        summary: doc.resume?.parsed?.summary,
      },
    };
  }

  return base;
}

function sanitizeDocumentSessionForClient(session, { full = false } = {}) {
  if (!session) return null;
  const doc = session.toObject ? session.toObject() : session;
  const base = {
    sessionId: doc.sessionId,
    userName: doc.userName,
    config: doc.config,
    status: doc.status,
    questions: doc.questions,
    responses: doc.responses,
    antiCheating: doc.antiCheating,
    results: doc.results,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
    createdAt: doc.createdAt,
  };

  if (full) {
    base.sourceDocument = doc.sourceDocument;
  } else {
    base.sourceDocument = {
      fileName: doc.sourceDocument?.fileName,
      extractedCount: (doc.sourceDocument?.extracted || []).length,
    };
  }

  return base;
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return null;
}

module.exports = {
  normalizeAnswerLetter,
  assertSessionOwner,
  requireSessionOwner,
  stripQuizQuestionsForClient,
  sanitizeQuizSessionForClient,
  sanitizeResumeSessionForClient,
  sanitizeDocumentSessionForClient,
  toObjectId,
};
