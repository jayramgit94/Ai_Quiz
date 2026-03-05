const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  explanation: { type: String, default: "" },
  example: { type: String, default: "" },
  interviewTip: { type: String, default: "" },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  topic: { type: String, default: "" },
});

const answerSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  selectedAnswer: { type: String, required: true },
  confidence: { type: String, enum: ["high", "medium", "guess"], default: "medium" },
  timeTaken: { type: Number, default: 0 },
  isCorrect: { type: Boolean, default: false },
});

const quizSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userName: { type: String, default: "Anonymous" },
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    questions: [questionSchema],
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    speedScore: { type: Number, default: 0 },
    finalScore: { type: Number, default: 0 },
    weakTopics: [String],
    strongTopics: [String],
    nextDifficulty: { type: String, default: "medium" },
    confidenceStats: {
      overconfidenceErrors: { type: Number, default: 0 },
      guessAccuracy: { type: Number, default: 0 },
      confidenceScore: { type: Number, default: 0 },
    },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizSession", quizSessionSchema);
