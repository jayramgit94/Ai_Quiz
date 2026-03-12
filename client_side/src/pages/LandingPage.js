import {
  Award,
  BarChart2,
  Brain,
  Flame,
  MessageSquare,
  Mic,
  Target,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LandingPage.css";

const features = [
  {
    Icon: Brain,
    title: "AI-Generated Quizzes",
    desc: "Powered by Grok AI for technically accurate, high-quality questions.",
  },
  {
    Icon: Target,
    title: "Adaptive Difficulty",
    desc: "System auto-calibrates difficulty based on your performance.",
  },
  {
    Icon: MessageSquare,
    title: "Interview Simulation",
    desc: "Mock interview mode with AI follow-up questions and evaluation.",
  },
  {
    Icon: BarChart2,
    title: "Smart Analytics",
    desc: "Confidence tracking, weak topic detection, and speed scoring.",
  },
  {
    Icon: Trophy,
    title: "Daily Challenges",
    desc: "Fresh quiz every day with a resetting leaderboard.",
  },
  {
    Icon: Flame,
    title: "Topic Heatmap",
    desc: "Visual dashboard showing your learning progress across topics.",
  },
  {
    Icon: Mic,
    title: "Resume Interview",
    desc: "Upload your resume for AI-powered mock interviews with camera, speech-to-text & evaluation.",
  },
  {
    Icon: Award,
    title: "XP & Achievements",
    desc: "Earn XP, level up, unlock achievements, and compete on the leaderboard.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="landing has-navbar">
      {/* Ambient background */}
      <div className="landing-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
      </div>

      {/* Hero */}
      <section className="hero container">
        <div className="hero-content animate-fade-in-up">
          <div className="hero-badge">
            <span className="badge badge-primary">✨ AI-Powered Learning</span>
          </div>
          <h1 className="hero-title">
            Practice Technical
            <br />
            Interviews with <span className="gradient-text">AI</span>
          </h1>
          <p className="hero-subtitle">
            AI-generated quizzes, adaptive difficulty, mock interviews, and
            smart analytics. Master any technical topic with intelligent
            practice.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate("/setup")}
            >
              Start Quiz →
            </button>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => navigate("/interview")}
            >
              Interview Mode
            </button>
            {!user && (
              <button
                className="btn btn-ghost btn-lg"
                onClick={() => navigate("/register")}
              >
                Create Account
              </button>
            )}
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">10+</span>
              <span className="stat-label">Features</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">AI</span>
              <span className="stat-label">Powered</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">∞</span>
              <span className="stat-label">Questions</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features container">
        <h2 className="section-title animate-fade-in-up">
          Why This is Different
        </h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div
              key={i}
              className={`feature-card card animate-fade-in-up delay-${(i % 5) + 1}`}
            >
              <div className="feature-icon">
                <f.Icon size={26} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta container animate-fade-in-up">
        <div className="cta-card card">
          <h2>Ready to Level Up?</h2>
          <p>Start a quiz now and see how AI adapts to your skill level.</p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate("/setup")}
          >
            Get Started →
          </button>
        </div>
      </section>

      <footer className="landing-footer container">
        <p>Built with Grok AI · Adaptive Learning · Open Source</p>
      </footer>
    </div>
  );
}
