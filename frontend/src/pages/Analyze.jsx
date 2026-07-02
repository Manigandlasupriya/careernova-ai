import { useState, useRef, useEffect } from "react";
import { useAuth, useNav } from "../App";
import { extractTextFromPDF } from "../utils/pdfUtils";
import { ScanSearch, Upload, Briefcase, Rocket, ArrowLeft, AlertCircle, Clock } from "lucide-react";

const scoreColor = s => s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
const scoreLabel = s => s >= 75 ? "Good ✓" : s >= 50 ? "Fair" : "Needs Work";

function useCountdown(active, start = 60) {
  const [sec, setSec] = useState(start);
  useEffect(() => {
    if (!active) { setSec(start); return; }
    setSec(start);
    const id = setInterval(() => setSec(s => { if (s <= 1) { clearInterval(id); return 0; } return s - 1; }), 1000);
    return () => clearInterval(id);
  }, [active]);
  return sec;
}

export default function Analyze() {
  const { token, API } = useAuth();
  const { navigate }   = useNav();
  const [resumeText, setResumeText] = useState("");
  const [jobDesc,    setJobDesc]    = useState("");
  const [fileName,   setFileName]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [report,     setReport]     = useState(null);
  const [error,      setError]      = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const fileRef = useRef();
  const countdown = useCountdown(rateLimited, 60);

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setFileName(file.name); setError("");
    try { setResumeText(file.type === "application/pdf" ? await extractTextFromPDF(file) : await file.text()); }
    catch { setError("Could not read file. Paste text below instead."); }
  };

  const analyze = async () => {
    if (!resumeText.trim() || !jobDesc.trim()) return setError("Both resume and job description are required.");
    setLoading(true); setError(""); setReport(null); setRateLimited(false);
    try {
      const r = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText, jobDescription: jobDesc }),
      });
      const d = await r.json();
      if (r.status === 503 || (d.detail && (d.detail.includes("rate") || d.detail.includes("503") || d.detail.includes("rate-limited")))) {
        setRateLimited(true);
        setError(d.detail || "Rate limited");
      } else if (!r.ok) {
        throw new Error(d.detail || "Analysis failed");
      } else {
        setReport(d.report);
      }
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("503") || msg.includes("rate") || msg.includes("quota")) {
        setRateLimited(true);
      }
      setError(msg || "Analysis failed.");
    } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.pageHdr}>
        <div style={s.pageIcon}><ScanSearch size={22} color="#6366f1" /></div>
        <div>
          <h1 style={s.pageTitle}>Resume Analyzer</h1>
          <p style={s.pageSub}>Get a full ATS breakdown — keyword match, gap analysis, and improvement tips.</p>
        </div>
      </div>

      {!report ? (
        <>
          <div style={s.grid}>
            <div style={s.card}>
              <div style={s.cardHdr}><Upload size={16} color="#6366f1" /><span style={s.cTitle}>Your Resume</span></div>
              <div style={s.dropZone} onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile({ target: { files: e.dataTransfer.files } }); }}>
                <input ref={fileRef} type="file" accept=".pdf,.txt" style={{ display: "none" }} onChange={handleFile} />
                <Upload size={30} color={fileName ? "#10b981" : "#a5b4fc"} style={{ marginBottom: 6 }} />
                <div style={s.dropMain}>{fileName || "Drop PDF here or click to upload"}</div>
                <div style={s.dropSub}>{fileName ? "✓ Loaded" : "PDF or TXT"}</div>
              </div>
              <div style={s.orLine}><span>or paste text</span></div>
              <textarea style={s.ta} placeholder="Paste resume text here…" value={resumeText}
                onChange={e => setResumeText(e.target.value)} rows={9} />
              {resumeText && <div style={s.charBadge}>{resumeText.split(/\s+/).filter(Boolean).length} words</div>}
            </div>

            <div style={s.card}>
              <div style={s.cardHdr}><Briefcase size={16} color="#6366f1" /><span style={s.cTitle}>Job Description</span></div>
              <textarea style={{ ...s.ta, minHeight: 340 }} placeholder="Paste the full job description…"
                value={jobDesc} onChange={e => setJobDesc(e.target.value)} rows={16} />
              {jobDesc && <div style={s.charBadge}>{jobDesc.length} chars</div>}
              <div style={s.tip}>💡 Include the full JD — title, requirements, responsibilities — for best results.</div>
            </div>
          </div>

          {rateLimited && (
            <div style={s.rateBox}>
              <Clock size={18} color="#d97706" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, marginBottom: 3 }}>Gemini API Rate Limit Reached</div>
                <div style={{ fontSize: 12 }}>
                  All AI models are temporarily busy. Retry in
                  <strong style={{ color: "#d97706", margin: "0 4px" }}>{countdown}s</strong>
                  — or upgrade to a paid Gemini key for unlimited requests.
                </div>
              </div>
              {countdown === 0 && (
                <button style={s.retryBtn} onClick={analyze}>Retry Now →</button>
              )}
            </div>
          )}

          {error && !rateLimited && (
            <div style={s.errBox}><AlertCircle size={14} style={{ flexShrink: 0 }} /><span>{error}</span></div>
          )}

          <button style={{ ...s.analyzeBtn, opacity: loading ? 0.7 : 1 }} onClick={analyze} disabled={loading}>
            {loading ? <><Spin />Analyzing with AI…</> : <><ScanSearch size={16} style={{ marginRight: 8 }} />Analyze Resume</>}
          </button>
        </>
      ) : (
        <ReportView report={report} onBack={() => { setReport(null); setRateLimited(false); }} navigate={navigate} />
      )}
    </div>
  );
}

function ReportView({ report, onBack, navigate }) {
  const main  = report.atsScore || 0;
  const color = scoreColor(main);
  return (
    <div>
      <div style={s.heroScore}>
        <div style={s.heroLeft}>
          <div style={{ ...s.bigScore, color }}>{main}</div>
          <div style={{ ...s.bigLabel, background: color + "22", color }}>{scoreLabel(main)}</div>
          <p style={s.heroDesc}>
            {main >= 75 ? "Your resume is well-optimized for ATS." :
             main >= 50 ? "Your resume needs some improvements." :
             "Significant optimization needed to pass ATS filters."}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={s.optimizeBtn} onClick={() => navigate("optimize")}>
              <Rocket size={14} style={{ marginRight: 6 }} />Optimize with AI
            </button>
            <button style={s.backBtn} onClick={onBack}><ArrowLeft size={13} style={{ marginRight: 5 }} />New Analysis</button>
          </div>
        </div>
        <div style={s.miniScores}>
          {[
            { label: "Keyword Match", val: report.keywordScore },
            { label: "Semantic Fit",  val: report.semanticScore },
            { label: "Completeness",  val: report.completenessScore },
            { label: "Formatting",    val: report.formattingScore },
          ].map(sc => (
            <div key={sc.label} style={s.miniCard}>
              <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(sc.val || 0) }}>{sc.val || 0}</div>
              <div style={s.miniBar}><div style={{ ...s.miniBarFill, width: `${sc.val||0}%`, background: scoreColor(sc.val||0) }} /></div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{sc.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.reportGrid}>
        <KWCard title="✅ Matched Keywords" items={report.matchedKeywords} color="#10b981" bg="#dcfce7" />
        <KWCard title="❌ Missing Keywords"  items={report.missingKeywords} color="#ef4444" bg="#fee2e2" />
        <div style={s.card}>
          <div style={s.cardHdr}><span style={{ fontSize: 16 }}>🔎</span><span style={s.cTitle}>Gap Analysis</span></div>
          {[
            { label: "Missing Skills",         items: report.gapAnalysis?.missingSkills,         color: "#ef4444" },
            { label: "Missing Technologies",   items: report.gapAnalysis?.missingTechnologies,   color: "#f59e0b" },
            { label: "Missing Certifications", items: report.gapAnalysis?.missingCertifications, color: "#6366f1" },
          ].map(g => g.items?.length ? (
            <div key={g.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: g.color, marginBottom: 5 }}>{g.label}</div>
              {g.items.map(i => <div key={i} style={s.listLine}>• {i}</div>)}
            </div>
          ) : null)}
        </div>
        <div style={s.card}>
          <div style={s.cardHdr}><span style={{ fontSize: 16 }}>💡</span><span style={s.cTitle}>Recommendations</span></div>
          {[
            { label: "Strengths",      items: report.recommendations?.strengths,      color: "#10b981" },
            { label: "Improvements",   items: report.recommendations?.improvements,   color: "#6366f1" },
            { label: "Interview Tips", items: report.recommendations?.interviewTips,  color: "#f59e0b" },
          ].map(g => g.items?.length ? (
            <div key={g.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: g.color, marginBottom: 5 }}>{g.label}</div>
              {g.items.map(i => <div key={i} style={s.listLine}>• {i}</div>)}
            </div>
          ) : null)}
        </div>
      </div>
    </div>
  );
}

function KWCard({ title, items, color, bg }) {
  return (
    <div style={s.card}>
      <div style={s.cardHdr}><span style={s.cTitle}>{title}</span></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(items || []).map(k => <span key={k} style={{ background: bg, color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{k}</span>)}
        {!items?.length && <span style={{ fontSize: 12, color: "#94a3b8" }}>None found</span>}
      </div>
    </div>
  );
}

function Spin() { return <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 8 }} />; }

const s = {
  page:       { padding: "28px 32px", maxWidth: 1100, margin: "0 auto" },
  pageHdr:    { display: "flex", alignItems: "center", gap: 14, marginBottom: 28 },
  pageIcon:   { width: 46, height: 46, borderRadius: 13, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  pageTitle:  { fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" },
  pageSub:    { color: "#64748b", fontSize: 13, margin: 0 },
  grid:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  card:       { background: "#fff", borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" },
  cardHdr:    { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
  cTitle:     { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  dropZone:   { border: "2px dashed #c7d2fe", borderRadius: 12, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: "#fafbff", marginBottom: 10 },
  dropMain:   { fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 3 },
  dropSub:    { fontSize: 11, color: "#94a3b8" },
  orLine:     { textAlign: "center", fontSize: 11, color: "#94a3b8", margin: "6px 0" },
  ta:         { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box", color: "#1e293b" },
  charBadge:  { textAlign: "right", fontSize: 10, color: "#94a3b8", marginTop: 4 },
  tip:        { marginTop: 10, padding: "9px 12px", background: "#fefce8", borderRadius: 8, fontSize: 11, color: "#713f12", border: "1px solid #fde68a" },
  rateBox:    { display: "flex", alignItems: "flex-start", gap: 12, background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "16px 18px", marginBottom: 16, color: "#92400e", fontSize: 13 },
  retryBtn:   { marginLeft: "auto", padding: "8px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  errBox:     { display: "flex", alignItems: "flex-start", gap: 8, background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", fontSize: 13, marginBottom: 16 },
  analyzeBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: 14, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.3)" },
  heroScore:  { background: "linear-gradient(135deg,#0f172a,#1e1b4b)", borderRadius: 16, padding: "28px 32px", display: "flex", gap: 32, marginBottom: 20, alignItems: "center" },
  heroLeft:   { flex: 1 },
  bigScore:   { fontSize: 72, fontWeight: 900, lineHeight: 1, marginBottom: 8 },
  bigLabel:   { display: "inline-block", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 12 },
  heroDesc:   { fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 20 },
  optimizeBtn:{ display: "flex", alignItems: "center", padding: "10px 20px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  backBtn:    { display: "flex", alignItems: "center", padding: "10px 20px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 9, fontSize: 13, cursor: "pointer" },
  miniScores: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 },
  miniCard:   { background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" },
  miniBar:    { height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, margin: "6px 0" },
  miniBarFill:{ height: 4, borderRadius: 4 },
  reportGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  listLine:   { fontSize: 12, color: "#374151", marginBottom: 3, lineHeight: 1.5 },
};
