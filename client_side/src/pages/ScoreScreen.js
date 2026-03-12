import { Target, ThumbsUp, TrendingUp, Trophy, Zap } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import "./ScoreScreen.css";

export default function ScoreScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const { results, userName, xpData } = location.state || {};

  useEffect(() => {
    if (xpData?.newAchievements?.length) {
      xpData.newAchievements.forEach((a) => {
        toast.achievement(`🏆 Achievement Unlocked: ${a.name}`);
      });
    }
    // eslint-disable-next-line
  }, []);

  if (!results) {
    return (
      <div
        className="score-page container-sm"
        style={{ paddingTop: 80, textAlign: "center" }}
      >
        <p>No results found.</p>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Go Home
        </button>
      </div>
    );
  }

  const {
    score,
    totalQuestions,
    accuracy,
    speedScore,
    finalScore,
    weakTopics,
    strongTopics,
    nextDifficulty,
    confidenceStats,
    detailedResults,
  } = results;

  const getScoreIcon = () => {
    if (accuracy >= 90)
      return <Trophy size={52} style={{ color: "var(--warning)" }} />;
    if (accuracy >= 70)
      return <Zap size={52} style={{ color: "var(--primary)" }} />;
    if (accuracy >= 50)
      return <ThumbsUp size={52} style={{ color: "var(--success)" }} />;
    return <TrendingUp size={52} style={{ color: "var(--error)" }} />;
  };

  const getScoreMessage = () => {
    if (accuracy >= 90) return "Outstanding Performance!";
    if (accuracy >= 70) return "Great Job!";
    if (accuracy >= 50) return "Good Effort!";
    return "Keep Practicing!";
  };

  return (
    <div className="score-page has-navbar">
      <div className="container-sm">
        {/* Hero Score */}
        <div className="score-hero card animate-scale-in">
          <div className="score-emoji">{getScoreIcon()}</div>
          <h2 className="score-message">{getScoreMessage()}</h2>
          <div className="score-big">
            {score}/{totalQuestions}
          </div>

          {/* XP Earned */}
          {xpData && (
            <div className="xp-earned-section">
              <div className="xp-earned-badge">+{xpData.xpEarned} XP</div>
              {user && (
                <div className="xp-level-info">
                  Level {user.level || 1} · {user.xp || 0} XP total
                </div>
              )}
            </div>
          )}

          {/* Score rings */}
          <div className="score-rings">
            <div className="score-ring">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="var(--border)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="var(--primary)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${accuracy * 2.64} 264`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: "stroke-dasharray 1s ease" }}
                />
              </svg>
              <div className="ring-label">
                <span className="ring-value">{accuracy}%</span>
                <span className="ring-text">Accuracy</span>
              </div>
            </div>

            <div className="score-ring">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="var(--border)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="var(--warning)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${(speedScore || 0) * 2.64} 264`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: "stroke-dasharray 1s ease" }}
                />
              </svg>
              <div className="ring-label">
                <span className="ring-value">{speedScore || 0}</span>
                <span className="ring-text">Speed</span>
              </div>
            </div>

            <div className="score-ring">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="var(--border)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="var(--success)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${(finalScore || 0) * 2.64} 264`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: "stroke-dasharray 1s ease" }}
                />
              </svg>
              <div className="ring-label">
                <span className="ring-value">{finalScore || 0}</span>
                <span className="ring-text">Final</span>
              </div>
            </div>
          </div>
        </div>

        {/* Topic Analysis */}
        <div className="analysis-row">
          {strongTopics?.length > 0 && (
            <div className="card analysis-card animate-fade-in-up delay-1">
              <h3>
                <TrendingUp
                  size={15}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: 5,
                  }}
                />
                Strong Areas
              </h3>
              <div className="topic-tags">
                {strongTopics.map((t, i) => (
                  <span key={i} className="badge badge-success">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {weakTopics?.length > 0 && (
            <div className="card analysis-card animate-fade-in-up delay-2">
              <h3>📚 Needs Practice</h3>
              <div className="topic-tags">
                {weakTopics.map((t, i) => (
                  <span key={i} className="badge badge-error">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confidence Stats */}
        {confidenceStats && (
          <div className="card confidence-card animate-fade-in-up delay-3">
            <h3>
              <Target
                size={15}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: 5,
                }}
              />
              Confidence Analysis
            </h3>
            <div className="confidence-grid">
              <div className="conf-stat">
                <span className="conf-value">
                  {confidenceStats.overconfidenceErrors || 0}
                </span>
                <span className="conf-label">Overconfidence Errors</span>
                <span className="conf-desc">Said "High" but got wrong</span>
              </div>
              <div className="conf-stat">
                <span className="conf-value">
                  {confidenceStats.guessAccuracy || 0}%
                </span>
                <span className="conf-label">Guess Accuracy</span>
                <span className="conf-desc">Right when guessing</span>
              </div>
              <div className="conf-stat">
                <span className="conf-value">
                  {confidenceStats.confidenceScore || 0}%
                </span>
                <span className="conf-label">Confidence Score</span>
                <span className="conf-desc">Overall calibration</span>
              </div>
            </div>
          </div>
        )}

        {/* Next Difficulty */}
        <div className="card next-card animate-fade-in-up delay-4">
          <h3>🔄 Next Quiz Recommendation</h3>
          <p>Based on your performance, we recommend:</p>
          <div className="next-diff">
            <span
              className={`badge ${nextDifficulty === "easy" ? "badge-success" : nextDifficulty === "medium" ? "badge-warning" : "badge-error"}`}
            >
              {nextDifficulty?.toUpperCase()} Difficulty
            </span>
          </div>
        </div>

        {/* Detailed Results */}
        {detailedResults?.length > 0 && (
          <div className="card detailed-card animate-fade-in-up delay-5">
            <h3>📋 Question Review</h3>
            <div className="review-list">
              {detailedResults.map((r, i) => (
                <div
                  key={i}
                  className={`review-item ${r.isCorrect ? "correct" : "wrong"}`}
                >
                  <div className="review-header">
                    <span className="review-num">Q{i + 1}</span>
                    <span
                      className={`review-status ${r.isCorrect ? "correct" : "wrong"}`}
                    >
                      {r.isCorrect ? "✓ Correct" : "✕ Incorrect"}
                    </span>
                  </div>
                  <p className="review-question">{r.question}</p>
                  <div className="review-answers">
                    <span>
                      Your answer: <strong>{r.selectedAnswer || "—"}</strong>
                    </span>
                    <span>
                      Correct: <strong>{r.correctAnswer}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="score-actions animate-fade-in-up">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate("/setup")}
          >
            Retry Quiz →
          </button>
          <button
            className="btn btn-outline"
            onClick={() => navigate("/leaderboard")}
          >
            View Leaderboard
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/dashboard", { state: { userName } })}
          >
            My Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
