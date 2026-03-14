import { BarChart2, Clock3, Shield, Star, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, getAdminOverview, getAdminStatus } from "../services/api";
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

  const isLoggedIn = Boolean(token);

  const loadOverview = async (adminToken) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getAdminOverview(adminToken);
      setOverview(data);
    } catch (err) {
      setOverview(null);
      setError(err.response?.data?.error || "Failed to load admin data.");
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken("");
      }
    } finally {
      setLoading(false);
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
            <div className="admin-stats-grid animate-fade-in-up">
              <div className="card admin-stat">
                <span>Total users</span>
                <strong>{stats.totalUsers || 0}</strong>
              </div>
              <div className="card admin-stat">
                <span>Active (7 days)</span>
                <strong>{stats.activeLast7Days || 0}</strong>
              </div>
              <div className="card admin-stat">
                <span>Total quizzes</span>
                <strong>{stats.totalQuizzes || 0}</strong>
              </div>
              <div className="card admin-stat">
                <span>Total interviews</span>
                <strong>{stats.totalInterviews || 0}</strong>
              </div>
              <div className="card admin-stat">
                <span>Average XP</span>
                <strong>{stats.averageXp || 0}</strong>
              </div>
              <div className="card admin-stat">
                <span>Overall accuracy</span>
                <strong>{stats.overallAccuracy || 0}%</strong>
              </div>
              <div className="card admin-stat">
                <span>Total reviews</span>
                <strong>{stats.totalReviews || 0}</strong>
              </div>
              <div className="card admin-stat">
                <span>Average review rating</span>
                <strong>{stats.averageReviewRating || 0}/5</strong>
              </div>
            </div>

            <div className="card admin-table-wrap animate-fade-in-up delay-1">
              <h3>
                <Users
                  size={16}
                  style={{ marginRight: 6, verticalAlign: "middle" }}
                />
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
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="admin-secondary-grid">
              <div className="card admin-table-wrap animate-fade-in-up delay-1">
                <h3>
                  <Clock3
                    size={16}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
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

              <div className="card admin-table-wrap animate-fade-in-up delay-1">
                <h3>
                  <Star
                    size={16}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
                  Recent Reviews
                </h3>
                <div className="admin-reviews-list">
                  {(overview.recentReviews || []).length ? (
                    (overview.recentReviews || []).map((review, idx) => (
                      <div
                        className="admin-review-item"
                        key={`${review.displayName}-${idx}`}
                      >
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
