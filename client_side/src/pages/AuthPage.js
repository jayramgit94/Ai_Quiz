import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { loginUser, registerUser } from "../services/api";
import "./AuthPage.css";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const { loginAction } = useAuth();
  const toast = useToast();

  const [isLogin, setIsLogin] = useState(mode === "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (!isLogin && !displayName.trim()) return;

    setLoading(true);
    try {
      let res;
      if (isLogin) {
        res = await loginUser({ email: email.trim(), password });
      } else {
        res = await registerUser({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          country,
        });
      }

      loginAction(res.data.token, res.data.user);
      toast.success(
        isLogin ? "Welcome back!" : "Account created successfully!",
      );
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
      </div>

      <div className="auth-container animate-fade-in-up">
        <div className="auth-header">
          <div className="auth-logo" onClick={() => navigate("/")}>
            <span className="auth-logo-icon">⚡</span>
            <span className="auth-logo-text">AI Quiz Pro</span>
          </div>
          <h1>{isLogin ? "Welcome Back" : "Create Account"}</h1>
          <p>
            {isLogin
              ? "Sign in to continue your learning journey"
              : "Join the AI-powered learning platform"}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="auth-input-group">
              <label>Display Name</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">👤</span>
                <input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="auth-input"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div className="auth-input-group">
            <label>Email</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">✉️</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label>Password</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">🔒</span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder={isLogin ? "Enter password" : "Min 6 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="auth-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="auth-input-group">
              <label>Country (optional)</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">🌍</span>
                <input
                  type="text"
                  placeholder="Your country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" style={{ width: 20, height: 20 }} />
            ) : isLogin ? (
              "Sign In →"
            ) : (
              "Create Account →"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              className="auth-switch-btn"
              onClick={() => {
                setIsLogin(!isLogin);
                navigate(isLogin ? "/register" : "/login", { replace: true });
              }}
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>

        <div className="auth-features">
          <div className="auth-feature">
            <span>🧠</span> AI-Powered Quizzes
          </div>
          <div className="auth-feature">
            <span>🎤</span> Resume Interviews
          </div>
          <div className="auth-feature">
            <span>📊</span> Progress Tracking
          </div>
          <div className="auth-feature">
            <span>🏆</span> Achievements & XP
          </div>
        </div>
      </div>
    </div>
  );
}
