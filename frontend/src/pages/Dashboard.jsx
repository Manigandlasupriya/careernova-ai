import { useState, useEffect } from "react";
import { useAuth, useNav } from "../App";
import { ScanSearch, Sparkles, Mic2, Mail, BriefcaseBusiness, History, BarChart3, FileText, Send, Target, ChevronRight, Plus } from "lucide-react";

export default function Dashboard() {
  const { token, user, API } = useAuth();
  const { navigate } = useNav();
  const [stats, setStats]     = useState({ analyses: 0, avgScore: 0, jobs: 0, emails: 0 });
  const [history, setHistory] = useState([]);
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/api/history`, { headers: h }).then(r => r.json()).catch(() => ({ history: [] })),
      fetch(`${API}/api/tracker`, { headers: h }).then(r => r.json()).catch(() => ({ trackers: [] })),
    ]).then(([hData, tData]) => {
      const hist = hData.history || [];
      const trk  = tData.trackers || [];
      const avg  = hist.length ? Math.round(hist.reduce((a, b) => a + (b.ats_score || 0), 0) / hist.length) : 0;
      setHistory(hist.slice(0, 4));
      setJobs(trk.slice(0, 4));
      setStats({ analyses: hist.length, avgScore: avg, jobs: trk.length, emails: 0 });
    }).finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const scoreColor = s => s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
  const fmtDate   = s => s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

  const STATUS_COLORS = {
    Wishlist: "#94a3b8", Applied: "#3b82f6", Interviewing: "#f59e0b", Offer: "#10b981", Rejected: "#ef4444",
  };

  const QUICK_ACTIONS = [
    { Icon: ScanSearch,        label: "Analyze Resume",   sub: "Check ATS score",       page: "analyze",   color: "#6366f1", bg: "#eef2ff" },
    { Icon: Sparkles,          label: "Optimize Resume",  sub: "AI-powered rewrite",    page: "optimize",  color: "#8b5cf6", bg: "#f5f3ff" },
    { Icon: Mic2,              label: "Mock Interview",   sub: "Practice with AI",      page: "interview", color: "#ec4899", bg: "#fdf2f8" },
    { Icon: Mail,              label: "Email Outreach",   sub: "Send cold emails",      page: "email",     color: "#0ea5e9", bg: "#f0f9ff" },
    { Icon: BriefcaseBusiness, label: "Track Jobs",       sub: "Manage applications",   page: "tracker",   color: "#10b981", bg: "#f0fdf4" },
    { Icon: History,           label: "View History",     sub: "Past analyses",         page: "history",   color: "#f59e0b", bg: "#fffbeb" },
  ];

  const STAT_CARDS = [
    { label: "Total Analyses", val: stats.analyses, Icon: ScanSearch,  color: "#6366f1", bg: "#eef2ff" },
    { label: "Avg ATS Score",  val: stats.avgScore ? `${stats.avgScore}` : "—", Icon: BarChart3, color: "#10b981", bg: "#f0fdf4" },
    { label: "Jobs Tracked",   val: stats.jobs,     Icon: BriefcaseBusiness, color: "#f59e0b", bg: "#fffbeb" },
    { label: "Emails Sent",    val: stats.emails,   Icon: Send,        color: "#0ea5e9", bg: "#f0f9ff" },
  ];

  return (
    <div style={s.page}>
      {/* Top greeting bar */}
      <div style={s.topBar}>
        <div>
          <div style={s.greeting}>{greeting}, {user?.name?.split(" ")[0]} 👋</div>
          <div style={s.greetingSub}>Here's your career launch overview</div>
        </div>
        <button style={s.analyzeBtn} onClick={() => navigate("analyze")}>
          <Plus size={15} strokeWidth={2.5} style={{ marginRight: 6 }} />
          New Analysis
        </button>
      </div>

      {/* Stats row */}
      <div style={s.statsRow}>
        {STAT_CARDS.map(({ label, val, Icon, color, bg }) => (
          <div key={label} style={s.statCard}>
            <div style={{ ...s.statIcon, background: bg, color }}>
              <Icon size={20} strokeWidth={2} />
            </div>
            <div>
              <div style={{ ...s.statVal, color }}>{loading ? "..." : val}</div>
              <div style={s.statLabel}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={s.grid}>
        {/* Quick Actions */}
        <div style={s.section}>
          <div style={s.sectionHdr}>
            <span style={s.sectionTitle}>Quick Actions</span>
          </div>
          <div style={s.actionsGrid}>
            {QUICK_ACTIONS.map(({ Icon, label, sub, page, color, bg }) => (
              <button key={page} style={s.actionCard} onClick={() => navigate(page)}>
                <div style={{ ...s.actionIcon, background: bg, color }}>
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div style={s.actionLabel}>{label}</div>
                <div style={s.actionSub}>{sub}</div>
                <ChevronRight size={13} color={color} style={{ marginTop: 4 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Recent Analyses */}
          <div style={s.section}>
            <div style={s.sectionHdr}>
              <span style={s.sectionTitle}>Recent Analyses</span>
              <button style={s.seeAll} onClick={() => navigate("history")}>See all →</button>
            </div>
            {loading ? <Skeleton /> : history.length === 0 ? (
              <Empty Icon={ScanSearch} text="No analyses yet" btn="Analyze your resume" onClick={() => navigate("analyze")} />
            ) : history.map(h => (
              <div key={h.id} style={s.histRow}>
                <div style={{ ...s.scoreCircle, borderColor: scoreColor(h.ats_score), color: scoreColor(h.ats_score) }}>
                  {h.ats_score}
                </div>
                <div style={s.histMeta}>
                  <div style={s.histJD}>{(h.job_description || "").slice(0, 55)}...</div>
                  <div style={s.histDate}>{fmtDate(h.created_at)}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <ScorePill label="KW" val={h.keyword_score} />
                  <ScorePill label="SEM" val={h.semantic_score} />
                </div>
              </div>
            ))}
          </div>

          {/* Job Pipeline */}
          <div style={s.section}>
            <div style={s.sectionHdr}>
              <span style={s.sectionTitle}>Job Pipeline</span>
              <button style={s.seeAll} onClick={() => navigate("tracker")}>See all →</button>
            </div>
            {loading ? <Skeleton /> : jobs.length === 0 ? (
              <Empty Icon={BriefcaseBusiness} text="No jobs tracked yet" btn="Add a job" onClick={() => navigate("tracker")} />
            ) : jobs.map(j => (
              <div key={j.id} style={s.jobRow}>
                <div style={s.jobLogo}>{(j.company_name || "?")[0]}</div>
                <div style={s.jobMeta}>
                  <div style={s.jobTitle}>{j.role_title || "—"}</div>
                  <div style={s.jobCompany}>{j.company_name || "—"}</div>
                </div>
                <span style={{ ...s.statusBadge, background: STATUS_COLORS[j.status] + "20", color: STATUS_COLORS[j.status] }}>
                  {j.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress banner */}
      {stats.analyses > 0 && (
        <div style={s.banner}>
          <div style={s.bannerLeft}>
            <div style={s.bannerTitle}>
              <Target size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Keep going!
            </div>
            <div style={s.bannerSub}>
              Your average ATS score is <strong style={{ color: scoreColor(stats.avgScore) }}>{stats.avgScore}</strong>.
              {stats.avgScore < 75 ? " Optimize your resume to push it above 75." : " Great score! Keep applying."}
            </div>
          </div>
          <button style={s.bannerBtn} onClick={() => navigate(stats.avgScore < 75 ? "optimize" : "tracker")}>
            {stats.avgScore < 75 ? "Optimize Now →" : "Track Applications →"}
          </button>
        </div>
      )}
    </div>
  );
}

function ScorePill({ label, val }) {
  const c = val >= 75 ? "#10b981" : val >= 50 ? "#f59e0b" : "#ef4444";
  return <span style={{ fontSize: 10, fontWeight: 700, color: c, background: c + "18", padding: "2px 7px", borderRadius: 10 }}>{label} {val}</span>;
}

function Skeleton() {
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {[1,2,3].map(i => <div key={i} style={{ height: 44, background: "#f1f5f9", borderRadius: 10 }} />)}
  </div>;
}

function Empty({ Icon, text, btn, onClick }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <Icon size={32} color="#cbd5e1" strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>{text}</div>
      <button style={{ padding: "7px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }} onClick={onClick}>{btn}</button>
    </div>
  );
}

const s = {
  page:        { padding: "28px 32px", maxWidth: 1200, margin: "0 auto" },
  topBar:      { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  greeting:    { fontSize: 24, fontWeight: 800, color: "#0f172a", marginBottom: 4 },
  greetingSub: { fontSize: 13, color: "#94a3b8" },
  analyzeBtn:  { padding: "11px 20px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" },
  statsRow:    { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 },
  statCard:    { background: "#fff", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" },
  statIcon:    { width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statVal:     { fontSize: 26, fontWeight: 800, lineHeight: 1 },
  statLabel:   { fontSize: 11, color: "#94a3b8", marginTop: 3 },
  grid:        { display: "grid", gridTemplateColumns: "1fr 400px", gap: 20, marginBottom: 20 },
  section:     { background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" },
  sectionHdr:  { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle:{ fontSize: 14, fontWeight: 700, color: "#0f172a" },
  seeAll:      { background: "none", border: "none", fontSize: 12, color: "#6366f1", fontWeight: 600, cursor: "pointer" },
  actionsGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 },
  actionCard:  { display: "flex", flexDirection: "column", gap: 6, padding: "16px 14px", borderRadius: 12, border: "1.5px solid #f1f5f9", background: "#fafbff", cursor: "pointer", textAlign: "left", transition: "all 0.15s" },
  actionIcon:  { width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  actionLabel: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  actionSub:   { fontSize: 11, color: "#94a3b8" },
  histRow:     { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f8fafc" },
  scoreCircle: { width: 42, height: 42, borderRadius: "50%", border: "2.5px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 },
  histMeta:    { flex: 1, overflow: "hidden" },
  histJD:      { fontSize: 12, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  histDate:    { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  jobRow:      { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f8fafc" },
  jobLogo:     { width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 },
  jobMeta:     { flex: 1 },
  jobTitle:    { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  jobCompany:  { fontSize: 11, color: "#94a3b8" },
  statusBadge: { padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" },
  banner:      { background: "linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius: 14, padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  bannerLeft:  {},
  bannerTitle: { fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4, display: "flex", alignItems: "center" },
  bannerSub:   { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  bannerBtn:   { padding: "10px 22px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
};
