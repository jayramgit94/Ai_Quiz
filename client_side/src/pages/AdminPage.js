import { BarChart2, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, getAdminOverview } from "../services/api";
import "./AdminPage.css";

const ADMIN_TOKEN_KEY = "ai-quiz-admin-token";

export default function AdminPage() {
  const navigate = useNavigate();

  const [token, setToken] = useState(
    () => localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  );
  const [username, setUsername] = useState("jayramsang");
  const [password, setPassword] = useState("942143");
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
            <form onSubmit={handleLogin} className="admin-login-form">
              <div className="input-group">
                <label>Username</label>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <div className="admin-error">{error}</div>}
              <button className="btn btn-primary btn-block" disabled={loading}>
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
                    {(overview.topUsers || []).map((u) => (
                      <tr key={`${u.email}-${u.displayName}`}>
                        <td>{u.displayName}</td>
                        <td>{u.email}</td>
                        <td>{u.xp}</td>
                        <td>{u.level}</td>
                        <td>{u.totalQuizzes}</td>
                        <td>{u.totalInterviews}</td>
                        <td>{u.bestAccuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
