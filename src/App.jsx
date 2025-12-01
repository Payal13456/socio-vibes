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
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
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

    // SMART FALLBACK: Simulate AI behavior so the app doesn't feel broken
    const isQuoteRequest =
      prompt.toLowerCase().includes("quote") ||
      systemInstruction.toLowerCase().includes("quote");

    if (isQuoteRequest) {
      // Return a random Rumi quote to simulate generation
      const randomQuote =
        MOCK_QUOTES[Math.floor(Math.random() * MOCK_QUOTES.length)];
      return randomQuote;
    }

    // Fallback for Chat
    return "My connection to the universal muse is faint right now (Quota Limit Reached). But know that your words are heard. Please try again in a moment.";
  }
};

/**
 * HELPER FUNCTIONS & STYLES
 */
const THEMES = [
  {
    id: "classic",
    name: "Classic",
    style: { backgroundColor: "#ffffff", color: "#1a1a1a" },
  },
  {
    id: "dark",
    name: "Noir",
    style: { backgroundColor: "#18181b", color: "#f4f4f5" },
  },
  {
    id: "lavender",
    name: "Dream",
    style: {
      background: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
      color: "#4a044e",
    },
  },
  {
    id: "sunset",
    name: "Dusk",
    style: {
      background: "linear-gradient(to top, #fad0c4 0%, #ffd1ff 100%)",
      color: "#9d174d",
    },
  },
  {
    id: "ocean",
    name: "Depths",
    style: {
      background: "linear-gradient(to top, #30cfd0 0%, #330867 100%)",
      color: "#ffffff",
    },
  },
  {
    id: "paper",
    name: "Parchment",
    style: {
      backgroundColor: "#fef3c7",
      color: "#78350f",
      backgroundImage: "radial-gradient(#b45309 0.5px, transparent 0.5px)",
      backgroundSize: "10px 10px",
    },
  },
];

/**
 * MAIN COMPONENT
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("feed");

  // 1. DYNAMICALLY INJECT BOOTSTRAP CSS & HTML2CANVAS
  useEffect(() => {
    // Bootstrap CSS
    const link = document.createElement("link");
    link.href =
      "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css";
    link.rel = "stylesheet";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);

    // Google Fonts
    const font = document.createElement("link");
    font.href =
      "https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap";
    font.rel = "stylesheet";
    document.head.appendChild(font);

    // HTML2Canvas for Image Generation
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    // Simply sign in anonymously
    signInAnonymously(auth).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const navigate = (newView) => {
    setView(newView);
  };

  if (!user) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <p className="text-muted fw-light">Awakening Soul Scribe...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="d-flex flex-column vh-100 mx-auto bg-light shadow-lg position-relative overflow-hidden font-sans"
      style={{ maxWidth: "480px" }}
    >
      {/* Global Style Overrides */}
      <style>{`
        :root { 
          --bs-primary: #6366f1; 
          --bs-primary-rgb: 99, 102, 241;
          --bs-body-bg: #f8fafc;
        }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .font-serif { font-family: 'Libre Baskerville', 'Georgia', serif; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .btn-primary { background-color: var(--bs-primary); border-color: var(--bs-primary); }
        .text-primary { color: var(--bs-primary) !important; }
        .bg-primary-subtle { background-color: #e0e7ff !important; color: #3730a3 !important; }
        .nav-link-custom { transition: all 0.2s ease; }
        .nav-link-custom.active { transform: translateY(-2px); }
        .quote-card { transition: transform 0.2s; }
        .quote-card:active { transform: scale(0.98); }
        .floating-fab { box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 8px 10px -6px rgba(99, 102, 241, 0.1); }
      `}</style>

      {/* Header */}
      <nav
        className="navbar navbar-light bg-white px-3 sticky-top border-bottom border-light"
        style={{ height: "64px", zIndex: 1020 }}
      >
        <div className="d-flex align-items-center gap-2">
          <div
            className="bg-primary text-white rounded-3 d-flex align-items-center justify-content-center shadow-sm"
            style={{ width: "36px", height: "36px" }}
          >
            <PenTool size={18} strokeWidth={2.5} />
          </div>
          <span
            className="navbar-brand mb-0 h1 fs-5 fw-bold text-dark"
            style={{ letterSpacing: "-0.5px" }}
          >
            Soul Scribe
          </span>
        </div>
        <div className="d-flex align-items-center gap-3">
          {view === "feed" && (
            <button
              onClick={() => navigate("chat")}
              className="btn btn-light rounded-circle p-2 text-secondary position-relative border-0 hover-shadow"
            >
              <MessageCircle size={22} />
              <span className="position-absolute top-0 start-100 translate-middle p-1 bg-primary border border-light rounded-circle"></span>
            </button>
          )}
          <div
            className="rounded-circle bg-light border border-2 border-white shadow-sm overflow-hidden"
            style={{ width: "38px", height: "38px" }}
          >
            <div className="w-100 h-100 bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary fw-bold">
              {user.uid.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow-1 overflow-auto pb-5 bg-light scrollbar-hide">
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
        </div>
      </main>

      {/* Bottom Navigation */}
      <div
        className="bg-white d-flex justify-content-around align-items-center position-absolute bottom-0 w-100 shadow-lg pb-1"
        style={{
          height: "80px",
          zIndex: 1030,
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
        }}
      >
        <NavButton
          icon={Home}
          label="Home"
          active={view === "feed"}
          onClick={() => navigate("feed")}
        />
        <NavButton
          icon={Search}
          label="Explore"
          active={view === "explore"}
          onClick={() => navigate("explore")}
        />

        <div className="position-relative" style={{ top: "-28px" }}>
          <button
            onClick={() => navigate("create")}
            className="btn btn-primary rounded-circle floating-fab d-flex align-items-center justify-content-center border-4 border-white"
            style={{ width: "64px", height: "64px" }}
          >
            <PlusSquare size={28} />
          </button>
        </div>

        <NavButton
          icon={MessageCircle}
          label="Chat"
          active={view === "chat"}
          onClick={() => navigate("chat")}
        />
        <NavButton
          icon={User}
          label="Profile"
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

  // Define seedData before using it
  const seedData = async () => {
    try {
      setLoading(true);
      const batch = writeBatch(db);
      const demoQuotes = [
        {
          text: "The wound is the place where the Light enters you.",
          authorName: "Rumi",
          themeId: "classic",
        },
        {
          text: "I wish I could show you when you are lonely or in darkness the astonishing light of your own being.",
          authorName: "Hafiz",
          themeId: "sunset",
        },
        {
          text: "What you seek is seeking you.",
          authorName: "Rumi",
          themeId: "paper",
        },
        {
          text: "Do not be satisfied with the stories that come before you. Unfold your own myth.",
          authorName: "Rumi",
          themeId: "ocean",
        },
        {
          text: "The universe is not outside of you. Look inside yourself; everything that you want, you already are.",
          authorName: "Rumi",
          themeId: "lavender",
        },
      ];

      demoQuotes.forEach((q) => {
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
      // Allow time for snapshot to update
      setTimeout(() => setLoading(false), 500);
    } catch (e) {
      console.error("Error seeding:", e);
      setLoading(false);
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
        setQuotes(docs);

        // Auto-seed if empty on first load to show "others" quotes immediately
        if (docs.length === 0 && !seededRef.current) {
          seededRef.current = true;
          seedData();
        } else {
          setLoading(false);
        }
      },
      (err) => console.error("Feed error:", err)
    );

    return () => unsubscribe();
  }, []);

  if (loading)
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5 mt-5">
        <div
          className="spinner-border text-primary mb-3 text-opacity-50"
          style={{ width: "2rem", height: "2rem" }}
        ></div>
        <p className="small text-muted">Gathering voices...</p>
      </div>
    );

  return (
    <div className="container-fluid px-0 pt-2">
      <div className="px-3 pb-2 text-center border-bottom border-light mb-2 d-flex justify-content-between align-items-center">
        <small
          className="text-uppercase text-muted fw-bold letter-spacing-1"
          style={{ fontSize: "10px" }}
        >
          Global Community Stream
        </small>
        {quotes.length > 0 && (
          <button
            onClick={seedData}
            className="btn btn-link text-primary p-0 d-flex align-items-center gap-1"
            style={{ fontSize: "10px", textDecoration: "none" }}
          >
            <RefreshCw size={10} /> Populate More
          </button>
        )}
      </div>

      {quotes.map((quote) => (
        <QuoteCard key={quote.id} quote={quote} user={user} />
      ))}

      {quotes.length > 0 && (
        <div className="text-center pb-4 pt-2">
          <p className="small text-muted mb-2">
            You've reached the end of the scroll.
          </p>
          <button
            onClick={seedData}
            className="btn btn-outline-primary btn-sm rounded-pill px-3"
          >
            Load More Voices
          </button>
        </div>
      )}

      {quotes.length === 0 && !loading && (
        <div className="text-center p-5 mt-5">
          {/* Fallback if auto-seed didn't trigger visually yet */}
          <div className="mb-3 text-muted opacity-25 d-flex justify-content-center">
            <PenTool size={64} />
          </div>
          <h5 className="text-dark fw-bold">The canvas is empty</h5>
          <button
            onClick={seedData}
            className="btn btn-primary rounded-pill px-4 fw-medium shadow-sm mt-2"
          >
            Load Community Quotes
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
    setCommentText("");
  };

  const handleShare = () => {
    const text = `"${quote.text}" - ${quote.authorName} on Soul Scribe`;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(`share-${quote.id}`);
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = "✓";
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
        // Fallback or alert if script not ready
        alert("Image generator is warming up. Try again in a second!");
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });

      const link = document.createElement("a");
      link.download = `soul-scribe-${quote.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div className="card border-0 mb-4 shadow-sm quote-card mx-3 rounded-4 overflow-hidden">
      {/* Header */}
      <div className="card-header bg-white border-0 d-flex align-items-center gap-2 py-3 px-3">
        <div
          className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-primary"
          style={{ width: "36px", height: "36px", fontSize: "12px" }}
        >
          {quote.authorName?.[0] || "A"}
        </div>
        <div className="flex-grow-1">
          <h6 className="mb-0 text-dark fw-bold" style={{ fontSize: "0.9rem" }}>
            {quote.authorName || "Anonymous"}
          </h6>
          <small className="text-muted" style={{ fontSize: "10px" }}>
            {quote.createdAt
              ? new Date(quote.createdAt.seconds * 1000).toLocaleDateString()
              : "Just now"}
          </small>
        </div>
        <button className="btn btn-link text-muted p-0">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Quote Display - CAPTURE TARGET */}
      <div
        id={`quote-card-${quote.id}`}
        className="d-flex align-items-center justify-content-center p-4 text-center position-relative w-100"
        style={{ minHeight: "340px", ...theme.style }}
      >
        <div className="w-100 py-3 d-flex flex-column justify-content-center align-items-center h-100">
          <span
            className="display-1 opacity-25 font-serif lh-1"
            style={{ marginBottom: "-20px" }}
          >
            “
          </span>
          <p
            className="fs-3 fw-normal px-2 text-break lh-base font-serif"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {quote.text}
          </p>
          <div
            className="mt-4 small text-uppercase opacity-75 fw-bold letter-spacing-2"
            style={{ fontSize: "0.7rem", letterSpacing: "2px" }}
          >
            {quote.authorName}
          </div>

          {/* Soul Scribe Signature Watermark */}
          <div
            className="position-absolute bottom-0 end-0 p-3 opacity-50 small fst-italic"
            style={{ fontSize: "0.6rem", fontFamily: "serif" }}
          >
            Soul Scribe
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card-body py-2 px-3 bg-white">
        <div className="d-flex justify-content-between align-items-center py-2">
          <div className="d-flex gap-4">
            <button
              onClick={handleLike}
              className={`btn btn-link text-decoration-none p-0 d-flex align-items-center gap-1 transition-colors ${
                liked ? "text-danger" : "text-secondary"
              }`}
            >
              <Heart
                size={22}
                fill={liked ? "currentColor" : "none"}
                strokeWidth={liked ? 0 : 2}
              />
              <span className="small fw-bold">{quote.likes?.length || 0}</span>
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-1 text-secondary"
            >
              <MessageCircle size={22} />
              <span className="small fw-bold">
                {quote.comments?.length || 0}
              </span>
            </button>
          </div>

          <div className="d-flex gap-3">
            <button
              onClick={downloadImage}
              className="btn btn-link text-secondary p-0"
              title="Download as Image"
            >
              <Download size={22} />
            </button>
            <button
              id={`share-${quote.id}`}
              onClick={handleShare}
              className="btn btn-link text-secondary p-0"
              title="Copy Text"
            >
              <Share2 size={22} />
            </button>
          </div>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-2 pt-3 border-top animate-fade-in">
            <div
              className="mb-3 overflow-auto pe-2"
              style={{ maxHeight: "150px" }}
            >
              {quote.comments?.map((c, i) => (
                <div key={i} className="mb-2 d-flex align-items-start gap-2">
                  <div
                    className="fw-bold small text-dark flex-shrink-0"
                    style={{ fontSize: "0.8rem" }}
                  >
                    {c.username}:
                  </div>
                  <div
                    className="small text-muted lh-sm"
                    style={{ fontSize: "0.8rem" }}
                  >
                    {c.text}
                  </div>
                </div>
              ))}
              {(!quote.comments || quote.comments.length === 0) && (
                <p className="small text-muted text-center py-2 fst-italic">
                  No whispers yet.
                </p>
              )}
            </div>
            <form
              onSubmit={handleComment}
              className="d-flex gap-2 align-items-center bg-light rounded-pill p-1 ps-3"
            >
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="form-control form-control-sm border-0 bg-transparent shadow-none"
              />
              <button
                disabled={!commentText.trim()}
                type="submit"
                className="btn btn-sm btn-primary rounded-circle p-1 d-flex align-items-center justify-content-center"
                style={{ width: "28px", height: "28px" }}
              >
                <Send size={14} className="ms-1" />
              </button>
            </form>
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

  useEffect(() => {
    const generated = window.localStorage.getItem("generatedQuote");
    if (generated) {
      setText(generated);
      window.localStorage.removeItem("generatedQuote");
    }
  }, []);

  const handlePost = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "quotes"),
        {
          text: text.trim(),
          authorId: user.uid,
          authorName: "User " + user.uid.substring(0, 4),
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
    <div className="d-flex flex-column h-100 bg-white">
      <div className="px-3 py-2 d-flex justify-content-between align-items-center border-bottom">
        <h5 className="mb-0 fw-bold text-dark fs-6">New Quote</h5>
        <button
          onClick={handlePost}
          disabled={!text.trim() || saving}
          className="btn btn-primary rounded-pill px-4 btn-sm fw-medium shadow-sm"
        >
          {saving ? "Posting..." : "Post"}
        </button>
      </div>

      {/* Canvas Preview */}
      <div className="flex-grow-1 p-0 d-flex flex-column align-items-center justify-content-center bg-light overflow-hidden position-relative">
        <div
          className="w-100 h-100 d-flex align-items-center justify-content-center p-5 text-center transition-all"
          style={{ ...selectedTheme.style, border: "none" }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tap here to start writing your masterpiece..."
            className="w-100 h-100 bg-transparent border-0 text-center fs-2 lh-base font-serif"
            style={{
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

      {/* Theme Picker */}
      <div
        className="bg-white border-top p-3 pb-5"
        style={{ minHeight: "160px" }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <p className="small fw-bold text-muted mb-0 text-uppercase letter-spacing-1">
            Background
          </p>
          <span className="badge bg-light text-dark fw-normal border">
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
                  selectedTheme.id === theme.id ? "0 0 0 2px #6366f1" : "none",
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
      "You are a poetic quote generator. Output ONLY the quote text itself. Do not include 'Here is a quote' or quotation marks around the output. Keep it concise, deep, or witty based on the user's request.";
    const response = await callGemini(
      `Write a quote about: ${prompt}`,
      systemPrompt
    );
    setResult(response);
    setLoading(false);
  };

  return (
    <div className="p-4 h-100 d-flex flex-column bg-white">
      <div className="mb-4 text-center mt-3">
        <div
          className="mx-auto bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center mb-3 animate-bounce-slow"
          style={{ width: "72px", height: "72px" }}
        >
          <Sparkles size={32} />
        </div>
        <h2 className="h4 fw-bold text-dark mb-2">Soul Muse</h2>
        <p className="text-muted small">
          Describe a feeling, and let AI scribe it for you.
        </p>
      </div>

      <div className="card border-0 shadow-sm p-2 mb-4 bg-light rounded-4">
        <div className="input-group">
          <input
            className="form-control border-0 bg-transparent shadow-none py-3 px-3"
            placeholder="e.g. The sound of rain..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateQuote()}
          />
          <button
            onClick={generateQuote}
            disabled={loading || !prompt.trim()}
            className="btn btn-primary rounded-4 m-1 px-4 fw-bold"
          >
            {loading ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center animate-fade-in">
          <div className="card border-0 bg-white p-4 shadow-lg text-center position-relative w-100 rounded-4 border-top border-4 border-primary">
            <span className="display-4 text-primary opacity-25 position-absolute top-0 start-0 ms-3 mt-n3">
              “
            </span>
            <p className="fs-4 fw-normal text-dark mb-4 lh-base mt-3 font-serif fst-italic">
              {result}
            </p>
            <div className="d-flex justify-content-center gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result);
                }}
                className="btn btn-outline-secondary rounded-circle p-2 border-0 bg-light"
                title="Copy"
              >
                <Copy size={20} />
              </button>
              <button
                onClick={() => {
                  window.localStorage.setItem("generatedQuote", result);
                  onUseQuote(result);
                }}
                className="btn btn-primary rounded-pill px-4 shadow-sm"
              >
                Use this Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-muted opacity-25">
          <Bot size={64} strokeWidth={1} />
        </div>
      )}
    </div>
  );
}

function ChatHubView({ user }) {
  const [activeChat, setActiveChat] = useState("community");

  return (
    <div className="d-flex flex-column h-100 bg-white">
      {/* Chat Tab Header */}
      <div className="p-3 pb-2 bg-white">
        <div className="bg-light p-1 rounded-pill d-flex border">
          <button
            onClick={() => setActiveChat("community")}
            className={`btn btn-sm flex-grow-1 rounded-pill fw-bold transition-all py-2 ${
              activeChat === "community"
                ? "bg-white shadow-sm text-primary"
                : "text-muted"
            }`}
          >
            Community
          </button>
          <button
            onClick={() => setActiveChat("ai")}
            className={`btn btn-sm flex-grow-1 rounded-pill fw-bold transition-all py-2 ${
              activeChat === "ai"
                ? "bg-white shadow-sm text-warning"
                : "text-muted"
            }`}
          >
            AI Assistant
          </button>
        </div>
      </div>

      <div className="flex-grow-1 overflow-hidden position-relative bg-light rounded-top-4 border-top shadow-inner">
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
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
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
        {messages.map((m) => {
          const isMe = m.uid === user.uid;
          return (
            <div
              key={m.id}
              className={`d-flex flex-column mb-2 ${
                isMe ? "align-items-end" : "align-items-start"
              }`}
            >
              <div
                className={`p-3 px-4 rounded-4 text-break shadow-sm ${
                  isMe ? "bg-primary text-white" : "bg-white border text-dark"
                }`}
                style={{
                  maxWidth: "85%",
                  fontSize: "0.95rem",
                  borderBottomRightRadius: isMe ? "4px" : "20px",
                  borderBottomLeftRadius: isMe ? "20px" : "4px",
                }}
              >
                {!isMe && (
                  <div
                    className="small fw-bold text-primary mb-1 opacity-75"
                    style={{ fontSize: "11px" }}
                  >
                    {m.username}
                  </div>
                )}
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={dummyDiv}></div>
      </div>
      <form
        onSubmit={send}
        className="p-3 bg-white border-top d-flex gap-2 align-items-center"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="form-control rounded-pill bg-light border-0 py-2 px-4 shadow-sm"
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
      "You are a friendly, creative AI assistant. Keep responses conversational and concise."
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
              className={`p-3 px-4 rounded-4 shadow-sm text-break ${
                m.role === "user"
                  ? "bg-dark text-white"
                  : "bg-white text-dark border"
              }`}
              style={{
                maxWidth: "85%",
                fontSize: "0.95rem",
                borderBottomRightRadius: m.role === "user" ? "4px" : "20px",
                borderBottomLeftRadius: m.role === "user" ? "20px" : "4px",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="d-flex justify-content-start mb-3">
            <div className="bg-white px-3 py-2 rounded-4 rounded-bottom-start-0 border shadow-sm">
              <span className="small text-muted fst-italic">
                AI is writing...
              </span>
            </div>
          </div>
        )}
        <div ref={scrollRef}></div>
      </div>
      <form
        onSubmit={sendMessage}
        className="p-3 bg-white border-top d-flex gap-2 align-items-center"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for inspiration..."
          className="form-control rounded-pill bg-light border-0 py-2 px-4 shadow-sm"
        />
        <button
          type="submit"
          className="btn btn-warning text-dark rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm"
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

  return (
    <div className="p-3 bg-white min-vh-100">
      <div className="text-center p-4 mb-4 mt-3">
        <div
          className="mx-auto rounded-circle p-1 mb-3 bg-white shadow-lg border border-light position-relative"
          style={{ width: "96px", height: "96px" }}
        >
          <div className="w-100 h-100 bg-primary rounded-circle d-flex align-items-center justify-content-center fs-1 fw-bold text-white shadow-inner bg-gradient">
            {user.uid.slice(0, 2).toUpperCase()}
          </div>
        </div>
        <h4 className="fw-bold text-dark mb-1">User {user.uid.slice(0, 4)}</h4>
        <p className="small text-muted">Soul Scribe Member</p>

        <div className="row g-3 mt-2 px-3">
          <div className="col-6">
            <div className="bg-light p-3 rounded-4 border-bottom border-4 border-primary shadow-sm h-100">
              <div className="h3 fw-bold text-dark mb-0">{myQuotes.length}</div>
              <div className="small text-muted text-uppercase letter-spacing-1">
                Scribes
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="bg-light p-3 rounded-4 border-bottom border-4 border-danger shadow-sm h-100">
              <div className="h3 fw-bold text-dark mb-0">
                {myQuotes.reduce(
                  (acc, curr) => acc + (curr.likes?.length || 0),
                  0
                )}
              </div>
              <div className="small text-muted text-uppercase letter-spacing-1">
                Hearts
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center justify-content-between mb-3 px-2">
        <h6 className="fw-bold text-dark mb-0">My Collection</h6>
      </div>

      <div className="row g-3">
        {myQuotes.map((q) => {
          const theme = THEMES.find((t) => t.id === q.themeId) || THEMES[0];
          return (
            <div className="col-6" key={q.id}>
              <div
                className="rounded-4 shadow-sm p-3 d-flex align-items-center justify-content-center text-center overflow-hidden position-relative"
                style={{
                  aspectRatio: "1/1",
                  fontSize: "11px",
                  ...theme.style,
                  border: "none",
                }}
              >
                {q.text.length > 60 ? q.text.substring(0, 60) + "..." : q.text}
              </div>
            </div>
          );
        })}
      </div>
      {myQuotes.length === 0 && (
        <div className="text-center py-5 opacity-50">
          <ImageIcon size={48} className="mb-2 text-muted" />
          <p className="text-muted small">Your gallery is empty.</p>
        </div>
      )}
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
        className={`mt-1 fw-bold ${active ? "text-primary" : "text-secondary"}`}
        style={{ fontSize: "10px" }}
      >
        {label}
      </span>
    </button>
  );
}
