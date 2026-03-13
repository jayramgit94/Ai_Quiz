import {
  ArrowRight,
  Award,
  BarChart2,
  Brain,
  CheckCircle2,
  FileText,
  Flame,
  MessageSquare,
  Mic,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getHeroReviews, publishReview } from "../services/api";
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

const journeys = [
  {
    title: "Quiz Studio",
    desc: "Spin up adaptive technical quizzes in seconds.",
    action: "/setup",
    Icon: Brain,
  },
  {
    title: "Live Interview",
    desc: "Practice follow-up thinking with a real interview flow.",
    action: "/interview",
    Icon: MessageSquare,
  },
  {
    title: "Resume Mock",
    desc: "Turn your resume into an AI-guided practice session.",
    action: "/resume-interview",
    Icon: Mic,
  },
  {
    title: "Document Mock",
    desc: "Upload prepared question banks and rehearse against them.",
    action: "/document-interview",
    Icon: FileText,
  },
];

const outcomes = [
  {
    title: "Focused practice",
    desc: "Every screen is designed to reduce noise and keep attention on the next decision.",
  },
  {
    title: "Clear progression",
    desc: "XP, streaks, analytics, and difficulty signals make improvement easy to read.",
  },
  {
    title: "Interview readiness",
    desc: "From quick quizzes to camera-based mocks, the platform supports the full loop.",
  },
];

const dummyReviews = [
  {
    displayName: "Aarav",
    rating: 5,
    note: "Interview simulation flow feels realistic and helped me answer better under time pressure.",
  },
  {
    displayName: "Meera",
    rating: 5,
    note: "The progress tracking is clean and motivating. I can clearly see where to improve.",
  },
  {
    displayName: "Rohit",
    rating: 4,
    note: "Resume mock rounds are excellent. Feedback is practical and easy to apply quickly.",
  },
  {
    displayName: "Nisha",
    rating: 5,
    note: "Document interview mode is great for preparation from custom question banks.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [liveReviews, setLiveReviews] = useState([]);

  useEffect(() => {
    getHeroReviews()
      .then((res) => setLiveReviews(res.data.reviews || []))
      .catch(() => setLiveReviews([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("review") !== "1") return;
    if (!user) {
      toast.info("Please sign in to submit your review.");
      navigate("/login");
      return;
    }
    setShowReviewModal(true);
  }, [location.search, navigate, toast, user]);

  const ribbonReviews = useMemo(() => {
    const mappedLive = liveReviews.map((r) => ({
      displayName: r.displayName,
      rating: r.rating,
      note: r.note,
    }));
    return [...dummyReviews, ...mappedLive].slice(0, 8);
  }, [liveReviews]);

  const openReviewModal = () => {
    if (!user) {
      toast.info("Please sign in to submit your review.");
      navigate("/login");
      return;
    }
    setShowReviewModal(true);
  };

  const handlePublishReview = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!user || !token) {
      toast.info("Please sign in again to publish your review.");
      navigate("/login");
      return;
    }
    if (!note.trim()) {
      toast.error("Please write your review note.");
      return;
    }

    setPublishing(true);
    try {
      const res = await publishReview({
        rating,
        note: note.trim(),
      });
      setLiveReviews((prev) => [res.data.review, ...prev]);
      setShowReviewModal(false);
      setNote("");
      setRating(5);
      toast.success("Review published successfully.");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error("Session expired. Please login again.");
        navigate("/login");
        return;
      }

      if (!err.response) {
        toast.error(
          "Cannot reach server. Please ensure backend is running and try again.",
        );
        return;
      }

      toast.error(err.response?.data?.error || "Failed to publish review.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="landing has-navbar">
      <div className="landing-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
      </div>

      <section className="hero container">
        <div className="hero-grid">
          <div className="hero-content animate-fade-in-up">
            <div className="hero-badge">
              <span className="badge badge-primary">
                <Sparkles size={12} /> Modern interview practice platform
              </span>
            </div>
            <h1 className="hero-title">
              Practice smarter.
              <br />
              Interview with <span className="gradient-text">clarity</span>.
            </h1>
            <p className="hero-subtitle">
              A calm, premium learning workspace for AI quizzes, resume mocks,
              document-based interviews, and progress tracking that actually
              feels motivating.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => navigate("/setup")}
              >
                Start practicing <ArrowRight size={16} />
              </button>
              <button
                className="btn btn-outline btn-lg"
                onClick={() => navigate("/interview")}
              >
                Open interview mode
              </button>
              {!user && (
                <button
                  className="btn btn-ghost btn-lg"
                  onClick={() => navigate("/register")}
                >
                  Create account
                </button>
              )}
              <button
                className="btn btn-outline btn-lg"
                onClick={openReviewModal}
              >
                Write a review
              </button>
            </div>
            <div className="hero-proof-row">
              <div className="hero-proof-item">
                <CheckCircle2 size={16} /> Adaptive quiz generation
              </div>
              <div className="hero-proof-item">
                <CheckCircle2 size={16} /> Guided mock interviews
              </div>
              <div className="hero-proof-item">
                <CheckCircle2 size={16} /> Progress visibility
              </div>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-value">4</span>
                <span className="stat-label">Practice paths</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-value">AI</span>
                <span className="stat-label">Generated coaching</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-value">∞</span>
                <span className="stat-label">Question variety</span>
              </div>
            </div>
          </div>

          <div className="hero-preview card animate-scale-in">
            <div className="hero-preview-top">
              <div className="hero-preview-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="hero-preview-label">Learning cockpit</span>
            </div>
            <div className="hero-preview-score">
              <div>
                <span className="hero-preview-kicker">Readiness score</span>
                <strong>84 / 100</strong>
              </div>
              <span className="badge badge-success">On track</span>
            </div>
            <div className="hero-preview-panel">
              <div className="hero-preview-head">
                <span>Upcoming focus</span>
                <span>Today</span>
              </div>
              <div className="hero-preview-track">
                <span>System Design</span>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: "78%" }} />
                </div>
              </div>
              <div className="hero-preview-track">
                <span>Behavioral Storytelling</span>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: "64%" }} />
                </div>
              </div>
              <div className="hero-preview-track">
                <span>Core CS Fundamentals</span>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: "86%" }} />
                </div>
              </div>
            </div>
            <div className="hero-preview-grid">
              <div className="hero-preview-card">
                <Mic size={18} />
                <div>
                  <strong>Resume mock</strong>
                  <p>Camera, speech, evaluation</p>
                </div>
              </div>
              <div className="hero-preview-card accent">
                <BarChart2 size={18} />
                <div>
                  <strong>Analytics</strong>
                  <p>Weak spots surfaced fast</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="journey-rail animate-fade-in-up delay-2">
          {journeys.map((journey) => (
            <button
              key={journey.title}
              className="journey-card"
              onClick={() => navigate(journey.action)}
            >
              <span className="journey-icon">
                <journey.Icon size={18} />
              </span>
              <span className="journey-copy">
                <strong>{journey.title}</strong>
                <span>{journey.desc}</span>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>

      <section className="review-ribbon-wrap container animate-fade-in-up">
        <div className="review-ribbon-head">
          <div>
            <span className="section-eyebrow">Community feedback</span>
            <h3>Review belt</h3>
          </div>
          <button
            className="btn btn-ghost btn-sm review-belt-add-btn"
            onClick={openReviewModal}
          >
            Add Review
          </button>
        </div>
        <div className="review-ribbon-track">
          {ribbonReviews.map((item, idx) => (
            <article
              className="review-ribbon-card"
              key={`${item.displayName}-${idx}`}
            >
              <div className="review-ribbon-top">
                <strong>{item.displayName}</strong>
                <span>
                  {"★".repeat(Math.max(1, Math.min(5, item.rating || 5)))}
                </span>
              </div>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="features container">
        <div className="section-head animate-fade-in-up">
          <span className="section-eyebrow">Platform capabilities</span>
          <h2 className="section-title">
            Designed to feel like a learning product, not a tool demo
          </h2>
          <p>
            Strong structure, calmer visuals, and focused interactions make the
            product easier to trust and easier to use.
          </p>
        </div>
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

      <section className="outcomes container animate-fade-in-up">
        <div className="outcomes-grid">
          {outcomes.map((item) => (
            <div key={item.title} className="outcome-card card">
              <span className="outcome-kicker">Why it matters</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta container animate-fade-in-up">
        <div className="cta-card card">
          <div className="cta-copy">
            <span className="section-eyebrow">
              Start with the mode you need
            </span>
            <h2>
              Move from scattered prep to a polished, repeatable practice
              workflow
            </h2>
            <p>
              Launch a quiz, rehearse an interview, or use your own resume and
              documents as context. The product keeps the experience consistent.
            </p>
          </div>
          <div className="cta-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate("/setup")}
            >
              Launch quiz
            </button>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => navigate("/document-interview")}
            >
              Try document mock
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer container">
        <p>
          Built with Grok AI · Adaptive Learning · Open Source · Crafted by
          jayramsang
        </p>
      </footer>

      {showReviewModal && (
        <div
          className="review-modal-overlay"
          onClick={() => setShowReviewModal(false)}
        >
          <div
            className="review-modal-card card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Publish your review</h3>
            <p>Only logged-in users can submit reviews.</p>
            <form onSubmit={handlePublishReview}>
              <div className="input-group">
                <label>Rating</label>
                <div className="review-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`review-star-btn ${n <= rating ? "active" : ""}`}
                      onClick={() => setRating(n)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label>Note</label>
                <textarea
                  className="input"
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Share your feedback..."
                  required
                />
                <small style={{ color: "var(--text-muted)" }}>
                  Minimum 8 characters.
                </small>
              </div>
              <div className="review-modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowReviewModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={publishing}
                >
                  {publishing ? "Publishing..." : "Publish review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
