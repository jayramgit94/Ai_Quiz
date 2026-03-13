import {
  BookOpen,
  Brain,
  MessageCircle,
  Flame,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Shield,
  Sparkles,
  SunMedium,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { path: "/setup", label: "Quiz", Icon: Brain },
  { path: "/daily", label: "Daily", Icon: Zap },
  { path: "/interview", label: "Interview", Icon: MessageSquare },
  { path: "/leaderboard", label: "Ranks", Icon: Trophy },
  { path: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
];

export default function Navbar({ theme = "light", onToggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const xpProgress = (((user?.xp || 0) % 100) / 100) * 100;

  // Hide navbar during interview
  if (
    location.pathname === "/quiz" ||
    location.pathname.includes("interview")
  ) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <div className="navbar-brand" onClick={() => navigate("/")}>
          <span className="navbar-logo-shell">
            <span className="navbar-logo">
              <Zap size={18} />
            </span>
          </span>
          <div className="navbar-brand-copy">
            <span className="navbar-title">AI Quiz Pro</span>
            <span className="navbar-tagline">
              Designed practice for modern learners
            </span>
          </div>
        </div>

        <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`navbar-link ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => {
                navigate(item.path);
                setMenuOpen(false);
              }}
            >
              <span className="navbar-link-icon">
                <item.Icon size={15} />
              </span>
              <span className="navbar-link-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="navbar-right">
          <button
            className="navbar-theme-toggle"
            onClick={onToggleTheme}
            aria-label={
              theme === "light" ? "Switch to dark mode" : "Switch to light mode"
            }
            title={
              theme === "light" ? "Switch to dark mode" : "Switch to light mode"
            }
          >
            {theme === "light" ? <Moon size={16} /> : <SunMedium size={16} />}
          </button>

          {user ? (
            <div className="navbar-profile" ref={profileRef}>
              <button
                className="navbar-avatar-btn"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-label="User profile menu"
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
                    <div className="navbar-dropdown-pill">
                      <Sparkles size={12} /> Learning profile
                    </div>
                    <div className="navbar-dropdown-name">
                      {user.displayName}
                    </div>
                    <div className="navbar-dropdown-email">{user.email}</div>
                    <div className="navbar-dropdown-stats">
                      <span>
                        <Flame
                          size={12}
                          style={{ marginRight: 3, verticalAlign: "middle" }}
                        />
                        {user.streak || 0} day streak
                      </span>
                      <span>
                        <BookOpen
                          size={12}
                          style={{ marginRight: 3, verticalAlign: "middle" }}
                        />
                        {user.totalQuizzes || 0} quizzes
                      </span>
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
                    <LayoutDashboard
                      size={14}
                      style={{ marginRight: 7, verticalAlign: "middle" }}
                    />
                    My Dashboard
                  </button>
                  <button
                    className="navbar-dropdown-item"
                    onClick={() => {
                      navigate("/achievements");
                      setProfileOpen(false);
                    }}
                  >
                    <Trophy
                      size={14}
                      style={{ marginRight: 7, verticalAlign: "middle" }}
                    />
                    Achievements
                  </button>
                  <button
                    className="navbar-dropdown-item"
                    onClick={() => {
                      navigate("/?review=1");
                      setProfileOpen(false);
                    }}
                  >
                    <MessageCircle
                      size={14}
                      style={{ marginRight: 7, verticalAlign: "middle" }}
                    />
                    Add Review
                  </button>
                  <button
                    className="navbar-dropdown-item"
                    onClick={() => {
                      navigate("/admin");
                      setProfileOpen(false);
                    }}
                  >
                    <Shield
                      size={14}
                      style={{ marginRight: 7, verticalAlign: "middle" }}
                    />
                    Admin Panel
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
                    <LogOut
                      size={14}
                      style={{ marginRight: 7, verticalAlign: "middle" }}
                    />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="navbar-guest-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/register")}
              >
                Explore
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate("/login")}
              >
                Sign In
              </button>
            </div>
          )}

          <button
            className="navbar-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={menuOpen}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>
    </nav>
  );
}
