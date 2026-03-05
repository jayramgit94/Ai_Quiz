import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Hide navbar during interview
  if (
    location.pathname === "/quiz" ||
    location.pathname.includes("interview")
  ) {
    return null;
  }

  const navItems = [
    { path: "/setup", label: "Quiz", icon: "🧠" },
    { path: "/daily", label: "Daily", icon: "⚡" },
    { path: "/interview", label: "Interview", icon: "💬" },
    { path: "/resume-interview", label: "Resume", icon: "🎤" },
    { path: "/leaderboard", label: "Ranks", icon: "🏆" },
    { path: "/dashboard", label: "Dashboard", icon: "📊" },
  ];

  const xpForNextLevel = (user?.level || 1) * 100;
  const xpProgress = (((user?.xp || 0) % 100) / 100) * 100;

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <div className="navbar-brand" onClick={() => navigate("/")}>
          <span className="navbar-logo">⚡</span>
          <span className="navbar-title">AI Quiz Pro</span>
        </div>

        <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`navbar-link ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => {
                navigate(item.path);
                setMenuOpen(false);
              }}
            >
              <span className="navbar-link-icon">{item.icon}</span>
              <span className="navbar-link-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="navbar-right">
          {user ? (
            <div className="navbar-profile">
              <button
                className="navbar-avatar-btn"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <div className="navbar-xp-ring">
                  <svg viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="2"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2"
                      strokeDasharray={`${xpProgress} 100`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                  <span className="navbar-avatar-text">
                    {(user.displayName || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="navbar-user-info">
                  <span className="navbar-username">{user.displayName}</span>
                  <span className="navbar-level">
                    Lv.{user.level || 1} · {user.xp || 0} XP
                  </span>
                </div>
              </button>

              {profileOpen && (
                <div className="navbar-dropdown animate-scale-in">
                  <div className="navbar-dropdown-header">
                    <div className="navbar-dropdown-name">
                      {user.displayName}
                    </div>
                    <div className="navbar-dropdown-email">{user.email}</div>
                    <div className="navbar-dropdown-stats">
                      <span>🔥 {user.streak || 0} day streak</span>
                      <span>📝 {user.totalQuizzes || 0} quizzes</span>
                    </div>
                  </div>
                  <div className="navbar-dropdown-divider" />
                  <button
                    className="navbar-dropdown-item"
                    onClick={() => {
                      navigate("/dashboard");
                      setProfileOpen(false);
                    }}
                  >
                    📊 My Dashboard
                  </button>
                  <button
                    className="navbar-dropdown-item"
                    onClick={() => {
                      navigate("/achievements");
                      setProfileOpen(false);
                    }}
                  >
                    🏆 Achievements
                  </button>
                  <div className="navbar-dropdown-divider" />
                  <button
                    className="navbar-dropdown-item logout"
                    onClick={() => {
                      logout();
                      navigate("/login");
                      setProfileOpen(false);
                    }}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
          )}

          <button
            className="navbar-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>
    </nav>
  );
}
