import { Rocket } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { expandTopic } from "../services/api";
import "./QuizSetup.css";

export default function QuizSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userName, setUserName] = useState(user?.displayName || "");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [subtopics, setSubtopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicExpanded, setTopicExpanded] = useState(false);

  const handleExpandTopic = async () => {
    if (!topic.trim()) return;
    setLoadingTopics(true);
    try {
      const res = await expandTopic(topic.trim());
      setSubtopics(res.data.subtopics || []);
      setTopicExpanded(true);
    } catch (err) {
      console.error("Topic expansion failed:", err);
    }
    setLoadingTopics(false);
  };

  const handleStart = () => {
    if (!userName.trim() || !topic.trim()) return;
    navigate("/quiz", {
      state: {
        userName: userName.trim(),
        topic: topic.trim(),
        difficulty,
        numQuestions,
        subtopics,
      },
    });
  };

  return (
    <div className="setup-page has-navbar">
      <div className="container-sm">
        <button
          className="btn btn-ghost btn-sm back-btn"
          onClick={() => navigate("/")}
        >
          ← Back
        </button>

        <div className="setup-card card animate-fade-in-up">
          <div className="setup-header">
            <span className="setup-icon">
              <Rocket size={30} />
            </span>
            <h2>Quiz Setup</h2>
            <p>Configure your AI-powered quiz session</p>
          </div>

          <div className="setup-form">
            <div className="input-group">
              <label>Your Name</label>
              <input
                className="input"
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Topic</label>
              <div className="topic-input-row">
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. DBMS, DSA, Operating Systems"
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    setTopicExpanded(false);
                  }}
                />
                <button
                  className="btn btn-outline btn-sm expand-btn"
                  onClick={handleExpandTopic}
                  disabled={loadingTopics || !topic.trim()}
                >
                  {loadingTopics ? (
                    <span
                      className="spinner"
                      style={{ width: 16, height: 16 }}
                    />
                  ) : (
                    "🔍 Expand"
                  )}
                </button>
              </div>
            </div>

            {topicExpanded && subtopics.length > 0 && (
              <div className="subtopics-list animate-fade-in-up">
                <label>AI-Detected Subtopics</label>
                <div className="subtopic-tags">
                  {subtopics.map((st, i) => (
                    <span key={i} className="subtopic-tag badge badge-primary">
                      {st}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="input-group">
              <label>Difficulty</label>
              <div className="difficulty-selector">
                {["easy", "medium", "hard"].map((d) => (
                  <button
                    key={d}
                    className={`difficulty-btn ${difficulty === d ? "active" : ""} ${d}`}
                    onClick={() => setDifficulty(d)}
                  >
                    <span className="diff-emoji">
                      {d === "easy" ? "🌱" : d === "medium" ? "⚡" : "🔥"}
                    </span>
                    <span className="diff-label">
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </span>
                    <span className="diff-desc">
                      {d === "easy"
                        ? "Definitions"
                        : d === "medium"
                          ? "Conceptual"
                          : "Scenario-based"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label>Number of Questions</label>
              <div className="num-selector">
                {[3, 5, 10, 15].map((n) => (
                  <button
                    key={n}
                    className={`num-btn ${numQuestions === n ? "active" : ""}`}
                    onClick={() => setNumQuestions(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg btn-block start-btn"
              onClick={handleStart}
              disabled={!userName.trim() || !topic.trim()}
            >
              Start Quiz →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
