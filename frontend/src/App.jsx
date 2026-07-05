import { useState, useEffect, createContext, useContext } from "react";
import {
  LayoutDashboard, ScanSearch, Sparkles, Mic2, BriefcaseBusiness,
  Mail, History, LogOut, ChevronLeft, ChevronRight, Rocket
} from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Analyze from "./pages/Analyze";
import Optimize from "./pages/Optimize";
import Interview from "./pages/Interview";
import Tracker from "./pages/Tracker";
import EmailOutreach from "./pages/EmailOutreach";
import HistoryPage from "./pages/History";
import Login from "./pages/Login";
import Register from "./pages/Register";

export const AuthContext = createContext(null);
export const NavContext  = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const useNav  = () => useContext(NavContext);

export const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const NAV = [
  { id: "dashboard",  label: "Dashboard",    Icon: LayoutDashboard,    desc: "Overview" },
  { id: "analyze",    label: "Analyze",       Icon: ScanSearch,         desc: "ATS Score" },
  { id: "optimize",   label: "Optimize",      Icon: Sparkles,           desc: "AI Rewrite" },
  { id: "interview",  label: "Interview",     Icon: Mic2,               desc: "Practice" },
  { id: "tracker",    label: "Job Tracker",   Icon: BriefcaseBusiness,  desc: "Applications" },
  { id: "email",      label: "Email",         Icon: Mail,               desc: "Outreach" },
  { id: "history",    label: "History",       Icon: History,            desc: "Past Analyses" },
];

const FEATURES = [
  { icon: ScanSearch,         label: "ATS Score Analysis" },
  { icon: Sparkles,           label: "AI Resume Optimizer" },
  { icon: Mic2,               label: "Interview Coach" },
  { icon: BriefcaseBusiness,  label: "Job Application Tracker" },
  { icon: Mail,               label: "Smart Email Outreach" },
];

export default function App() {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("cn_token") || "");
  const [page,  setPage]  = useState("dashboard");
  const [authMode, setAuthMode] = useState("login");
  const [sideCollapsed, setSideCollapsed] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => { setToken(""); localStorage.removeItem("cn_token"); });
  }, [token]);

  const login = (tok, usr) => {
    setToken(tok); setUser(usr);
    localStorage.setItem("cn_token", tok);
    setPage("dashboard");
  };

  const logout = () => {
    fetch(`${API}/api/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setToken(""); setUser(null); localStorage.removeItem("cn_token");
  };

  const navigate = (p) => setPage(p);

  if (!user) {
    return (
      <div style={a.wrap}>
        {/* LEFT PANEL */}
        <div style={a.left}>
          <div style={a.brand}>
            <img src="/careernova-logo.jpg" alt="CareerNova AI" style={a.logoImg} />
            <span style={a.brandText}>CareerNova AI</span>
          </div>
          <h1 style={a.hero}>
            Launch your <span style={a.grad}>dream career</span> with AI
          </h1>
          <p style={a.heroSub}>
            AI-powered resume analysis, optimization, interview coaching and job tracking — all in one place.
          </p>
          <div style={a.features}>
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} style={a.feat}>
                <div style={a.featIconWrap}><Icon size={15} color="#818cf8" strokeWidth={2.5} /></div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={a.right}>
          <div style={a.authCard}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <img src="/careernova-logo.jpg" alt="CareerNova AI" style={a.authLogo} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "8px 0 4px" }}>CareerNova AI</h2>
              <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
                {authMode === "login" ? "Welcome back! Sign in to continue." : "Create your free account"}
              </p>
            </div>
            {authMode === "login"
              ? <Login onLogin={login} onSwitch={() => setAuthMode("register")} />
              : <Register onLogin={login} onSwitch={() => setAuthMode("login")} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, API }}>
      <NavContext.Provider value={{ page, navigate }}>
        <div style={s.shell}>
          {/* Sidebar */}
          <aside style={{ ...s.sidebar, width: sideCollapsed ? 68 : 224 }}>
            <div style={s.sideTop}>
              {/* Brand */}
              <div style={s.brand}>
                <img src="/careernova-logo.jpg" alt="CareerNova AI" style={s.brandLogo} />
                {!sideCollapsed && <span style={s.brandText}>CareerNova AI</span>}
                <button style={s.collapseBtn} onClick={() => setSideCollapsed(c => !c)} title="Toggle sidebar">
                  {sideCollapsed
                    ? <ChevronRight size={16} color="rgba(255,255,255,0.5)" />
                    : <ChevronLeft  size={16} color="rgba(255,255,255,0.5)" />}
                </button>
              </div>

              {/* Nav */}
              <nav style={s.nav}>
                {NAV.map(({ id, label, Icon, desc }) => (
                  <button
                    key={id}
                    style={{
                      ...s.navBtn,
                      ...(page === id ? s.navActive : {}),
                      justifyContent: sideCollapsed ? "center" : "flex-start",
                      paddingLeft: sideCollapsed ? 0 : 12,
                    }}
                    onClick={() => navigate(id)}
                    title={sideCollapsed ? label : ""}
                  >
                    <span style={{ ...s.navIcon, color: page === id ? "#a5b4fc" : "rgba(255,255,255,0.5)" }}>
                      <Icon size={18} strokeWidth={page === id ? 2.5 : 2} />
                    </span>
                    {!sideCollapsed && (
                      <span style={s.navLabel}>
                        <span style={{ ...s.navName, color: page === id ? "#fff" : "rgba(255,255,255,0.65)" }}>{label}</span>
                        <span style={s.navDesc}>{desc}</span>
                      </span>
                    )}
                    {!sideCollapsed && page === id && <span style={s.activeDot} />}
                  </button>
                ))}
              </nav>
            </div>

            {/* Bottom */}
            <div style={s.sideBottom}>
              {!sideCollapsed && (
                <div style={s.userCard}>
                  <div style={s.avatar}>{user.name[0].toUpperCase()}</div>
                  <div style={s.userInfo}>
                    <div style={s.userName}>{user.name}</div>
                    <div style={s.userEmail}>{user.email}</div>
                  </div>
                </div>
              )}
              <button
                style={{ ...s.logoutBtn, justifyContent: sideCollapsed ? "center" : "flex-start" }}
                onClick={logout}
                title={sideCollapsed ? "Sign out" : ""}
              >
                <LogOut size={15} strokeWidth={2} />
                {!sideCollapsed && <span>Sign out</span>}
              </button>
            </div>
          </aside>

          {/* Main */}
          <main style={s.main}>
            {page === "dashboard"  && <Dashboard />}
            {page === "analyze"    && <Analyze />}
            {page === "optimize"   && <Optimize />}
            {page === "interview"  && <Interview />}
            {page === "tracker"    && <Tracker />}
            {page === "email"      && <EmailOutreach />}
            {page === "history"    && <HistoryPage />}
          </main>
        </div>
      </NavContext.Provider>
    </AuthContext.Provider>
  );
}

/* ─── Auth page styles ─── */
const a = {
  wrap:        { display: "flex", minHeight: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif" },
  left:        { flex: 1, background: "linear-gradient(135deg,#0a0f2e 0%,#0f172a 45%,#1e1b4b 100%)", padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "center" },
  brand:       { display: "flex", alignItems: "center", gap: 12, marginBottom: 44 },
  logoImg:     { width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
  brandText:   { fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" },
  hero:        { fontSize: 44, fontWeight: 900, color: "#fff", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-1px" },
  grad:        { background: "linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroSub:     { fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: "0 0 40px", maxWidth: 420 },
  features:    { display: "flex", flexDirection: "column", gap: 14 },
  feat:        { display: "flex", alignItems: "center", gap: 12, color: "rgba(255,255,255,0.75)", fontSize: 14 },
  featIconWrap:{ width: 28, height: 28, borderRadius: 8, background: "rgba(129,140,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  right:       { width: 480, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 },
  authCard:    { background: "#fff", borderRadius: 20, padding: "40px 44px", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.08)" },
  authLogo:    { width: 64, height: 64, borderRadius: 16, objectFit: "cover" },
};

/* ─── App shell styles ─── */
const s = {
  shell:       { display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Inter','Segoe UI',sans-serif", background: "#f1f5f9" },
  sidebar:     { background: "linear-gradient(180deg,#0a0f2e 0%,#0f172a 55%,#1e1b4b 100%)", display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.25s ease", overflow: "hidden" },
  sideTop:     { flex: 1, display: "flex", flexDirection: "column" },
  brand:       { display: "flex", alignItems: "center", gap: 10, padding: "18px 14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  brandLogo:   { width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 },
  brandText:   { fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", flex: 1, letterSpacing: "-0.2px" },
  collapseBtn: { background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", marginLeft: "auto", flexShrink: 0 },
  nav:         { flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 },
  navBtn:      { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", background: "none", cursor: "pointer", transition: "all 0.15s", position: "relative" },
  navActive:   { background: "rgba(129,140,248,0.18)" },
  navIcon:     { flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 22 },
  navLabel:    { display: "flex", flexDirection: "column", gap: 1, flex: 1 },
  navName:     { fontSize: 13, fontWeight: 600, lineHeight: 1 },
  navDesc:     { fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1 },
  activeDot:   { width: 6, height: 6, borderRadius: "50%", background: "#818cf8", flexShrink: 0 },
  sideBottom:  { padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.07)" },
  userCard:    { display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", marginBottom: 6 },
  avatar:      { width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 },
  userInfo:    { flex: 1, overflow: "hidden" },
  userName:    { fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userEmail:   { fontSize: 10, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  logoutBtn:   { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", fontWeight: 500, transition: "all 0.15s" },
  main:        { flex: 1, overflow: "auto", background: "#f1f5f9" },
};
