const mongoose = require("mongoose");

const questionResponseSchema = new mongoose.Schema({
  questionIndex: Number,
  question: String,
  category: { type: String, enum: ["technical", "behavioral", "project", "hr"] },
  expectedTopics: [String],
  transcript: { type: String, default: "" },
  wordCount: { type: Number, default: 0 },
  duration: { type: Number, default: 0 }, // seconds spent answering
  evaluation: {
    score: { type: Number, default: 0 }, // 0-100
    relevance: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
    strengths: [String],
    improvements: [String],
  },
  answeredAt: { type: Date, default: Date.now },
});

const resumeInterviewSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },

    // Resume data
    resume: {
      fileName: String,
      fileType: String,
      rawText: String,
      parsed: {
        name: String,
        email: String,
        phone: String,
        skills: [String],
        technologies: [String],
        projects: [
          {
            name: String,
            description: String,
            technologies: [String],
          },
        ],
        experience: [
          {
            role: String,
            company: String,
            duration: String,
            highlights: [String],
          },
        ],
        education: [
          {
            degree: String,
            institution: String,
            year: String,
          },
        ],
        summary: String,
      },
    },

    // Interview config
    config: {
      role: { type: String, default: "Software Engineer" },
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "medium",
      },
      totalQuestions: { type: Number, default: 8 },
      timePerQuestion: { type: Number, default: 120 }, // seconds
    },

    // Generated questions
    questions: [
      {
        question: String,
        category: { type: String, enum: ["technical", "behavioral", "project", "hr"] },
        expectedTopics: [String],
        difficulty: String,
        context: String, // which resume section inspired this
      },
    ],

    // Responses
    responses: [questionResponseSchema],

    // Anti-cheating
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

    // Overall results
    results: {
      overallScore: { type: Number, default: 0 },
      technicalScore: { type: Number, default: 0 },
      communicationScore: { type: Number, default: 0 },
      confidenceScore: { type: Number, default: 0 },
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
  { timestamps: true }
);

resumeInterviewSchema.index({ userName: 1, createdAt: -1 });

module.exports = mongoose.model("ResumeInterview", resumeInterviewSchema);
