import { useState, useEffect, useCallback } from "react";
import { P, ff } from "./styles/theme";
import { useApp } from "./context/AppContext";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import MoodleConnect from "./pages/MoodleConnect";
import Dashboard from "./pages/Dashboard";
import CourseDetail from "./pages/CourseDetail";
import Career from "./pages/Career";
import Chat from "./pages/Chat";
import Planner from "./pages/Planner";
import Quiz from "./pages/Quiz";
import SettingsPage from "./pages/Settings";
import LibraryPage from "./pages/Library";
import WolframPage from "./pages/Wolfram";
import ScanNotesPage from "./pages/ScanNotes";
import CoursesPage from "./pages/Courses";
import MessagesPage from "./pages/Messages";
import LiveChatPage from "./pages/LiveChat";
import QuizzesPage from "./pages/Quizzes";

export default function App() {
  const { user, moodleToken, courses, selectedCourse, setSelectedCourse, loginWithGoogle, setGoogleTokens } = useApp();
  const [screen, setScreen] = useState(() => {
    try { return localStorage.getItem("studium_screen") || "dashboard"; } catch { return "dashboard"; }
  });
  const [quizCourse, setQuizCourse] = useState(null);

  // Persist screen on change
  useEffect(() => {
    try { localStorage.setItem("studium_screen", screen); } catch {}
  }, [screen]);

  // ── Browser history management ──
  const pushHistory = useCallback((newScreen, courseId = null) => {
    history.pushState({ screen: newScreen, courseId }, "", `#${newScreen}`);
  }, []);

  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;
      if (state?.screen) {
        setScreen(state.screen);
        if (state.courseId && courses.length > 0) {
          const c = courses.find(c => c.id === state.courseId);
          if (c) setSelectedCourse(c);
          else setSelectedCourse(null);
        } else {
          setSelectedCourse(null);
        }
        setQuizCourse(null);
      } else {
        setScreen("dashboard");
        setSelectedCourse(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    if (!history.state) history.replaceState({ screen }, "", `#${screen}`);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [courses, setSelectedCourse, screen]);

  // Check if we're on the OAuth callback
  const isCallback = window.location.pathname === "/auth/callback" || window.location.search.includes("code=");

  if (isCallback) {
    return (
      <AuthCallback
        onSuccess={(data) => { setGoogleTokens(data); loginWithGoogle(data.user); }}
        onError={() => window.location.href = "/"}
      />
    );
  }

  if (!user) {
    return <Login onMockLogin={() => loginWithGoogle({ name: "Estudiante UCALP", email: "alumno@ucalpvirtual.edu.ar" })} />;
  }

  if (!moodleToken) return <MoodleConnect onConnected={() => setScreen("dashboard")} />;

  const navigate = (target) => {
    pushHistory(target);
    setScreen(target);
    setSelectedCourse(null);
    setQuizCourse(null);
  };

  const selectCourse = (course) => {
    pushHistory("course", course.id);
    setSelectedCourse(course);
    setScreen("course");
  };

  const navigateQuiz = (course) => {
    pushHistory("quiz", course?.id);
    setQuizCourse(course);
    setScreen("quiz");
  };

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <Dashboard onNavigate={navigate} onSelectCourse={selectCourse} />;
      case "course":
        return selectedCourse ? (
          <CourseDetail course={selectedCourse}
            onBack={() => history.back()}
            onNavigateChat={() => { pushHistory("chat"); setScreen("chat"); }}
            onNavigateQuiz={navigateQuiz} />
        ) : <Dashboard onNavigate={navigate} onSelectCourse={selectCourse} />;
      case "chat": return <Chat />;
      case "courses": return <CoursesPage onSelectCourse={selectCourse} />;
      case "messages": return <MessagesPage />;
      case "livechat": return <LiveChatPage />;
      case "quizzes": return <QuizzesPage />;
      case "career": return <Career />;
      case "library": return <LibraryPage />;
      case "wolfram": return <WolframPage />;
      case "scan": return <ScanNotesPage />;
      case "planner": return <Planner />;
      case "quiz": return <Quiz initialCourse={quizCourse} />;
      case "settings": return <SettingsPage />;
      default: return <Dashboard onNavigate={navigate} onSelectCourse={selectCourse} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: P.bg, fontFamily: ff.body }}>
      <Sidebar currentScreen={screen} onNavigate={navigate} />
      <main style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
        {renderScreen()}
      </main>
    </div>
  );
}