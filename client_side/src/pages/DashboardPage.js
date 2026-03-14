import {
  BarChart2,
  BookMarked,
  BookOpen,
  CheckCircle,
  Flame,
  Map,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  clearUserData,
  getMe,
  getMyProgress,
  getUserProgress,
} from "../services/api";
import "./DashboardPage.css";

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const userName = user?.displayName || location.state?.userName || "";
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (user) {
      loadProgress();
      const timer = setInterval(() => {
        loadProgress(true);
      }, 30000);
      return () => clearInterval(timer);
    }
    if (userName) loadProgress(false, userName);
    // eslint-disable-next-line
  }, [user?.id, userName]);

  const loadProgress = async (silent = false, fallbackName = userName) => {
    if (!user && !String(fallbackName || "").trim()) return;
    if (!silent) setLoading(true);

    try {
      let res;
      if (user) {
        const meRes = await getMe();
        updateUser(meRes.data.user);
        res = await getMyProgress();
      } else {
        res = await getUserProgress(String(fallbackName || "").trim());
      }
      setProgress(res.data || null);
      setSearched(true);
    } catch (err) {
      console.error("Load progress failed:", err);
      if (!silent) {
        toast.error("Failed to load latest learning data.");
      }
    }
    if (!silent) setLoading(false);
  };

  const handleClearData = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all your data? This cannot be undone.",
      )
    )
      return;
    try {
      await clearUserData();
      toast.success("All data cleared successfully");
      updateUser({
        xp: 0,
        level: 1,
        totalQuizzes: 0,
        streak: 0,
        achievements: [],
      });
      setProgress(null);
      setSearched(false);
    } catch (err) {
      toast.error("Failed to clear data");
    }
  };

  const getMaxQuizCount = () => {
    if (!progress?.topicHistory?.length) return 1;
    return Math.max(...progress.topicHistory.map((t) => t.quizCount), 1);
  };

  return (
    <div className="dashboard-page has-navbar">
      <div className="container">
        <button
          className="btn btn-ghost btn-sm back-btn"
          onClick={() => navigate("/")}
        >
          ← Back
        </button>

        <div className="dash-header animate-fade-in-up">
          <span className="dash-icon">
            <BarChart2 size={36} />
          </span>
          <h1>Learning Dashboard</h1>
          <p>Track your progress across topics</p>
        </div>

        {/* User XP Card */}
        {user && (
          <div className="card user-xp-card animate-fade-in-up">
            <div className="user-xp-top">
              <div className="user-xp-info">
                <h3>{user.displayName}</h3>
                <p>
                  Level {user.level || 1} · {user.xp || 0} XP ·{" "}
                  <Flame
                    size={13}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: 2,
                    }}
                  />
                  {user.streak || 0} day streak
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleClearData}
              >
                <Trash2
                  size={13}
                  style={{ marginRight: 5, verticalAlign: "middle" }}
                />
                Clear All Data
              </button>
            </div>
            <div className="progress-bar" style={{ marginTop: 12 }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${(user.xp || 0) % 100}%` }}
              />
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: 4,
              }}
            >
              {100 - ((user.xp || 0) % 100)} XP to next level
            </p>
          </div>
        )}

        <div className="dash-search animate-fade-in-up delay-1">
          <input
            className="input"
            value={userName || "Not signed in"}
            readOnly
          />
          <button
            className="btn btn-primary"
            onClick={() => loadProgress(false, userName)}
            disabled={loading || !userName}
          >
            {loading ? (
              <span className="spinner" style={{ width: 18, height: 18 }} />
            ) : (
              "Refresh"
            )}
          </button>
        </div>

        {loading && (
          <div className="loading-screen" style={{ minHeight: "30vh" }}>
            <div className="spinner" />
          </div>
        )}

        {searched && !loading && (
          <>
            {/* Overall Stats */}
            <div className="stats-grid animate-fade-in-up delay-2">
              <div className="stat-card card">
                <span className="stat-card-icon">
                  <BookOpen size={20} />
                </span>
                <span className="stat-card-value">
                  {progress?.overallStats?.totalQuizzes || 0}
                </span>
                <span className="stat-card-label">Total Quizzes</span>
              </div>
              <div className="stat-card card">
                <span className="stat-card-icon">
                  <CheckCircle size={20} />
                </span>
                <span className="stat-card-value">
                  {progress?.overallStats?.totalCorrect || 0}
                </span>
                <span className="stat-card-label">Correct Answers</span>
              </div>
              <div className="stat-card card">
                <span className="stat-card-icon">
                  <Target size={20} />
                </span>
                <span className="stat-card-value">
                  {progress?.overallStats?.averageAccuracy || 0}%
                </span>
                <span className="stat-card-label">Avg Accuracy</span>
              </div>
              <div className="stat-card card">
                <span className="stat-card-icon">
                  <BookMarked size={20} />
                </span>
                <span className="stat-card-value">
                  {progress?.topicHistory?.length || 0}
                </span>
                <span className="stat-card-label">Topics Covered</span>
              </div>
            </div>

            {/* Topic Heatmap */}
            {progress?.topicHistory?.length > 0 && (
              <div className="card heatmap-card animate-fade-in-up delay-3">
                <h3>
                  <Map
                    size={16}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: 6,
                    }}
                  />
                  Topic Heatmap
                </h3>
                <p className="heatmap-sub">
                  Your learning intensity across topics
                </p>
                <div className="heatmap-list">
                  {progress.topicHistory.map((t, i) => {
                    const width = Math.max(
                      10,
                      (t.quizCount / getMaxQuizCount()) * 100,
                    );
                    const acc =
                      t.totalQuestions > 0
                        ? Math.round((t.totalCorrect / t.totalQuestions) * 100)
                        : 0;
                    return (
                      <div
                        key={i}
                        className="heatmap-row animate-fade-in-up"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        <div className="heatmap-topic">
                          <span className="heatmap-name">{t.topic}</span>
                          <span className="heatmap-meta">
                            {t.quizCount} quizzes · {acc}% accuracy
                          </span>
                        </div>
                        <div className="heatmap-track">
                          <div
                            className="heatmap-bar"
                            style={{
                              width: `${width}%`,
                              background:
                                acc >= 70
                                  ? "linear-gradient(90deg, #58CC02, #46A302)"
                                  : acc >= 50
                                    ? "linear-gradient(90deg, #FFB020, #E09000)"
                                    : "linear-gradient(90deg, #FF4B4B, #E03C3C)",
                            }}
                          />
                        </div>
                        <span className="heatmap-diff badge badge-primary">
                          {t.lastDifficulty}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(!progress?.topicHistory ||
              progress.topicHistory.length === 0) && (
              <div
                className="card empty-state animate-fade-in-up"
                style={{ textAlign: "center", padding: 48 }}
              >
                <div style={{ marginBottom: 12, color: "var(--text-muted)" }}>
                  <BookOpen size={40} />
                </div>
                <h3>No Data Yet</h3>
                <p>Take some quizzes to see your progress here!</p>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate("/setup")}
                  style={{ marginTop: 20 }}
                >
                  Start a Quiz →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
