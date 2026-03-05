const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const achievementSchema = new mongoose.Schema({
  id: String,
  name: String,
  icon: String,
  description: String,
  unlockedAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    displayName: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    country: { type: String, default: "" },

    // Gamification
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    lastActiveDate: { type: String, default: "" },
    achievements: [achievementSchema],

    // Preferences
    theme: { type: String, enum: ["dark", "light"], default: "dark" },

    // Stats
    totalQuizzes: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    totalInterviews: { type: Number, default: 0 },
    bestAccuracy: { type: Number, default: 0 },

    // Analytics
    topicStats: [
      {
        topic: String,
        quizCount: { type: Number, default: 0 },
        totalCorrect: { type: Number, default: 0 },
        totalQuestions: { type: Number, default: 0 },
        avgAccuracy: { type: Number, default: 0 },
        lastPlayed: Date,
      },
    ],
    accuracyHistory: [
      {
        date: String,
        accuracy: Number,
        topic: String,
      },
    ],
  },
  { timestamps: true },
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Calculate level from XP
userSchema.methods.calculateLevel = function () {
  this.level = Math.floor(this.xp / 100) + 1;
  return this.level;
};

// Add XP and check achievements
userSchema.methods.addXP = function (amount, source) {
  this.xp += amount;
  this.calculateLevel();

  // Check streak
  const today = new Date().toISOString().split("T")[0];
  if (this.lastActiveDate) {
    const lastDate = new Date(this.lastActiveDate);
    const todayDate = new Date(today);
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      this.streak += 1;
    } else if (diffDays > 1) {
      this.streak = 1;
    }
  } else {
    this.streak = 1;
  }
  this.lastActiveDate = today;

  // Check achievements
  const newAchievements = [];
  const ACHIEVEMENTS = [
    {
      id: "first_quiz",
      name: "First Steps",
      icon: "🌟",
      description: "Complete your first quiz",
      check: () => this.totalQuizzes >= 1,
    },
    {
      id: "quiz_5",
      name: "Getting Started",
      icon: "🔥",
      description: "Complete 5 quizzes",
      check: () => this.totalQuizzes >= 5,
    },
    {
      id: "quiz_25",
      name: "Quiz Master",
      icon: "🏆",
      description: "Complete 25 quizzes",
      check: () => this.totalQuizzes >= 25,
    },
    {
      id: "quiz_100",
      name: "Quiz Legend",
      icon: "👑",
      description: "Complete 100 quizzes",
      check: () => this.totalQuizzes >= 100,
    },
    {
      id: "perfect_score",
      name: "Perfectionist",
      icon: "💎",
      description: "Get 100% accuracy",
      check: () => this.bestAccuracy >= 100,
    },
    {
      id: "streak_3",
      name: "On Fire",
      icon: "🔥",
      description: "3-day streak",
      check: () => this.streak >= 3,
    },
    {
      id: "streak_7",
      name: "Weekly Warrior",
      icon: "⚔️",
      description: "7-day streak",
      check: () => this.streak >= 7,
    },
    {
      id: "streak_30",
      name: "Monthly Master",
      icon: "🌙",
      description: "30-day streak",
      check: () => this.streak >= 30,
    },
    {
      id: "level_5",
      name: "Rising Star",
      icon: "⭐",
      description: "Reach level 5",
      check: () => this.level >= 5,
    },
    {
      id: "level_10",
      name: "Expert",
      icon: "🎓",
      description: "Reach level 10",
      check: () => this.level >= 10,
    },
    {
      id: "topics_5",
      name: "Explorer",
      icon: "🗺️",
      description: "Practice 5 different topics",
      check: () => this.topicStats.length >= 5,
    },
    {
      id: "interview_1",
      name: "Interview Ready",
      icon: "🎤",
      description: "Complete your first interview",
      check: () => this.totalInterviews >= 1,
    },
    {
      id: "xp_1000",
      name: "XP Hunter",
      icon: "💰",
      description: "Earn 1000 XP",
      check: () => this.xp >= 1000,
    },
  ];

  const existingIds = new Set(this.achievements.map((a) => a.id));
  ACHIEVEMENTS.forEach((a) => {
    if (!existingIds.has(a.id) && a.check()) {
      const achievement = {
        id: a.id,
        name: a.name,
        icon: a.icon,
        description: a.description,
      };
      this.achievements.push(achievement);
      newAchievements.push(achievement);
    }
  });

  return newAchievements;
};

userSchema.index({ xp: -1 });

module.exports = mongoose.model("User", userSchema);
