const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true, index: true },
    score: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    speedScore: { type: Number, default: 0 },
    finalScore: { type: Number, default: 0 },
    topic: { type: String, required: true },
    difficulty: { type: String, default: "medium" },
    totalQuestions: { type: Number, default: 0 },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

// Index for leaderboard queries
leaderboardSchema.index({ date: -1, finalScore: -1 });
leaderboardSchema.index({ userName: 1, topic: 1 });

module.exports = mongoose.model("LeaderboardEntry", leaderboardSchema);
