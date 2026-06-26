import {
  Activity,
  BarChart2,
  BookOpen,
  Clock3,
  FileText,
  Radio,
  Search,
  Shield,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogin,
  getAdminOverview,
  getAdminStatus,
  getAdminUserProfile,
  getAdminUsers,
} from "../services/api";
import "./AdminPage.css";

const ADMIN_TOKEN_KEY = "ai-quiz-admin-token";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AdminPage() {
  const navigate = useNavigate();

  const [token, setToken] = useState(
    () => localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminConfigured, setAdminConfigured] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [userSearch, setUserSearch] = useState("");
  const [profileTab, setProfileTab] = useState("interviews");

  const isLoggedIn = Boolean(token);

  const loadOverview = async (adminToken) => {
    setLoading(true);
    setError("");
    try {
      const [overviewRes, usersRes] = await Promise.all([
        getAdminOverview(adminToken),
        getAdminUsers(adminToken),
      ]);
      setOverview(overviewRes.data);
      setUsers(usersRes.data?.users || []);
    } catch (err) {
      setOverview(null);
      setUsers([]);
      setError(err.response?.data?.error || "Failed to load admin data.");
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken("");
      }
    } finally {
      setLoading(false);
    }
  };

  const openUserProfile = async (userId) => {
    if (!userId || !token) return;
    setSelectedUserId(userId);
    setSelectedProfile(null);
    setProfileLoading(true);
    setError("");
    try {
      const { data } = await getAdminUserProfile(token, userId);
      setSelectedProfile(data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load user profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadOverview(token);
    }
  }, [token]);

  useEffect(() => {
    getAdminStatus()
      .then((res) => {
        setAdminConfigured(Boolean(res.data?.configured));
      })
      .catch(() => {
        setAdminConfigured(true);
      });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await adminLogin({ username, password });
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setToken(data.token);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setOverview(null);
  };

  const stats = useMemo(() => overview?.summary || {}, [overview]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const statCards = [
    { label: "Total users", value: stats.totalUsers || 0, icon: Users },
    { label: "Active (7 days)", value: stats.activeLast7Days || 0, icon: Activity },
    { label: "Quizzes today", value: stats.quizzesCompletedToday || 0, icon: Zap },
    { label: "Ongoing interviews", value: stats.ongoingInterviews || 0, icon: Radio },
    { label: "Total quizzes", value: stats.totalQuizzes || 0, icon: BookOpen },
    { label: "Total interviews", value: stats.totalInterviews || 0, icon: FileText },
    { label: "Average XP", value: stats.averageXp || 0, icon: TrendingUp },
    { label: "Overall accuracy", value: `${stats.overallAccuracy || 0}%`, icon: BarChart2 },
    { label: "Live sessions", value: stats.usersInLiveSession || 0, icon: Radio },
    { label: "Leaderboard today", value: stats.leaderboardEntriesToday || 0, icon: Star },
    { label: "Total reviews", value: stats.totalReviews || 0, icon: Star },
    { label: "Avg review rating", value: `${stats.averageReviewRating || 0}/5`, icon: Star },
  ];

  if (!isLoggedIn) {
    return (
      <div className="admin-page has-navbar">
        <div className="container-sm">
          <div className="card admin-login-card animate-fade-in-up">
            <h2>
              <Shield
                size={18}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Admin Login
            </h2>
            <p>
              Use admin credentials to view user progress and activity overview.
            </p>
            {!adminConfigured && (
              <div className="admin-error">
                Admin is not configured on server. Set ADMIN_USERNAME and
                ADMIN_PASSWORD in your backend environment.
              </div>
            )}
            <form onSubmit={handleLogin} className="admin-login-form">
              <div className="input-group">
                <label>Username</label>
                <input
                  className="input"
                  autoComplete="username"
                  placeholder="Enter admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <div className="admin-error">{error}</div>}
              <button
                className="btn btn-primary btn-block"
                disabled={loading || !adminConfigured}
              >
                {loading ? "Signing in..." : "Open Admin Panel"}
              </button>
            </form>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/")}
            >
              Back Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page has-navbar">
      <div className="container">
        <div className="admin-head animate-fade-in-up">
          <h1>
            <BarChart2
              size={24}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Admin Overview
          </h1>
          <div className="admin-actions">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => loadOverview(token)}
              disabled={loading}
            >
              Refresh
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {error && <div className="admin-error">{error}</div>}

        {loading && !overview && (
          <div className="loading-screen" style={{ minHeight: "30vh" }}>
            <div className="spinner" />
          </div>
        )}

        {overview && (
          <>
            <div className="admin-tabs animate-fade-in-up">
              {[
                { id: "overview", label: "Overview" },
                { id: "users", label: "Users" },
                { id: "live", label: "Live Activity" },
                { id: "storage", label: "Data Storage" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`admin-tab ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <>
                <div className="admin-stats-grid animate-fade-in-up">
                  {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div className="card admin-stat" key={card.label}>
                        <div className="admin-stat-head">
                          <Icon size={16} />
                          <span>{card.label}</span>
                        </div>
                        <strong>{card.value}</strong>
                      </div>
                    );
                  })}
                </div>

                <div className="admin-secondary-grid">
                  <div className="card admin-table-wrap animate-fade-in-up delay-1">
                    <h3>
                      <Users size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                      Top Users
                    </h3>
                    <div className="admin-table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>XP</th>
                            <th>Level</th>
                            <th>Quizzes</th>
                            <th>Interviews</th>
                            <th>Best Accuracy</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(overview.topUsers || []).length ? (
                            (overview.topUsers || []).map((u, idx) => (
                              <tr key={`${u.email || "no-email"}-${idx}`}>
                                <td>{u.displayName || "-"}</td>
                                <td>{u.email || "-"}</td>
                                <td>{u.xp || 0}</td>
                                <td>{u.level || 1}</td>
                                <td>{u.totalQuizzes || 0}</td>
                                <td>{u.totalInterviews || 0}</td>
                                <td>{u.bestAccuracy || 0}%</td>
                                <td>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => {
                                      const user = (users || []).find(
                                        (item) => item.email === u.email,
                                      );
                                      if (user?.id) {
                                        setActiveTab("users");
                                        openUserProfile(user.id);
                                      }
                                    }}
                                  >
                                    View Profile
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8}>No users found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card admin-table-wrap animate-fade-in-up delay-1">
                    <h3>
                      <Clock3 size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                      Recent Signups
                    </h3>
                    <div className="admin-table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(overview.recentUsers || []).length ? (
                            (overview.recentUsers || []).map((u, idx) => (
                              <tr key={`${u.email || "no-email"}-${idx}`}>
                                <td>{u.displayName || "-"}</td>
                                <td>{u.email || "-"}</td>
                                <td>{formatDate(u.createdAt)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3}>No recent signups.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="card admin-table-wrap animate-fade-in-up delay-1">
                  <h3>
                    <Star size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    Recent Reviews
                  </h3>
                  <div className="admin-reviews-list">
                    {(overview.recentReviews || []).length ? (
                      (overview.recentReviews || []).map((review, idx) => (
                        <div className="admin-review-item" key={`${review.displayName}-${idx}`}>
                          <div className="admin-review-head">
                            <strong>{review.displayName}</strong>
                            <span>{review.rating}/5</span>
                          </div>
                          <p>{review.note}</p>
                          <small>{formatDate(review.createdAt)}</small>
                        </div>
                      ))
                    ) : (
                      <p className="admin-empty">No reviews yet.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === "users" && (
              <>
                <div className="admin-toolbar card animate-fade-in-up">
                  <div className="admin-search-wrap">
                    <Search size={16} />
                    <input
                      className="input"
                      placeholder="Search by name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <span className="admin-toolbar-meta">
                    {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="card admin-table-wrap animate-fade-in-up delay-1">
                  <h3>All Users</h3>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Country</th>
                          <th>XP / Level</th>
                          <th>Quizzes</th>
                          <th>Interviews</th>
                          <th>Accuracy</th>
                          <th>Current Activity</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length ? (
                          filteredUsers.map((u) => (
                            <tr key={u.id} className={selectedUserId === u.id ? "row-active" : ""}>
                              <td>{u.displayName || "-"}</td>
                              <td>{u.email || "-"}</td>
                              <td>{u.country || "—"}</td>
                              <td>
                                {u.xp || 0} / L{u.level || 1}
                              </td>
                              <td>{u.totalQuizzes || 0}</td>
                              <td>{u.totalInterviews || 0}</td>
                              <td>{u.bestAccuracy || 0}%</td>
                              <td>
                                {u.currentInterview ? (
                                  <span className="admin-pill live">
                                    {u.currentInterview.type || "interview"} ·{" "}
                                    {u.currentInterview.status || "in-progress"}
                                  </span>
                                ) : (
                                  <span className="admin-pill idle">Idle</span>
                                )}
                              </td>
                              <td>{formatDate(u.createdAt)}</td>
                              <td>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => openUserProfile(u.id)}
                                  disabled={profileLoading && selectedUserId === u.id}
                                >
                                  {profileLoading && selectedUserId === u.id ? "Loading..." : "Open"}
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10}>No users match your search.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {(selectedProfile || profileLoading) && (
                  <div className="card admin-user-profile animate-fade-in-up delay-1">
                    <div className="admin-profile-head">
                      <h3>User Profile Drilldown</h3>
                      {selectedProfile?.user && (
                        <span className="admin-pill">
                          {selectedProfile.interviewData?.completedCount || 0} interviews completed
                        </span>
                      )}
                    </div>
                    {profileLoading && <p className="admin-empty">Loading profile...</p>}
                    {!profileLoading && selectedProfile && (
                      <>
                        <div className="admin-user-meta-grid">
                          <div>
                            <strong>Name</strong>
                            <span>{selectedProfile.user?.displayName || "-"}</span>
                          </div>
                          <div>
                            <strong>Email</strong>
                            <span>{selectedProfile.user?.email || "-"}</span>
                          </div>
                          <div>
                            <strong>XP / Level / Streak</strong>
                            <span>
                              {selectedProfile.user?.xp || 0} XP · L
                              {selectedProfile.user?.level || 1} · 🔥{" "}
                              {selectedProfile.user?.streak || 0}
                            </span>
                          </div>
                          <div>
                            <strong>Quiz stats</strong>
                            <span>
                              {selectedProfile.user?.totalQuizzes || 0} quizzes ·{" "}
                              {selectedProfile.user?.bestAccuracy || 0}% best accuracy
                            </span>
                          </div>
                          <div>
                            <strong>Interviews</strong>
                            <span>{selectedProfile.user?.totalInterviews || 0} total</span>
                          </div>
                          <div>
                            <strong>Current session</strong>
                            <span>
                              {selectedProfile.interviewData?.currentInterview
                                ? `${selectedProfile.interviewData.currentInterview.type || "interview"} (${selectedProfile.interviewData.currentInterview.status || "in-progress"})`
                                : "Idle"}
                            </span>
                          </div>
                        </div>

                        <div className="admin-tabs admin-tabs-inline">
                          {[
                            { id: "interviews", label: "Interviews" },
                            { id: "quizzes", label: "Quiz Sessions" },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              className={`admin-tab ${profileTab === tab.id ? "active" : ""}`}
                              onClick={() => setProfileTab(tab.id)}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {profileTab === "interviews" && (
                          <div className="admin-table-scroll">
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Type</th>
                                  <th>Status</th>
                                  <th>Role</th>
                                  <th>Difficulty</th>
                                  <th>Score</th>
                                  <th>Grade</th>
                                  <th>Tab switches</th>
                                  <th>Fullscreen exits</th>
                                  <th>Warnings</th>
                                  <th>Completed</th>
                                  <th>Session ID</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(selectedProfile.interviewData?.all || []).length ? (
                                  (selectedProfile.interviewData?.all || []).map((item, idx) => (
                                    <tr
                                      key={`${item.type || "interview"}-${item.sessionId || idx}-${idx}`}
                                    >
                                      <td>
                                        <span className="admin-pill">{item.type || "-"}</span>
                                      </td>
                                      <td>{item.status || "-"}</td>
                                      <td>{item.role || "-"}</td>
                                      <td>{item.difficulty || "-"}</td>
                                      <td>{item.overallScore || 0}</td>
                                      <td>{item.grade || "N/A"}</td>
                                      <td>{item.tabSwitches ?? 0}</td>
                                      <td>{item.fullscreenExits ?? 0}</td>
                                      <td>{item.warningsCount ?? 0}</td>
                                      <td>{formatDate(item.completedAt || item.updatedAt)}</td>
                                      <td className="admin-mono">{item.sessionId || "-"}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={11}>No interview records for this user.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {profileTab === "quizzes" && (
                          <div className="admin-table-scroll">
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Topic</th>
                                  <th>Difficulty</th>
                                  <th>Score</th>
                                  <th>Accuracy</th>
                                  <th>Final score</th>
                                  <th>Questions</th>
                                  <th>Weak topics</th>
                                  <th>Strong topics</th>
                                  <th>Completed</th>
                                  <th>Session ID</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(selectedProfile.quizData?.recentQuizzes || []).length ? (
                                  (selectedProfile.quizData?.recentQuizzes || []).map((q, idx) => (
                                    <tr key={`${q.sessionId || idx}-${idx}`}>
                                      <td>{q.topic || "-"}</td>
                                      <td>{q.difficulty || "-"}</td>
                                      <td>{q.score ?? 0}</td>
                                      <td>{q.accuracy ?? 0}%</td>
                                      <td>{q.finalScore ?? 0}</td>
                                      <td>{q.totalQuestions ?? 0}</td>
                                      <td>{(q.weakTopics || []).join(", ") || "—"}</td>
                                      <td>{(q.strongTopics || []).join(", ") || "—"}</td>
                                      <td>{formatDate(q.completedAt)}</td>
                                      <td className="admin-mono">{q.sessionId || "-"}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={10}>No quiz sessions for this user.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === "live" && (
              <div className="card admin-table-wrap animate-fade-in-up">
                <h3>
                  <Radio size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Live Interview Sessions
                </h3>
                <p className="admin-section-desc">
                  Users with an active <code>currentInterview</code> pointer on their User document.
                  Resume and document sessions are stored in MongoDB collections with anti-cheat telemetry.
                </p>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Session ID</th>
                        <th>Last updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview.liveActivity || []).length ? (
                        (overview.liveActivity || []).map((row, idx) => (
                          <tr key={`${row.email || idx}-${idx}`}>
                            <td>{row.displayName || "-"}</td>
                            <td>{row.email || "-"}</td>
                            <td>{row.currentInterview?.type || "-"}</td>
                            <td>
                              <span className="admin-pill live">
                                {row.currentInterview?.status || "in-progress"}
                              </span>
                            </td>
                            <td className="admin-mono">
                              {row.currentInterview?.sessionId || "-"}
                            </td>
                            <td>{formatDate(row.updatedAt)}</td>
                            <td>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  const user = users.find((u) => u.email === row.email);
                                  if (user?.id) {
                                    setActiveTab("users");
                                    openUserProfile(user.id);
                                  }
                                }}
                              >
                                Open user
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7}>No live sessions right now.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="admin-live-summary">
                  <span>Resume in progress: {stats.ongoingResumeInterviews || 0}</span>
                  <span>Document in progress: {stats.ongoingDocumentInterviews || 0}</span>
                  <span>Users in live session: {stats.usersInLiveSession || 0}</span>
                </div>
              </div>
            )}

            {activeTab === "storage" && (
              <div className="admin-storage-grid animate-fade-in-up">
                <div className="card admin-storage-card">
                  <h4>User document (MongoDB)</h4>
                  <p>Profile, XP, streak, level, aggregated quiz/interview counters, achievements, and a live <code>currentInterview</code> pointer.</p>
                  <ul>
                    <li>Updated on login, quiz completion, interview completion</li>
                    <li>Stats derived server-side from completed sessions</li>
                  </ul>
                </div>
                <div className="card admin-storage-card">
                  <h4>QuizSession collection</h4>
                  <p>Each adaptive quiz or daily challenge creates a session with questions, answers, scores, weak/strong topics, and <code>userId</code> ownership.</p>
                  <ul>
                    <li>Correct answers never sent to client during quiz</li>
                    <li>Grading happens on submit via server</li>
                  </ul>
                </div>
                <div className="card admin-storage-card">
                  <h4>ResumeInterview / DocumentInterview</h4>
                  <p>Full interview lifecycle: config, generated questions, per-answer evaluations, final results, and anti-cheat events (tab switches, fullscreen exits, warnings).</p>
                  <ul>
                    <li>Session GET requires auth + owner match</li>
                    <li>History filtered by authenticated user</li>
                  </ul>
                </div>
                <div className="card admin-storage-card">
                  <h4>Leaderboard entries</h4>
                  <p>Daily challenge and quiz leaderboard rows linked to completed <code>QuizSession</code> IDs — scores cannot be inflated from the client.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
