import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  PlusSquare,
  Search,
  MessageCircle,
  User,
  Heart,
  Share2,
  Send,
  Sparkles,
  MoreHorizontal,
  X,
  Edit3,
  Users,
  Bot,
  Image as ImageIcon,
  Type,
  Palette,
  Copy,
  ChevronLeft,
  PenTool,
  RefreshCw,
  Download,
  BookOpen,
  Bell,
  LogOut,
  Lock,
  Mail,
  Calendar,
  Save,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  limit,
  writeBatch,
  where,
} from "firebase/firestore";

import { auth, db } from "./firebase.js";
const appId = "soul-scribe-v1";

/**
 * GEMINI API UTILITIES
 */
const GEMINI_API_KEY = "AIzaSyBp_meA1GySMbz5_njoXLpyz_4hjvyVBp8"; // Injected by environment
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// Mock data for fallbacks when API quota is exceeded
const MOCK_QUOTES = [
  "The soul has been given its own ears to hear things the mind does not understand. – Rumi",
  "Your heart is the size of an ocean. Go find yourself in its hidden depths. – Rumi",
  "What you seek is seeking you. – Rumi",
  "Where there is ruin, there is hope for a treasure. – Rumi",
  "Silence is the language of God, all else is poor translation. – Rumi",
  "Do not be satisfied with the stories that come before you. Unfold your own myth. – Rumi",
];

// Demo data for seeding
const DEMO_QUOTES_DATA = [
  {
    text: "The wound is the place where the Light enters you.",
    authorName: "Rumi",
    themeId: "classic",
  },
  {
    text: "I wish I could show you when you are lonely or in darkness the astonishing light of your own being.",
    authorName: "Hafiz",
    themeId: "warm",
  },
  {
    text: "What you seek is seeking you.",
    authorName: "Rumi",
    themeId: "parchment",
  },
  {
    text: "Do not be satisfied with the stories that come before you. Unfold your own myth.",
    authorName: "Rumi",
    themeId: "classic",
  },
  {
    text: "The universe is not outside of you. Look inside yourself; everything that you want, you already are.",
    authorName: "Rumi",
    themeId: "classic",
  },
];

const callGemini = async (prompt, systemInstruction = "") => {
  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }] }
        : undefined,
    };

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API Error Detail:", data);
      throw new Error(data.error?.message || "API Error");
    }
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn't generate that right now."
    );
  } catch (error) {
    console.error("Gemini Error:", error);
    const isQuoteRequest =
      prompt.toLowerCase().includes("quote") ||
      systemInstruction.toLowerCase().includes("quote");
    if (isQuoteRequest) {
      const randomQuote =
        MOCK_QUOTES[Math.floor(Math.random() * MOCK_QUOTES.length)];
      return randomQuote;
    }
    return "My connection to the universal muse is faint right now. Please try again in a moment.";
  }
};

/**
 * HELPER FUNCTIONS & STYLES
 */
const THEMES = [
  {
    id: "classic",
    name: "Classic",
    style: { backgroundColor: "#ffffff", color: "#2c1810" },
  },
  {
    id: "dark",
    name: "Noir",
    style: { backgroundColor: "#1a1a1a", color: "#e0d6c9" },
  },
  {
    id: "parchment",
    name: "Antique",
    style: { backgroundColor: "#f0e6d2", color: "#3e2723" },
  },
  {
    id: "warm",
    name: "Sepia",
    style: { backgroundColor: "#eaddcf", color: "#4a3b32" },
  },
  {
    id: "midnight",
    name: "Ink",
    style: { backgroundColor: "#232f3e", color: "#f2f2f2" },
  },
  {
    id: "forest",
    name: "Moss",
    style: { backgroundColor: "#354f42", color: "#f1f8e9" },
  },
];

/**
 * MAIN COMPONENT
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("feed");
  const [unreadCount, setUnreadCount] = useState(0);

  // Auth State
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // 1. DYNAMICALLY INJECT BOOTSTRAP CSS & HTML2CANVAS
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css";
    link.rel = "stylesheet";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);

    const font = document.createElement("link");
    font.href =
      "https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap";
    font.rel = "stylesheet";
    document.head.appendChild(font);

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Auth Logic
  useEffect(() => {
    const initAuth = async () => {
      // Only use custom token if provided (e.g. preview environment)
      // Otherwise wait for manual sign in
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Notification Listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "notifications"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const myNotifs = snap.docs
        .map((d) => d.data())
        .filter((d) => d.recipientId === user.uid && !d.read);
      setUnreadCount(myNotifs.length);
    });
    return () => unsub();
  }, [user]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          authEmail,
          authPassword
        );

        const user = userCredential.user;

        await updateProfile(user, {
          displayName: authName,
        });

        await setDoc(
          doc(db, "artifacts", appId, "users", user.uid, "profile", "info"),
          {
            name: authName,          // fallback
            penName: authName,       // primary
            email: user.email,
            uid: user.uid,
            createdAt: new Date(),
          },
          { merge: true } // 🔥 important if doc already exists
        );
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err) {
      console.error(err);
      setAuthError(err.message.replace("Firebase: ", "").replace("auth/", ""));
    } finally {
      setAuthLoading(false);
    }
  };

  const navigate = (newView) => {
    setView(newView);
  };

  // RENDER: AUTH SCREEN (If no user)
  if (!user) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center vh-100 px-4"
        style={{ backgroundColor: "#fdfbf7", color: "#2c1810" }}
      >
         <style>{`
        :root { 
          --bs-primary: #8B4513; /* Saddle Brown */
          --bs-primary-rgb: 139, 69, 19;
          --bs-body-bg: #fdfbf7;
          --bs-body-color: #2c1810;
        }
        body { 
          font-family: 'Libre Baskerville', 'Georgia', serif; 
          background-color: #f0e6d2; 
        }
        .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .btn-primary { background-color: var(--bs-primary); border-color: var(--bs-primary); }
        .text-primary { color: var(--bs-primary) !important; }
        .bg-primary-subtle { background-color: #FAF0E6 !important; color: #8B4513 !important; } 
        .quote-card { transition: transform 0.2s; }
        .floating-fab { box-shadow: 0 4px 10px rgba(139, 69, 19, 0.3); }
        .book-spine-shadow { box-shadow: inset 15px 0 20px -10px rgba(0,0,0,0.05); }
        .form-control:focus { border-color: #8B4513; box-shadow: none; }
      `}</style>
        <div className="mb-4 text-center animate-fade-in">
          <div
            className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow mx-auto mb-3"
            style={{ width: "64px", height: "64px" }}
          >
            <BookOpen size={32} strokeWidth={2} />
          </div>
          <h1
            className="h2 fw-bold text-dark mb-1"
            style={{ letterSpacing: "-0.5px" }}
          >
            Socio Vibes
          </h1>
          <p className="text-muted fst-italic">Where souls scribble.</p>
        </div>

        <div
          className="card border-0 shadow-lg p-4 w-100 rounded-4"
          style={{ maxWidth: "360px", backgroundColor: "#fffbf0" }}
        >
          <form onSubmit={handleAuthSubmit}>
            {isSignUp  &&
              <div className="mb-3">
                <label
                  className="form-label small fw-bold text-muted text-uppercase"
                  style={{ fontSize: "10px", letterSpacing: "1px" }}
                >
                  Name
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0 text-muted">
                    <Mail size={16} />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 bg-white shadow-none"
                    placeholder="John Doe"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                  />
                </div>
              </div>
            }
            <div className="mb-3">
              <label
                className="form-label small fw-bold text-muted text-uppercase"
                style={{ fontSize: "10px", letterSpacing: "1px" }}
              >
                Email Address
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  className="form-control border-start-0 bg-white shadow-none"
                  placeholder="writer@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mb-4">
              <label
                className="form-label small fw-bold text-muted text-uppercase"
                style={{ fontSize: "10px", letterSpacing: "1px" }}
              >
                Password
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  className="form-control border-start-0 bg-white shadow-none"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {authError && (
              <div className="alert alert-danger py-2 small mb-3">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="btn btn-primary w-100 rounded-pill fw-bold shadow-sm py-2"
              
            >
              {authLoading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : isSignUp ? (
                "Join the Circle"
              ) : (
                "Open Journal"
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="btn btn-link text-decoration-none text-muted small p-0"
            >
              {isSignUp
                ? "Already a member? Sign In"
                : "New here? Create an Account"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: MAIN APP
  return (
    <div
      className="d-flex flex-column vh-100 mx-auto shadow-lg position-relative overflow-hidden"
      style={{
        maxWidth: "480px",
        backgroundColor: "#fdfbf7",
        color: "#2c1810",
      }}
    >
      {/* Global Style Overrides */}
      <style>{`
        :root { 
          --bs-primary: #8B4513; /* Saddle Brown */
          --bs-primary-rgb: 139, 69, 19;
          --bs-body-bg: #fdfbf7;
          --bs-body-color: #2c1810;
        }
        body { 
          font-family: 'Libre Baskerville', 'Georgia', serif; 
          background-color: #f0e6d2; 
        }
        .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .btn-primary { background-color: var(--bs-primary); border-color: var(--bs-primary); }
        .text-primary { color: var(--bs-primary) !important; }
        .bg-primary-subtle { background-color: #FAF0E6 !important; color: #8B4513 !important; } 
        .quote-card { transition: transform 0.2s; }
        .floating-fab { box-shadow: 0 4px 10px rgba(139, 69, 19, 0.3); }
        .book-spine-shadow { box-shadow: inset 15px 0 20px -10px rgba(0,0,0,0.05); }
        .form-control:focus { border-color: #8B4513; box-shadow: none; }
      `}</style>

      {/* Header */}
      <nav
        className="navbar navbar-light px-3 sticky-top border-bottom border-black border-opacity-10"
        style={{ height: "64px", zIndex: 1020, backgroundColor: "#fdfbf7" }}
      >
        <div className="d-flex align-items-center gap-2">
          <div
            className="text-primary d-flex align-items-center justify-content-center"
            style={{ width: "32px", height: "32px" }}
          >
            <BookOpen size={24} strokeWidth={2} />
          </div>
          <span
            className="navbar-brand mb-0 h1 fs-4 fw-bold text-dark"
            style={{ letterSpacing: "-0.5px" }}
          >
            Socio Vibes
          </span>
        </div>
        <div className="d-flex align-items-center gap-3">
          <button
            onClick={() => navigate("notifications")}
            className={`btn btn-link p-2 text-secondary position-relative border-0 hover-shadow ${
              view === "notifications" ? "text-primary" : ""
            }`}
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light"
                style={{ fontSize: "9px", padding: "0.25em 0.4em" }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <div
            className="rounded-circle border border-primary overflow-hidden bg-primary bg-opacity-10"
            style={{ width: "36px", height: "36px" }}
          >
            <div
              className="w-100 h-100 d-flex align-items-center justify-content-center text-primary fw-bold"
              style={{ fontSize: "14px" }}
            >
              {user.uid.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main
        className="flex-grow-1 overflow-auto pb-5 scrollbar-hide book-spine-shadow"
        style={{ backgroundColor: "#fdfbf7" }}
      >
        <div className="pb-5">
          {view === "feed" && <FeedView user={user} navigate={navigate} />}
          {view === "create" && (
            <CreateQuoteView user={user} onPost={() => navigate("feed")} />
          )}
          {view === "explore" && (
            <AIExplorerView
              user={user}
              onUseQuote={(text) => {
                navigate("create");
              }}
            />
          )}
          {view === "chat" && <ChatHubView user={user} />}
          {view === "profile" && <ProfileView user={user} />}
          {view === "notifications" && <NotificationsView user={user} />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <div
        className="d-flex justify-content-around align-items-center position-absolute bottom-0 w-100 border-top"
        style={{ height: "70px", zIndex: 1030, backgroundColor: "#fdfbf7" }}
      >
        <NavButton
          icon={Home}
          label="Read"
          active={view === "feed"}
          onClick={() => navigate("feed")}
        />
        <NavButton
          icon={Search}
          label="Seek"
          active={view === "explore"}
          onClick={() => navigate("explore")}
        />

        <div className="position-relative" style={{ top: "-10px" }}>
          <button
            onClick={() => navigate("create")}
            className="btn btn-primary rounded-circle floating-fab d-flex align-items-center justify-content-center border-4 border-white"
            style={{ width: "56px", height: "56px" }}
          >
            <PenTool size={24} />
          </button>
        </div>

        <NavButton
          icon={MessageCircle}
          label="Discuss"
          active={view === "chat"}
          onClick={() => navigate("chat")}
        />
        <NavButton
          icon={User}
          label="Author"
          active={view === "profile"}
          onClick={() => navigate("profile")}
        />
      </div>
    </div>
  );
}

/**
 * VIEW COMPONENTS
 */

function FeedView({ user, navigate }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  const seedData = async () => {
    try {
      const batch = writeBatch(db);
      DEMO_QUOTES_DATA.forEach((q) => {
        const ref = doc(
          collection(db, "artifacts", appId, "public", "data", "quotes")
        );
        batch.set(ref, {
          ...q,
          authorId: "demo_user",
          likes: [],
          comments: [],
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (e) {
      console.error("Error seeding:", e);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "quotes"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // OPTIMISTIC UI: If feed is empty on first load, show demo data INSTANTLY
        if (docs.length === 0 && !seededRef.current) {
          seededRef.current = true;

          const optimisticQuotes = DEMO_QUOTES_DATA.map((q, i) => ({
            id: `temp-${i}`,
            ...q,
            authorId: "demo_user",
            likes: [],
            comments: [],
            createdAt: { seconds: Date.now() / 1000 },
          }));

          setQuotes(optimisticQuotes);
          setLoading(false);
          seedData();
        } else {
          setQuotes(docs);
          setLoading(false);
        }
      },
      (err) => {
        console.error("Feed error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading)
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5 mt-5">
        <div
          className="spinner-border text-primary mb-3 text-opacity-50"
          style={{ width: "2rem", height: "2rem", borderWidth: "2px" }}
        ></div>
        <p className="small text-muted fst-italic">Turning pages...</p>
      </div>
    );

  return (
    <div className="container-fluid px-0 pt-3">
      <div className="px-4 pb-2 text-center mb-2">
        <small
          className="text-uppercase text-secondary fw-bold letter-spacing-1 font-sans"
          style={{ fontSize: "10px", letterSpacing: "2px" }}
        >
          Volume I
        </small>
        <div className="border-bottom border-secondary opacity-25 w-50 mx-auto mt-2"></div>
      </div>

      {quotes.map((quote) => (
        <React.Fragment key={quote.id}>
          <QuoteCard quote={quote} user={user} />
          <div
            className="text-center my-4 opacity-25 text-primary fw-bold"
            style={{ fontSize: "18px" }}
          >
            ~ ❦ ~
          </div>
        </React.Fragment>
      ))}

      {quotes.length > 0 && (
        <div className="text-center pb-4 pt-2">
          <p className="small text-muted mb-3 fst-italic">End of chapter.</p>
          <button
            onClick={seedData}
            className="btn btn-outline-primary btn-sm rounded-0 px-4 font-sans text-uppercase"
            style={{ fontSize: "11px", letterSpacing: "1px" }}
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

function QuoteCard({ quote, user }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const liked = quote.likes?.includes(user.uid);
  const theme = THEMES.find((t) => t.id === quote.themeId) || THEMES[0];

  const sendNotification = async (type, text) => {
    if (quote.authorId && quote.authorId !== user.uid) {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "notifications"),
        {
          recipientId: quote.authorId,
          senderName: "Reader " + user.uid.substring(0, 4),
          type: type,
          message: text,
          read: false,
          createdAt: serverTimestamp(),
        }
      );
    }
  };

  const handleLike = async () => {
    const ref = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "quotes",
      quote.id
    );
    if (liked) {
      await updateDoc(ref, { likes: arrayRemove(user.uid) });
    } else {
      await updateDoc(ref, { likes: arrayUnion(user.uid) });
      sendNotification("like", "liked your quote.");
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const ref = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "quotes",
      quote.id
    );
    const newComment = {
      text: commentText,
      uid: user.uid,
      username: "User " + user.uid.slice(0, 4),
      createdAt: Date.now(),
    };
    await updateDoc(ref, { comments: arrayUnion(newComment) });
    sendNotification(
      "comment",
      `commented: "${commentText.substring(0, 20)}..."`
    );
    setCommentText("");
  };

  const handleShare = () => {
    const text = `"${quote.text}" - ${quote.authorName} on Socio Vibes`;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(`share-${quote.id}`);
    if (btn) {
      const original = btn.innerHTML;
      btn.innerText = "✓";
      setTimeout(() => {
        btn.innerHTML = original;
      }, 2000);
    }
  };

  const downloadImage = async () => {
    const element = document.getElementById(`quote-card-${quote.id}`);
    if (!element) return;
    try {
      const html2canvas = window.html2canvas;
      if (!html2canvas) {
        alert("Preparing ink... try again.");
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });

      // Try Web Share API first
      canvas.toBlob(async (blob) => {
        if (
          blob &&
          navigator.canShare &&
          navigator.canShare({
            files: [new File([blob], "quote.png", { type: "image/png" })],
          })
        ) {
          try {
            await navigator.share({
              files: [
                new File([blob], `socio-vibes-${quote.id}.png`, {
                  type: "image/png",
                }),
              ],
              title: "Socio Vibes Quote",
              text: "A thought from Socio Vibes.",
            });
            return;
          } catch (e) {
            console.warn("Share failed, using download fallback", e);
          }
        }

        // Fallback to Download
        const link = document.createElement("a");
        link.download = `socio-vibes-${quote.id}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, "image/png");
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div className="mx-3 mb-2 position-relative">
      <div
        id={`quote-card-${quote.id}`}
        className="p-4 p-md-5 text-center position-relative w-100 shadow-sm"
        style={{
          minHeight: "280px",
          ...theme.style,
          borderLeft: "4px solid #8B4513",
          borderRadius: "2px 8px 8px 2px",
        }}
      >
        <div className="w-100 py-3 d-flex flex-column justify-content-center align-items-center h-100">
          <div className="mb-3 opacity-25">
            <span
              style={{
                fontSize: "4rem",
                lineHeight: 0.5,
                fontFamily: "Georgia, serif",
              }}
            >
              “
            </span>
          </div>
          <p
            className="fs-4 fw-normal px-2 text-break lh-base"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {quote.text}
          </p>
          <div
            className="mt-4 small text-uppercase opacity-75 fw-bold letter-spacing-2 font-sans"
            style={{
              fontSize: "0.7rem",
              letterSpacing: "2px",
              color: theme.color,
            }}
          >
            — {quote.authorName}
          </div>
          <div
            className="position-absolute bottom-0 end-0 p-3 opacity-25 small fst-italic"
            style={{ fontSize: "0.6rem" }}
          >
            Socio Vibes
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center px-2 mt-2">
        <div className="d-flex align-items-center gap-2">
          <small className="text-muted font-sans" style={{ fontSize: "10px" }}>
            {quote.createdAt
              ? new Date(quote.createdAt.seconds * 1000).toLocaleDateString()
              : "Today"}
          </small>
        </div>

        <div className="d-flex gap-3 align-items-center bg-white bg-opacity-50 px-3 py-1 rounded-pill border border-secondary border-opacity-10">
          <button
            onClick={handleLike}
            className={`btn btn-link text-decoration-none p-0 d-flex align-items-center gap-1 transition-colors ${
              liked ? "text-danger" : "text-secondary"
            }`}
          >
            <Heart
              size={18}
              fill={liked ? "currentColor" : "none"}
              strokeWidth={liked ? 0 : 1.5}
            />
            <span
              className="small fw-bold font-sans"
              style={{ fontSize: "11px" }}
            >
              {quote.likes?.length || 0}
            </span>
          </button>
          <div
            className="border-start border-secondary opacity-25"
            style={{ height: "14px" }}
          ></div>
          <button
            onClick={() => setShowComments(!showComments)}
            className="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-1 text-secondary"
          >
            <MessageCircle size={18} strokeWidth={1.5} />
            <span
              className="small fw-bold font-sans"
              style={{ fontSize: "11px" }}
            >
              {quote.comments?.length || 0}
            </span>
          </button>
          <div
            className="border-start border-secondary opacity-25"
            style={{ height: "14px" }}
          ></div>
          <button
            onClick={downloadImage}
            className="btn btn-link text-secondary p-0"
            title="Save/Share"
          >
            <Download size={18} strokeWidth={1.5} />
          </button>
          <button
            id={`share-${quote.id}`}
            onClick={handleShare}
            className="btn btn-link text-secondary p-0"
            title="Copy"
          >
            <Share2 size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {showComments && (
        <div className="mt-3 mx-2 p-3 bg-white bg-opacity-75 rounded shadow-inner border border-light">
          <div
            className="mb-3 overflow-auto pe-2 font-sans"
            style={{ maxHeight: "150px" }}
          >
            {quote.comments?.map((c, i) => (
              <div key={i} className="mb-2 d-flex align-items-start gap-2">
                <div
                  className="fw-bold small text-primary flex-shrink-0"
                  style={{ fontSize: "0.75rem" }}
                >
                  {c.username}:
                </div>
                <div
                  className="small text-dark lh-sm"
                  style={{ fontSize: "0.8rem" }}
                >
                  {c.text}
                </div>
              </div>
            ))}
            {(!quote.comments || quote.comments.length === 0) && (
              <p className="small text-muted text-center py-2 fst-italic">
                No margin notes yet.
              </p>
            )}
          </div>
          <form
            onSubmit={handleComment}
            className="d-flex gap-2 align-items-center bg-white border rounded-pill p-1 ps-3"
          >
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a note..."
              className="form-control form-control-sm border-0 bg-transparent shadow-none font-sans"
            />
            <button
              disabled={!commentText.trim()}
              type="submit"
              className="btn btn-sm btn-link text-primary rounded-circle p-1 d-flex align-items-center justify-content-center"
              style={{ width: "28px", height: "28px" }}
            >
              <Send size={14} className="ms-1" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function NotificationsView({ user }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "notifications"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const myNotifs = all.filter((n) => n.recipientId === user.uid);
      setNotifications(myNotifs);

      myNotifs.forEach((n) => {
        if (!n.read) {
          updateDoc(
            doc(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "notifications",
              n.id
            ),
            { read: true }
          );
        }
      });
    });
    return () => unsub();
  }, [user]);

  return (
    <div className="p-3">
      <h6
        className="fw-bold text-dark mb-4 mt-2 px-2 font-sans text-uppercase"
        style={{ fontSize: "12px", letterSpacing: "1px" }}
      >
        Notifications
      </h6>
      <div className="d-flex flex-column gap-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-3 rounded-2 shadow-sm border-start border-4 ${
              n.type === "like" ? "border-danger" : "border-primary"
            } bg-white`}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="small fw-bold text-dark font-sans">
                {n.senderName}
              </span>
              <span
                className="text-muted font-sans"
                style={{ fontSize: "9px" }}
              >
                {n.createdAt
                  ? new Date(n.createdAt.seconds * 1000).toLocaleTimeString(
                      [],
                      { hour: "2-digit", minute: "2-digit" }
                    )
                  : ""}
              </span>
            </div>
            <p className="mb-0 small text-muted lh-sm font-sans">{n.message}</p>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-5 text-muted small font-sans fst-italic">
            No new correspondence.
          </div>
        )}
      </div>
    </div>
  );
}

function CreateQuoteView({ user, onPost }) {
  const [text, setText] = useState("");
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [saving, setSaving] = useState(false);
  const [authorName, setAuthorName] = useState(
    "User " + user.uid.substring(0, 4)
  );

  useEffect(() => {
    const generated = window.localStorage.getItem("generatedQuote");
    if (generated) {
      setText(generated);
      window.localStorage.removeItem("generatedQuote");
    }

    // Fetch profile name to use as author name
    const unsub = onSnapshot(
      doc(db, "artifacts", appId, "users", user.uid, "profile", "info"),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          if (data.penName) setAuthorName(data.penName);
          else if (data.name) setAuthorName(data.name);
        }
      }
    );
    return () => unsub();
  }, [user]);

  const handlePost = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "quotes"),
        {
          text: text.trim(),
          authorId: user.uid,
          authorName: authorName,
          themeId: selectedTheme.id,
          likes: [],
          comments: [],
          createdAt: serverTimestamp(),
        }
      );
      onPost();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div
      className="d-flex flex-column h-100"
      style={{ backgroundColor: "#fdfbf7" }}
    >
      <div className="px-3 py-3 d-flex justify-content-between align-items-center border-bottom border-opacity-10 border-dark">
        <h5 className="mb-0 fw-bold text-dark fs-5">Compose</h5>
        <button
          onClick={handlePost}
          disabled={!text.trim() || saving}
          className="btn btn-primary rounded-pill px-4 btn-sm fw-medium shadow-sm font-sans text-uppercase"
          style={{ fontSize: "11px", letterSpacing: "1px" }}
        >
          {saving ? "Inking..." : "Publish"}
        </button>
      </div>
      <div className="flex-grow-1 p-4 d-flex flex-column align-items-center justify-content-center overflow-hidden position-relative">
        <div
          className="w-100 h-100 d-flex align-items-center justify-content-center p-5 text-center transition-all shadow-sm"
          style={{
            ...selectedTheme.style,
            borderLeft: "4px solid #8B4513",
            borderRadius: "2px 8px 8px 2px",
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your masterpiece..."
            className="w-100 h-100 bg-transparent border-0 text-center fs-3 lh-base"
            style={{
              fontFamily: "Libre Baskerville, serif",
              outline: "none",
              resize: "none",
              color: "inherit",
              overflow: "hidden",
              marginTop: "auto",
              marginBottom: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </div>
      </div>
      <div
        className="border-top border-opacity-10 border-dark p-3 pb-5"
        style={{ minHeight: "160px", backgroundColor: "#f4ecd8" }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <p className="small fw-bold text-muted mb-0 text-uppercase letter-spacing-1 font-sans">
            Paper Type
          </p>
          <span className="badge bg-white text-dark fw-normal border border-secondary border-opacity-25 font-sans">
            {selectedTheme.name}
          </span>
        </div>
        <div className="d-flex gap-3 overflow-auto pb-2 scrollbar-hide ps-1">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setSelectedTheme(theme)}
              className={`rounded-circle flex-shrink-0 transition-transform p-0 position-relative`}
              style={{
                width: "48px",
                height: "48px",
                ...theme.style,
                border:
                  selectedTheme.id === theme.id
                    ? "2px solid transparent"
                    : "1px solid rgba(0,0,0,0.1)",
                boxShadow:
                  selectedTheme.id === theme.id ? "0 0 0 2px #8B4513" : "none",
                transform:
                  selectedTheme.id === theme.id ? "scale(1.1)" : "scale(1)",
              }}
            >
              {selectedTheme.id === theme.id && (
                <div className="position-absolute top-50 start-50 translate-middle bg-white rounded-circle p-1 shadow-sm">
                  <div
                    className="bg-primary rounded-circle"
                    style={{ width: "6px", height: "6px" }}
                  ></div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIExplorerView({ user, onUseQuote }) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateQuote = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    const systemPrompt =
      "You are a poetic quote generator. Output ONLY the quote text itself.";
    const response = await callGemini(
      `Write a quote about: ${prompt}`,
      systemPrompt
    );
    setResult(response);
    setLoading(false);
  };

  return (
    <div
      className="p-4 h-100 d-flex flex-column"
      style={{ backgroundColor: "#fdfbf7" }}
    >
      <div className="mb-4 text-center mt-3">
        <div
          className="mx-auto bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center mb-3"
          style={{ width: "64px", height: "64px" }}
        >
          <Sparkles size={28} strokeWidth={1.5} />
        </div>
        <h2 className="h4 fw-bold text-dark mb-2">The Muse</h2>
        <p className="text-muted small font-sans">
          Whisper a topic, and let the ink flow.
        </p>
      </div>
      <div
        className="card border-0 shadow-sm p-1 mb-4 rounded-0"
        style={{ backgroundColor: "#fff" }}
      >
        <div className="input-group">
          <input
            className="form-control border-0 bg-transparent shadow-none py-3 px-3 font-sans"
            placeholder="e.g. Solitude, The Moon..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateQuote()}
          />
          <button
            onClick={generateQuote}
            disabled={loading || !prompt.trim()}
            className="btn btn-primary rounded-0 m-1 px-4 fw-bold font-sans text-uppercase"
            style={{ fontSize: "11px", letterSpacing: "1px" }}
          >
            {loading ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              "Inspire"
            )}
          </button>
        </div>
      </div>
      {result && (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center animate-fade-in">
          <div
            className="card border-0 p-5 shadow-lg text-center position-relative w-100 rounded-1"
            style={{ backgroundColor: "#fff", borderLeft: "4px solid #8B4513" }}
          >
            <p className="fs-4 fw-normal text-dark mb-4 lh-base mt-3 fst-italic">
              {result}
            </p>
            <button
              onClick={() => {
                window.localStorage.setItem("generatedQuote", result);
                onUseQuote(result);
              }}
              className="btn btn-primary rounded-0 px-4 shadow-sm font-sans text-uppercase"
              style={{ fontSize: "11px", letterSpacing: "1px" }}
            >
              Ink This
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatHubView({ user }) {
  const [activeChat, setActiveChat] = useState("community");
  return (
    <div
      className="d-flex flex-column h-100"
      style={{ backgroundColor: "#fdfbf7" }}
    >
      <div className="p-3 pb-2">
        <div className="bg-white p-1 rounded-pill d-flex border border-secondary border-opacity-25 shadow-sm">
          <button
            onClick={() => setActiveChat("community")}
            className={`btn btn-sm flex-grow-1 rounded-pill fw-bold transition-all py-2 font-sans ${
              activeChat === "community"
                ? "bg-primary text-white shadow-sm"
                : "text-muted"
            }`}
          >
            Salon
          </button>
          <button
            onClick={() => setActiveChat("ai")}
            className={`btn btn-sm flex-grow-1 rounded-pill fw-bold transition-all py-2 font-sans ${
              activeChat === "ai"
                ? "bg-secondary text-white shadow-sm"
                : "text-muted"
            }`}
          >
            Oracle
          </button>
        </div>
      </div>
      <div className="flex-grow-1 overflow-hidden position-relative bg-white border-top border-secondary border-opacity-10">
        {activeChat === "community" ? (
          <CommunityChat user={user} />
        ) : (
          <AIChat user={user} />
        )}
      </div>
    </div>
  );
}

function CommunityChat({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const dummyDiv = useRef(null);

  useEffect(() => {
    const q = query(
      collection(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "community_messages"
      ),
      orderBy("createdAt", "asc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(
        () => dummyDiv.current?.scrollIntoView({ behavior: "smooth" }),
        100
      );
    });
    return () => unsub();
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await addDoc(
      collection(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "community_messages"
      ),
      {
        text,
        uid: user.uid,
        username: "User " + user.uid.substring(0, 4),
        createdAt: serverTimestamp(),
      }
    );
  };

  return (
    <div className="d-flex flex-column h-100">
      <div className="flex-grow-1 overflow-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`d-flex flex-column mb-2 ${
              m.uid === user.uid ? "align-items-end" : "align-items-start"
            }`}
          >
            <div
              className={`p-3 px-4 rounded-3 text-break shadow-sm ${
                m.uid === user.uid
                  ? "bg-primary text-white"
                  : "bg-light border text-dark"
              }`}
              style={{
                maxWidth: "85%",
                fontSize: "0.95rem",
                borderRadius: "16px",
                borderBottomRightRadius: m.uid === user.uid ? "2px" : "16px",
                borderBottomLeftRadius: m.uid === user.uid ? "16px" : "2px",
                fontFamily: "Libre Baskerville",
              }}
            >
              {m.uid !== user.uid && (
                <div
                  className="small fw-bold text-primary mb-1 opacity-75 font-sans"
                  style={{ fontSize: "10px" }}
                >
                  {m.username}
                </div>
              )}
              {m.text}
            </div>
          </div>
        ))}
        <div ref={dummyDiv}></div>
      </div>
      <form
        onSubmit={send}
        className="p-3 bg-white border-top d-flex gap-2 align-items-center"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Join the discussion..."
          className="form-control rounded-pill bg-light border-0 py-2 px-4 shadow-inner font-sans"
        />
        <button
          type="submit"
          className="btn btn-primary rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm"
          style={{ width: "42px", height: "42px" }}
        >
          <Send size={18} className="ms-1" />
        </button>
      </form>
    </div>
  );
}

function AIChat({ user }) {
  const [messages, setMessages] = useState([
    {
      id: "intro",
      role: "ai",
      text: "Hello! I'm here to help you write. What's on your mind?",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), role: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(
      () => scrollRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );
    const replyText = await callGemini(
      userMsg.text,
      "You are a friendly, creative AI assistant."
    );
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + 1, role: "ai", text: replyText },
    ]);
    setTyping(false);
    setTimeout(
      () => scrollRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );
  };

  return (
    <div className="d-flex flex-column h-100">
      <div className="flex-grow-1 overflow-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`d-flex mb-3 ${
              m.role === "user"
                ? "justify-content-end"
                : "justify-content-start"
            }`}
          >
            <div
              className={`p-3 px-4 rounded-3 shadow-sm text-break ${
                m.role === "user"
                  ? "bg-secondary text-white"
                  : "bg-light text-dark border"
              }`}
              style={{
                maxWidth: "85%",
                fontSize: "0.95rem",
                borderRadius: "16px",
                borderBottomRightRadius: m.role === "user" ? "2px" : "16px",
                borderBottomLeftRadius: m.role === "user" ? "16px" : "2px",
                fontFamily: "Libre Baskerville",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef}></div>
      </div>
      <form
        onSubmit={sendMessage}
        className="p-3 bg-white border-top d-flex gap-2 align-items-center"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Consult the Oracle..."
          className="form-control rounded-pill bg-light border-0 py-2 px-4 shadow-inner font-sans"
        />
        <button
          type="submit"
          className="btn btn-secondary text-white rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm"
          style={{ width: "42px", height: "42px" }}
        >
          <Sparkles size={18} />
        </button>
      </form>
    </div>
  );
}

function ProfileView({ user }) {
  const [myQuotes, setMyQuotes] = useState([]);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    penName: "",
    bio: "",
    dob: "",
  });

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "quotes"),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMyQuotes(all.filter((q) => q.authorId === user.uid));
    });
    return () => unsub();
  }, [user]);

  // Fetch Profile
  useEffect(() => {
    if (!user) return;
    const profileRef = doc(
      db,
      "artifacts",
      appId,
      "users",
      user.uid,
      "profile",
      "info"
    );
    const unsub = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setFormData((prev) => ({ ...prev, ...data }));
      }
    });
    return () => unsub();
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const profileRef = doc(
      db,
      "artifacts",
      appId,
      "users",
      user.uid,
      "profile",
      "info"
    );
    await setDoc(
      profileRef,
      { ...formData, updatedAt: serverTimestamp() },
      { merge: true }
    );
    setIsEditing(false);
  };

  return (
    <div className="p-3 min-vh-100" style={{ backgroundColor: "#fdfbf7" }}>
      <div className="text-center p-4 mb-4 mt-3">
        <div
          className="mx-auto rounded-circle p-1 mb-3 shadow-lg border border-primary border-opacity-25 position-relative bg-white"
          style={{ width: "96px", height: "96px" }}
        >
          <div className="w-100 h-100 bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center fs-1 fw-bold text-primary">
            {user.uid.slice(0, 2).toUpperCase()}
          </div>
        </div>

        {!isEditing ? (
          <>
            <h4 className="fw-bold text-dark mb-1">
              {profile?.penName ||
                profile?.name ||
                `Writer ${user.uid.slice(0, 4)}`}
            </h4>
            <p className="small text-muted font-sans mb-3">
              {profile?.bio || "Socio Vibes Member"}
            </p>
            <div className="d-flex justify-content-center mb-4">
              <button
                onClick={() => setIsEditing(true)}
                className="btn btn-outline-primary btn-sm rounded-pill px-3 font-sans d-inline-flex align-items-center gap-1 mb-4"
                style={{ fontSize: "10px" }}
              >
                <Edit3 size={12} /> Edit Profile
              </button>{" "}
              <button
                onClick={() => signOut(auth)}
               className="btn btn-outline-danger btn-sm rounded-pill px-3 font-sans d-inline-flex align-items-center gap-1 mb-4"
                style={{ fontSize: "10px" }}
              >
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={handleSaveProfile}
            className="bg-white p-3 rounded-3 shadow-sm text-start mb-4 border border-light"
          >
            <h6 className="small fw-bold text-muted mb-3 text-uppercase font-sans">
              Edit Details
            </h6>
            <div className="mb-2">
              <label className="form-label small text-muted">Full Name</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-0">
                  <User size={14} />
                </span>
                <input
                  className="form-control border-0 bg-light"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Your Name"
                />
              </div>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted">Pen Name</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-0">
                  <PenTool size={14} />
                </span>
                <input
                  className="form-control border-0 bg-light"
                  value={formData.penName}
                  onChange={(e) =>
                    setFormData({ ...formData, penName: e.target.value })
                  }
                  placeholder="Pseudonym"
                />
              </div>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted">Bio</label>
              <textarea
                className="form-control form-control-sm border-0 bg-light"
                rows="2"
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                placeholder="Short bio..."
              />
            </div>
            <div className="mb-3">
              <label className="form-label small text-muted">
                Date of Birth
              </label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-0">
                  <Calendar size={14} />
                </span>
                <input
                  type="date"
                  className="form-control border-0 bg-light"
                  value={formData.dob}
                  onChange={(e) =>
                    setFormData({ ...formData, dob: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn btn-light btn-sm flex-fill rounded-pill font-sans fw-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm flex-fill rounded-pill font-sans fw-bold d-flex align-items-center justify-content-center gap-1"
              >
                <Save size={14} /> Save
              </button>
            </div>
          </form>
        )}

        <div className="row g-3 mt-2 px-3">
          <div className="col-6">
            <div className="bg-white p-3 rounded-1 border-bottom border-4 border-primary shadow-sm h-100">
              <div className="h3 fw-bold text-dark mb-0">{myQuotes.length}</div>
              <div className="small text-muted text-uppercase letter-spacing-1 font-sans">
                Entries
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="bg-white p-3 rounded-1 border-bottom border-4 border-danger shadow-sm h-100">
              <div className="h3 fw-bold text-dark mb-0">
                {myQuotes.reduce(
                  (acc, curr) => acc + (curr.likes?.length || 0),
                  0
                )}
              </div>
              <div className="small text-muted text-uppercase letter-spacing-1 font-sans">
                Appreciation
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center justify-content-between mb-3 px-2 border-bottom border-secondary border-opacity-10 pb-2">
        <h6
          className="fw-bold text-dark mb-0 font-sans text-uppercase"
          style={{ fontSize: "12px", letterSpacing: "1px" }}
        >
          My Anthology
        </h6>
      </div>

      <div className="row g-3">
        {myQuotes.map((q) => {
          const theme = THEMES.find((t) => t.id === q.themeId) || THEMES[0];
          return (
            <div className="col-6" key={q.id}>
              <div
                className="rounded-1 shadow-sm p-3 d-flex align-items-center justify-content-center text-center overflow-hidden position-relative"
                style={{
                  aspectRatio: "1/1",
                  fontSize: "11px",
                  ...theme.style,
                  borderLeft: "3px solid #8B4513",
                }}
              >
                {q.text.length > 60 ? q.text.substring(0, 60) + "..." : q.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`btn border-0 d-flex flex-column align-items-center justify-content-center nav-link-custom ${
        active ? "active" : ""
      }`}
      style={{ width: "64px", opacity: active ? 1 : 0.5 }}
    >
      <Icon
        size={24}
        strokeWidth={active ? 2.5 : 2}
        className={active ? "text-primary" : "text-secondary"}
      />
      <span
        className={`mt-1 fw-bold font-sans ${
          active ? "text-primary" : "text-secondary"
        }`}
        style={{ fontSize: "9px", letterSpacing: "0.5px" }}
      >
        {label}
      </span>
    </button>
  );
}
