import {
  Award,
  BookOpen,
  Brain,
  Crown,
  Flame,
  Gem,
  Lock,
  Map,
  Mic,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AchievementsPage.css";

const ALL_ACHIEVEMENTS = [
  {
    id: "first_quiz",
    name: "First Steps",
    desc: "Complete your first quiz",
    Icon: Target,
    xp: 10,
  },
  {
    id: "quiz_5",
    name: "Getting Started",
    desc: "Complete 5 quizzes",
    Icon: BookOpen,
    xp: 25,
  },
  {
    id: "quiz_25",
    name: "Quiz Enthusiast",
    desc: "Complete 25 quizzes",
    Icon: Brain,
    xp: 50,
  },
  {
    id: "quiz_100",
    name: "Quiz Master",
    desc: "Complete 100 quizzes",
    Icon: Crown,
    xp: 100,
  },
  {
    id: "perfect_score",
    name: "Perfectionist",
    desc: "Get 100% accuracy on a quiz",
    Icon: Gem,
    xp: 50,
  },
  {
    id: "streak_3",
    name: "On Fire",
    desc: "3-day streak",
    Icon: Flame,
    xp: 15,
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    desc: "7-day streak",
    Icon: Zap,
    xp: 30,
  },
  {
    id: "streak_30",
    name: "Monthly Legend",
    desc: "30-day streak",
    Icon: Star,
    xp: 100,
  },
  {
    id: "level_5",
    name: "Rising Star",
    desc: "Reach Level 5",
    Icon: Award,
    xp: 25,
  },
  {
    id: "level_10",
    name: "Elite Learner",
    desc: "Reach Level 10",
    Icon: Trophy,
    xp: 50,
  },
  {
    id: "topics_5",
    name: "Explorer",
    desc: "Study 5 different topics",
    Icon: Map,
    xp: 30,
  },
  {
    id: "interview_1",
    name: "Interview Ready",
    desc: "Complete a resume interview",
    Icon: Mic,
    xp: 20,
  },
  {
    id: "xp_1000",
    name: "XP Hunter",
    desc: "Earn 1000 total XP",
    Icon: Sparkles,
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
            <div style={{ marginBottom: 16, color: "var(--text-muted)" }}>
              <Lock size={48} />
            </div>
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
          <span className="ach-icon">
            <Trophy size={36} />
          </span>
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
            <span className="ach-stat-value">
              <Flame
                size={18}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: 2,
                }}
              />{" "}
              {user.streak || 0}
            </span>
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
                  <ach.Icon size={28} />
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
                {!unlocked && (
                  <span className="ach-card-lock">
                    <Lock size={14} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
