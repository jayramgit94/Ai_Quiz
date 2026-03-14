import {
  BarChart2,
  BookMarked,
  BookOpen,
  CheckCircle,
  ClipboardList,
  Clock3,
  Flame,
  Layers3,
  Map,
  Mic,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [activityFilter, setActivityFilter] = useState("all");

  const quizHistory = useMemo(() => progress?.quizHistory || [], [progress]);
  const interviewHistory = useMemo(
    () => progress?.interviewHistory || [],
    [progress],
  );
  const currentInterview = progress?.currentInterview || null;

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const formatDuration = (seconds) => {
    const total = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const activityFeed = useMemo(() => {
    const quizItems = quizHistory.map((item, index) => ({
      id: `quiz-${item.sessionId || index}`,
      kind: "quiz",
      title: item.topic || "Quiz Attempt",
      subtitle: `${item.difficulty || "medium"} quiz`,
      scoreLabel: `${item.score || 0}/${item.totalQuestions || 0}`,
      accuracyLabel: `${item.accuracy || 0}% accuracy`,
      timestamp: item.completedAt,
      payload: item,
    }));

    const interviewItems = interviewHistory.map((item, index) => ({
      id: `interview-${item.sessionId || index}`,
      kind: "interview",
      title: item.role || `${item.type || "Interview"} interview`,
      subtitle: `${(item.type || "interview").toUpperCase()} · ${item.difficulty || "medium"}`,
      scoreLabel: `${item.overallScore || 0}/100`,
      accuracyLabel: item.grade ? `Grade ${item.grade}` : "Interview record",
      timestamp: item.completedAt || item.startedAt,
      payload: item,
    }));

    return [...quizItems, ...interviewItems].sort((a, b) => {
      const at = new Date(a.timestamp || 0).getTime();
      const bt = new Date(b.timestamp || 0).getTime();
      return bt - at;
    });
  }, [quizHistory, interviewHistory]);

  const filteredActivityFeed = useMemo(() => {
    if (activityFilter === "quiz") {
      return activityFeed.filter((item) => item.kind === "quiz");
    }
    if (activityFilter === "interview") {
      return activityFeed.filter((item) => item.kind === "interview");
    }
    return activityFeed;
  }, [activityFeed, activityFilter]);

  const lastActivity = activityFeed[0] || null;
  const bestInterviewScore = interviewHistory.reduce(
    (best, item) => Math.max(best, Number(item.overallScore) || 0),
    0,
  );

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

            <div className="card activity-card animate-fade-in-up delay-3">
              <div className="activity-head">
                <div>
                  <h3>
                    <ClipboardList
                      size={16}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: 6,
                      }}
                    />
                    Activity Center
                  </h3>
                  <p className="activity-sub">
                    Professional view of every quiz and interview attempt,
                    including results, questions, and answers.
                  </p>
                </div>
                <div className="activity-filter-group">
                  <button
                    className={`activity-filter ${activityFilter === "all" ? "active" : ""}`}
                    onClick={() => setActivityFilter("all")}
                  >
                    All
                  </button>
                  <button
                    className={`activity-filter ${activityFilter === "quiz" ? "active" : ""}`}
                    onClick={() => setActivityFilter("quiz")}
                  >
                    Quizzes
                  </button>
                  <button
                    className={`activity-filter ${activityFilter === "interview" ? "active" : ""}`}
                    onClick={() => setActivityFilter("interview")}
                  >
                    Interviews
                  </button>
                </div>
              </div>

              <div className="activity-summary-grid">
                <div className="activity-summary-card">
                  <span className="activity-summary-icon">
                    <Layers3 size={16} />
                  </span>
                  <strong>{activityFeed.length}</strong>
                  <span>Total Records</span>
                </div>
                <div className="activity-summary-card">
                  <span className="activity-summary-icon">
                    <BookOpen size={16} />
                  </span>
                  <strong>{quizHistory.length}</strong>
                  <span>Quiz Attempts</span>
                </div>
                <div className="activity-summary-card">
                  <span className="activity-summary-icon">
                    <Mic size={16} />
                  </span>
                  <strong>{interviewHistory.length}</strong>
                  <span>Interview Attempts</span>
                </div>
                <div className="activity-summary-card">
                  <span className="activity-summary-icon">
                    <Sparkles size={16} />
                  </span>
                  <strong>{bestInterviewScore}</strong>
                  <span>Best Interview Score</span>
                </div>
              </div>

              {currentInterview && (
                <div className="activity-current">
                  <strong>Current activity:</strong>{" "}
                  {currentInterview.type || "interview"} ·{" "}
                  {currentInterview.status || "in-progress"} ·{" "}
                  {currentInterview.role || "-"} ·{" "}
                  {currentInterview.difficulty || "medium"}
                </div>
              )}

              {lastActivity ? (
                <>
                  <div className="activity-latest">
                    <span className="activity-latest-label">Latest record</span>
                    <strong>{lastActivity.title}</strong>
                    <span>
                      {lastActivity.subtitle} · {lastActivity.scoreLabel} ·{" "}
                      {lastActivity.accuracyLabel}
                    </span>
                    <small>{formatDateTime(lastActivity.timestamp)}</small>
                  </div>

                  <div className="activity-timeline">
                    <h4>
                      <Clock3
                        size={14}
                        style={{
                          display: "inline",
                          verticalAlign: "middle",
                          marginRight: 5,
                        }}
                      />
                      Recent Timeline
                    </h4>
                    {filteredActivityFeed.length ? (
                      <div className="activity-feed-list">
                        {filteredActivityFeed.slice(0, 12).map((item) => (
                          <div key={item.id} className="activity-feed-item">
                            <div
                              className={`activity-feed-marker ${item.kind === "quiz" ? "quiz" : "interview"}`}
                            />
                            <div className="activity-feed-content">
                              <div className="activity-feed-topline">
                                <strong>{item.title}</strong>
                                <small>{formatDateTime(item.timestamp)}</small>
                              </div>
                              <div className="activity-feed-meta">
                                <span>{item.subtitle}</span>
                                <span>{item.scoreLabel}</span>
                                <span>{item.accuracyLabel}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="activity-empty">
                        No activity for this filter.
                      </p>
                    )}
                  </div>

                  <div className="activity-detail-grid">
                    <div className="activity-section">
                      <h4>
                        <BookOpen
                          size={14}
                          style={{
                            display: "inline",
                            verticalAlign: "middle",
                            marginRight: 5,
                          }}
                        />
                        Quiz Records ({quizHistory.length})
                      </h4>
                      {quizHistory.length ? (
                        <div className="activity-list">
                          {quizHistory
                            .slice()
                            .reverse()
                            .map((item, idx) => (
                              <details
                                key={`${item.sessionId || "quiz"}-${idx}`}
                                className="activity-item"
                              >
                                <summary>
                                  <span>
                                    {item.topic || "Topic"} ·{" "}
                                    {item.difficulty || "medium"} · Result{" "}
                                    {item.score || 0}/{item.totalQuestions || 0}
                                  </span>
                                  <small>
                                    {formatDateTime(item.completedAt)}
                                  </small>
                                </summary>
                                <div className="activity-item-body">
                                  <div className="activity-chip-row">
                                    <span className="badge badge-primary">
                                      Accuracy {item.accuracy || 0}%
                                    </span>
                                    <span className="badge badge-warning">
                                      Final {item.finalScore || 0}
                                    </span>
                                    <span className="badge badge-success">
                                      Next {item.nextDifficulty || "-"}
                                    </span>
                                  </div>
                                  {(item.questionDetails || []).map(
                                    (q, qIdx) => (
                                      <div
                                        key={`${q.questionIndex || qIdx}-${qIdx}`}
                                        className={`qa-row ${q.isCorrect ? "correct" : "wrong"}`}
                                      >
                                        <div className="qa-q">
                                          Q{qIdx + 1}: {q.question || "-"}
                                        </div>
                                        <div className="qa-answer-grid">
                                          <div className="qa-a">
                                            Your answer:{" "}
                                            <strong>
                                              {q.selectedAnswer || "-"}
                                            </strong>
                                          </div>
                                          <div className="qa-a">
                                            Correct answer:{" "}
                                            <strong>
                                              {q.correctAnswer || "-"}
                                            </strong>
                                          </div>
                                        </div>
                                        <div className="qa-meta">
                                          {q.isCorrect
                                            ? "Correct"
                                            : "Incorrect"}{" "}
                                          · Confidence{" "}
                                          {q.confidence || "medium"} · Time{" "}
                                          {formatDuration(q.timeTaken || 0)}
                                        </div>
                                        {q.explanation && (
                                          <p className="qa-note">
                                            {q.explanation}
                                          </p>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </details>
                            ))}
                        </div>
                      ) : (
                        <p className="activity-empty">No quiz history yet.</p>
                      )}
                    </div>

                    <div className="activity-section">
                      <h4>
                        <Mic
                          size={14}
                          style={{
                            display: "inline",
                            verticalAlign: "middle",
                            marginRight: 5,
                          }}
                        />
                        Interview Records ({interviewHistory.length})
                      </h4>
                      {interviewHistory.length ? (
                        <div className="activity-list">
                          {interviewHistory
                            .slice()
                            .reverse()
                            .map((item, idx) => (
                              <details
                                key={`${item.sessionId || "interview"}-${idx}`}
                                className="activity-item"
                              >
                                <summary>
                                  <span>
                                    {(item.type || "interview").toUpperCase()} ·{" "}
                                    {item.role || "-"} · Score{" "}
                                    {item.overallScore || 0}/100
                                  </span>
                                  <small>
                                    {formatDateTime(
                                      item.completedAt || item.startedAt,
                                    )}
                                  </small>
                                </summary>
                                <div className="activity-item-body">
                                  <div className="activity-chip-row">
                                    <span className="badge badge-primary">
                                      Grade {item.grade || "N/A"}
                                    </span>
                                    <span className="badge badge-warning">
                                      Duration{" "}
                                      {formatDuration(item.durationSeconds)}
                                    </span>
                                    <span className="badge badge-success">
                                      Questions {item.questionCount || 0}
                                    </span>
                                  </div>
                                  {(item.questionDetails || []).map(
                                    (q, qIdx) => (
                                      <div
                                        key={`${q.questionIndex || qIdx}-${qIdx}`}
                                        className="qa-row"
                                      >
                                        <div className="qa-q">
                                          Q{qIdx + 1}: {q.question || "-"}
                                        </div>
                                        <div className="qa-a qa-long-answer">
                                          Candidate answer:{" "}
                                          {q.userAnswer || "-"}
                                        </div>
                                        {q.referenceAnswer && (
                                          <div className="qa-ref">
                                            Reference: {q.referenceAnswer}
                                          </div>
                                        )}
                                        <div className="qa-meta qa-score-grid">
                                          <span>Score {q.score || 0}</span>
                                          <span>
                                            Relevance {q.relevance || 0}
                                          </span>
                                          <span>
                                            Accuracy {q.accuracy || 0}
                                          </span>
                                          <span>
                                            Communication {q.communication || 0}
                                          </span>
                                          <span>
                                            Semantic {q.semanticSimilarity || 0}
                                          </span>
                                        </div>
                                        {q.feedback && (
                                          <p className="qa-note">
                                            {q.feedback}
                                          </p>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </details>
                            ))}
                        </div>
                      ) : (
                        <p className="activity-empty">
                          No interview history yet.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="activity-empty-state">
                  <div className="activity-empty-icon">
                    <ClipboardList size={26} />
                  </div>
                  <h4>No detailed activity found yet</h4>
                  <p>
                    Your full quiz and interview records will appear here as
                    soon as history is available from saved sessions or new
                    attempts.
                  </p>
                </div>
              )}
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
                      <div key={i} className="heatmap-row">
                        <div>
                          <span className="heatmap-name">{t.topic}</span>
                          <span className="heatmap-meta">
                            {t.quizCount || 0} quizzes · {t.totalCorrect || 0}/
                            {t.totalQuestions || 0} correct
                          </span>
                        </div>
                        <div className="heatmap-track">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="heatmap-diff">
                          <strong>{acc}%</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
