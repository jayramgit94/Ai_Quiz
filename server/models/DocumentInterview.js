const mongoose = require("mongoose");

const documentResponseSchema = new mongoose.Schema({
  questionIndex: Number,
  question: String,
  transcript: { type: String, default: "" },
  duration: { type: Number, default: 0 },
  referenceSource: {
    type: String,
    enum: ["provided", "ai-generated"],
    default: "provided",
  },
  referenceAnswer: { type: String, default: "" },
  evaluation: {
    score: { type: Number, default: 0 },
    relevance: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    communicationClarity: { type: Number, default: 0 },
    semanticSimilarity: { type: Number, default: 0 },
    strengths: [String],
    missingKeyPoints: [String],
    suggestions: [String],
    feedback: { type: String, default: "" },
  },
  answeredAt: { type: Date, default: Date.now },
});

const documentInterviewSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    sourceDocument: {
      fileName: String,
      fileType: String,
      rawText: String,
      extracted: [
        {
          question: String,
          providedAnswer: String,
          hasProvidedAnswer: Boolean,
        },
      ],
    },

    config: {
      role: { type: String, default: "Software Engineer" },
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "medium",
      },
      totalQuestions: { type: Number, default: 8 },
      timePerQuestion: { type: Number, default: 120 },
    },

    questions: [
      {
        question: String,
        providedAnswer: String,
        hasProvidedAnswer: Boolean,
      },
    ],

    responses: [documentResponseSchema],

    antiCheating: {
      tabSwitches: { type: Number, default: 0 },
      fullscreenExits: { type: Number, default: 0 },
      warnings: [
        {
          type: { type: String },
          timestamp: Date,
        },
      ],
    },

    results: {
      overallScore: { type: Number, default: 0 },
      relevanceScore: { type: Number, default: 0 },
      accuracyScore: { type: Number, default: 0 },
      communicationScore: { type: Number, default: 0 },
      semanticSimilarityScore: { type: Number, default: 0 },
      questionsAnswered: { type: Number, default: 0 },
      totalDuration: { type: Number, default: 0 },
      grade: { type: String, default: "N/A" },
      summary: String,
      topStrengths: [String],
      areasToImprove: [String],
      interviewReady: { type: Boolean, default: false },
    },

    status: {
      type: String,
      enum: ["uploading", "parsing", "ready", "in-progress", "completed"],
      default: "uploading",
    },

    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

documentInterviewSchema.index({ userName: 1, createdAt: -1 });
documentInterviewSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7 * 24 * 60 * 60,
    partialFilterExpression: { status: { $ne: "completed" } },
  },
);

module.exports = mongoose.model("DocumentInterview", documentInterviewSchema);
