const mongoose = require("mongoose");

const dailyChallengeSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true }, // "YYYY-MM-DD"
    topic: { type: String, required: true },
    difficulty: { type: String, default: "medium" },
    questions: [
      {
        question: String,
        options: [String],
        correctAnswer: String,
        explanation: String,
        example: String,
        interviewTip: String,
        difficulty: String,
        topic: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("DailyChallenge", dailyChallengeSchema);
