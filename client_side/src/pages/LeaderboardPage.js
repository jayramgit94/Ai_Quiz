import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllLeaderboard, getTodayLeaderboard } from "../services/api";
import "./LeaderboardPage.css";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("today");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line
  }, [tab]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res =
        tab === "today"
          ? await getTodayLeaderboard()
          : await getAllLeaderboard();
      setEntries(res.data);
    } catch (err) {
      console.error("Leaderboard load failed:", err);
    }
    setLoading(false);
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <div className="leaderboard-page has-navbar">
      <div className="container">
        <button
          className="btn btn-ghost btn-sm back-btn"
          onClick={() => navigate("/")}
        >
          ← Back
        </button>

        <div className="lb-header animate-fade-in-up">
          <span className="lb-icon">🏆</span>
          <h1>Leaderboard</h1>
          <p>See how you rank against other learners</p>
        </div>

        {/* Tabs */}
        <div className="lb-tabs animate-fade-in-up delay-1">
          <button
            className={`tab-btn ${tab === "today" ? "active" : ""}`}
            onClick={() => setTab("today")}
          >
            Today's Challenge
          </button>
          <button
            className={`tab-btn ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            All Time
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-screen" style={{ minHeight: "40vh" }}>
            <div className="spinner" />
          </div>
        ) : entries.length === 0 ? (
          <div
            className="card empty-state animate-fade-in-up"
            style={{ textAlign: "center", padding: 48 }}
          >
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏅</div>
            <h3>No Entries Yet</h3>
            <p>Be the first to top the leaderboard!</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/setup")}
              style={{ marginTop: 20 }}
            >
              Take a Quiz →
            </button>
          </div>
        ) : (
          <div className="lb-table card animate-fade-in-up delay-2">
            <div className="lb-row lb-header-row">
              <span className="lb-col rank">Rank</span>
              <span className="lb-col name">Name</span>
              <span className="lb-col topic">Topic</span>
              <span className="lb-col score">Score</span>
              <span className="lb-col accuracy">Accuracy</span>
              <span className="lb-col final">Final</span>
            </div>

            {entries.map((entry, i) => (
              <div key={i} className={`lb-row ${i < 3 ? `top-${i + 1}` : ""}`}>
                <span className="lb-col rank">
                  <span className={`rank-badge ${i < 3 ? "top" : ""}`}>
                    {getRankBadge(i + 1)}
                  </span>
                </span>
                <span className="lb-col name">{entry.userName}</span>
                <span className="lb-col topic">
                  <span className="badge badge-primary">{entry.topic}</span>
                </span>
                <span className="lb-col score">
                  {entry.score}/{entry.totalQuestions}
                </span>
                <span className="lb-col accuracy">{entry.accuracy}%</span>
                <span className="lb-col final">
                  <span className="final-score">{entry.finalScore}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
