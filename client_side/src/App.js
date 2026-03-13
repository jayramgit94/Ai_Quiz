import { AnimatePresence, motion } from "framer-motion";
import {
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import AchievementsPage from "./pages/AchievementsPage";
import AuthPage from "./pages/AuthPage";
import DailyChallenge from "./pages/DailyChallenge";
import DashboardPage from "./pages/DashboardPage";
import DocumentInterview from "./pages/DocumentInterview";
import InterviewMode from "./pages/InterviewMode";
import LandingPage from "./pages/LandingPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import QuizScreen from "./pages/QuizScreen";
import QuizSetup from "./pages/QuizSetup";
import ResumeInterview from "./pages/ResumeInterview";
import ScoreScreen from "./pages/ScoreScreen";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

function PageWrapper({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageWrapper>
              <LandingPage />
            </PageWrapper>
          }
        />
        <Route
          path="/login"
          element={
            <PageWrapper>
              <AuthPage mode="login" />
            </PageWrapper>
          }
        />
        <Route
          path="/register"
          element={
            <PageWrapper>
              <AuthPage mode="register" />
            </PageWrapper>
          }
        />
        <Route
          path="/setup"
          element={
            <PageWrapper>
              <QuizSetup />
            </PageWrapper>
          }
        />
        <Route
          path="/quiz"
          element={
            <PageWrapper>
              <QuizScreen />
            </PageWrapper>
          }
        />
        <Route
          path="/score"
          element={
            <PageWrapper>
              <ScoreScreen />
            </PageWrapper>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <PageWrapper>
              <LeaderboardPage />
            </PageWrapper>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PageWrapper>
              <DashboardPage />
            </PageWrapper>
          }
        />
        <Route
          path="/interview"
          element={
            <PageWrapper>
              <InterviewMode />
            </PageWrapper>
          }
        />
        <Route
          path="/daily"
          element={
            <PageWrapper>
              <DailyChallenge />
            </PageWrapper>
          }
        />
        <Route
          path="/resume-interview"
          element={
            <PageWrapper>
              <ResumeInterview />
            </PageWrapper>
          }
        />
        <Route
          path="/document-interview"
          element={
            <PageWrapper>
              <DocumentInterview />
            </PageWrapper>
          }
        />
        <Route
          path="/achievements"
          element={
            <PageWrapper>
              <AchievementsPage />
            </PageWrapper>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <div className="app">
            <Navbar />
            <AnimatedRoutes />
          </div>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
