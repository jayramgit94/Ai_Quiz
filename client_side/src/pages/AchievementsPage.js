import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AchievementsPage.css";

const ALL_ACHIEVEMENTS = [
  {
    id: "first_quiz",
    name: "First Steps",
    desc: "Complete your first quiz",
    icon: "🎯",
    xp: 10,
  },
  {
    id: "quiz_5",
    name: "Getting Started",
    desc: "Complete 5 quizzes",
    icon: "📝",
    xp: 25,
  },
  {
    id: "quiz_25",
    name: "Quiz Enthusiast",
    desc: "Complete 25 quizzes",
    icon: "🧠",
    xp: 50,
  },
  {
    id: "quiz_100",
    name: "Quiz Master",
    desc: "Complete 100 quizzes",
    icon: "👑",
    xp: 100,
  },
  {
    id: "perfect_score",
    name: "Perfectionist",
    desc: "Get 100% accuracy on a quiz",
    icon: "💎",
    xp: 50,
  },
  { id: "streak_3", name: "On Fire", desc: "3-day streak", icon: "🔥", xp: 15 },
  {
    id: "streak_7",
    name: "Week Warrior",
    desc: "7-day streak",
    icon: "⚡",
    xp: 30,
  },
  {
    id: "streak_30",
    name: "Monthly Legend",
    desc: "30-day streak",
    icon: "🌟",
    xp: 100,
  },
  {
    id: "level_5",
    name: "Rising Star",
    desc: "Reach Level 5",
    icon: "⭐",
    xp: 25,
  },
  {
    id: "level_10",
    name: "Elite Learner",
    desc: "Reach Level 10",
    icon: "🏆",
    xp: 50,
  },
  {
    id: "topics_5",
    name: "Explorer",
    desc: "Study 5 different topics",
    icon: "🗺️",
    xp: 30,
  },
  {
    id: "interview_1",
    name: "Interview Ready",
    desc: "Complete a resume interview",
    icon: "🎤",
    xp: 20,
  },
  {
    id: "xp_1000",
    name: "XP Hunter",
    desc: "Earn 1000 total XP",
    icon: "💰",
    xp: 50,
  },
];

export default function AchievementsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="achievements-page has-navbar">
        <div
          className="container-sm"
          style={{ paddingTop: 40, textAlign: "center" }}
        >
          <div className="card" style={{ padding: 48 }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
            <h2>Sign In Required</h2>
            <p style={{ margin: "12px 0 24px" }}>
              Log in to view your achievements.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const userAchievementIds = (user.achievements || []).map((a) => a.id);
  const unlockedCount = userAchievementIds.length;
  const totalCount = ALL_ACHIEVEMENTS.length;
  const progress = Math.round((unlockedCount / totalCount) * 100);

  return (
    <div className="achievements-page has-navbar">
      <div className="container">
        <button
          className="btn btn-ghost btn-sm back-btn"
          onClick={() => navigate("/dashboard")}
        >
          ← Back
        </button>

        <div className="ach-header animate-fade-in-up">
          <span className="ach-icon">🏆</span>
          <h1>Achievements</h1>
          <p>
            {unlockedCount} of {totalCount} unlocked
          </p>
          <div
            className="progress-bar"
            style={{ maxWidth: 400, margin: "16px auto 0" }}
          >
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="ach-stats animate-fade-in-up delay-1">
          <div className="ach-stat card">
            <span className="ach-stat-value">{user.level || 1}</span>
            <span className="ach-stat-label">Level</span>
          </div>
          <div className="ach-stat card">
            <span className="ach-stat-value">{user.xp || 0}</span>
            <span className="ach-stat-label">Total XP</span>
          </div>
          <div className="ach-stat card">
            <span className="ach-stat-value">🔥 {user.streak || 0}</span>
            <span className="ach-stat-label">Day Streak</span>
          </div>
          <div className="ach-stat card">
            <span className="ach-stat-value">{user.totalQuizzes || 0}</span>
            <span className="ach-stat-label">Quizzes</span>
          </div>
        </div>

        <div className="ach-grid">
          {ALL_ACHIEVEMENTS.map((ach, i) => {
            const unlocked = userAchievementIds.includes(ach.id);
            const userAch = (user.achievements || []).find(
              (a) => a.id === ach.id,
            );
            return (
              <div
                key={ach.id}
                className={`ach-card card animate-fade-in-up ${unlocked ? "unlocked" : "locked"}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className={`ach-card-icon ${unlocked ? "" : "grayscale"}`}>
                  {ach.icon}
                </div>
                <div className="ach-card-info">
                  <h3>{ach.name}</h3>
                  <p>{ach.desc}</p>
                  <span className="ach-card-xp">+{ach.xp} XP</span>
                </div>
                {unlocked && userAch?.unlockedAt && (
                  <span className="ach-card-date">
                    {new Date(userAch.unlockedAt).toLocaleDateString()}
                  </span>
                )}
                {!unlocked && <span className="ach-card-lock">🔒</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
