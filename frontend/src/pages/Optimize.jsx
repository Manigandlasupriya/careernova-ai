import { useState, useRef } from "react";
import { useAuth, useNav } from "../App";
import { extractTextFromPDF, downloadResumePDF, buildFilename } from "../utils/pdfUtils";
import {
  Sparkles, Upload, FileText, Briefcase, Download, ArrowLeft,
  Mail, FileJson, RotateCcw, CheckCircle, AlertCircle, Eye, Code2
} from "lucide-react";

function sanitize(raw) {
  // Fix common AI JSON issues: trailing commas, unquoted keys, etc.
  if (typeof raw !== "string") return raw;
  let s = raw.trim();
  // strip markdown fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Remove trailing commas before ] or }
  s = s.replace(/,\s*([\]}])/g, "$1");
  return s;
}

function validateResume(r) {
  // Returns array of error strings, or empty array if ok
  const errs = [];
  if (!r || typeof r !== "object") { errs.push("Response is not a valid object."); return errs; }
  if (!r.basicDetails?.name) errs.push("Missing candidate name in basicDetails.");
  if (!r.summary) errs.push("Missing professional summary.");
  if (!Array.isArray(r.skills) || r.skills.length === 0) errs.push("Skills array is empty or missing.");
  if (!Array.isArray(r.experience) || r.experience.length === 0) errs.push("Experience array is empty or missing.");
  r.experience?.forEach((exp, i) => {
    if (!exp.jobTitle) errs.push(`Experience[${i}]: missing jobTitle`);
    if (!Array.isArray(exp.bullets) || exp.bullets.length === 0) errs.push(`Experience[${i}]: no bullets`);
  });
  if (!Array.isArray(r.additionalSections)) errs.push("additionalSections missing.");
  return errs;
}

export default function Optimize() {
  const { token, API } = useAuth();
  const { navigate }   = useNav();
  const [resumeText,   setResumeText]   = useState("");
  const [jobDesc,      setJobDesc]      = useState("");
  const [jobTitle,     setJobTitle]     = useState("");
  const [targetScore,  setTargetScore]  = useState(90);
  const [fileName,     setFileName]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [downloading,  setDownloading]  = useState(false);
  const [result,       setResult]       = useState(null);
  const [activeTab,    setActiveTab]    = useState("preview");
  const [error,        setError]        = useState("");
  const [warnings,     setWarnings]     = useState([]);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name); setError("");
    try {
      setResumeText(file.type === "application/pdf" ? await extractTextFromPDF(file) : await file.text());
    } catch { setError("Could not read file. Try pasting the text below instead."); }
  };

  const optimize = async () => {
    if (!resumeText.trim()) return setError("Please upload or paste your resume text.");
    if (!jobDesc.trim())    return setError("Please paste the job description.");
    setLoading(true); setError(""); setResult(null); setWarnings([]);
    try {
      const r = await fetch(`${API}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText, jobDescription: jobDesc, targetAtsScore: targetScore }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Optimization failed");
      if (!d.optimizedResume) throw new Error("Server returned empty result. Please try again.");

      const opt = d.optimizedResume;
      const errs = validateResume(opt);
      if (errs.length > 3) {
        throw new Error("AI returned malformed resume. Errors: " + errs.slice(0, 2).join("; "));
      }
      if (errs.length > 0) setWarnings(errs);

      // Safety: ensure arrays exist
      opt.skills              = Array.isArray(opt.skills)              ? opt.skills.filter(Boolean)           : [];
      opt.experience          = Array.isArray(opt.experience)          ? opt.experience                       : [];
      opt.projects            = Array.isArray(opt.projects)            ? opt.projects                         : [];
      opt.additionalSections  = Array.isArray(opt.additionalSections)  ? opt.additionalSections               : [];
      opt.experience.forEach(exp => { exp.bullets = Array.isArray(exp.bullets) ? exp.bullets.filter(Boolean) : []; });
      opt.projects.forEach(proj  => { proj.bullets = Array.isArray(proj.bullets) ? proj.bullets.filter(Boolean) : []; proj.technologies = Array.isArray(proj.technologies) ? proj.technologies : []; });

      setResult(opt);
      setActiveTab("preview");
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("rate")) {
        setError("⏳ Gemini API rate limit reached. Please wait 30–60 seconds and try again.");
      } else {
        setError(msg || "Optimization failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    try { await downloadResumePDF(result, jobTitle); }
    catch (e) { setError("PDF download failed: " + e.message); }
    finally { setDownloading(false); }
  };

  const handleExportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = buildFilename(result, jobTitle).replace(".pdf", ".json");
    a.click();
  };

  const reset = () => { setResult(null); setResumeText(""); setJobDesc(""); setFileName(""); setError(""); setWarnings([]); };

  const r = result;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.pageHdr}>
        <div style={s.pageHdrIcon}><Sparkles size={22} color="#6366f1" /></div>
        <div>
          <h1 style={s.pageTitle}>Resume Optimizer</h1>
          <p style={s.pageSub}>AI rewrites your resume with STAR bullets, injected keywords, and 90+ ATS score.</p>
        </div>
      </div>

      {!result ? (
        <>
          <div style={s.grid}>
            {/* Left: Resume upload */}
            <div style={s.card}>
              <div style={s.cardHdr}>
                <FileText size={18} color="#6366f1" />
                <span style={s.cTitle}>Your Resume</span>
              </div>
              <div style={s.dropZone}
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile({ target: { files: e.dataTransfer.files } }); }}>
                <input ref={fileRef} type="file" accept=".pdf,.txt" style={{ display: "none" }} onChange={handleFile} />
                <div style={s.dropInner}>
                  <Upload size={28} color={fileName ? "#10b981" : "#a5b4fc"} style={{ marginBottom: 6 }} />
                  <div style={s.dropMain}>{fileName || "Drop PDF or TXT here"}</div>
                  <div style={s.dropSub}>{fileName ? "Loaded ✓" : "or click to browse"}</div>
                </div>
              </div>
              <div style={s.orRow}><span style={s.orText}>or paste below</span></div>
              <textarea style={s.ta} placeholder="Paste resume text..." value={resumeText}
                onChange={e => setResumeText(e.target.value)} rows={10} />
              {resumeText && <div style={s.charBadge}>{resumeText.split(/\s+/).filter(Boolean).length} words</div>}
            </div>

            {/* Right: Job details */}
            <div style={s.card}>
              <div style={s.cardHdr}>
                <Briefcase size={18} color="#6366f1" />
                <span style={s.cTitle}>Job Details</span>
              </div>

              <div style={s.field}>
                <label style={s.lbl}>Job Title <span style={s.hint}>(used in PDF filename)</span></label>
                <input style={s.inp} value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior Application Support Engineer" />
              </div>

              <div style={s.field}>
                <label style={s.lbl}>Job Description <span style={s.req}>*</span></label>
                <textarea style={{ ...s.ta, minHeight: 220 }} placeholder="Paste the full job description here…" value={jobDesc}
                  onChange={e => setJobDesc(e.target.value)} rows={10} />
                {jobDesc && <div style={s.charBadge}>{jobDesc.length} chars</div>}
              </div>

              <div style={s.field}>
                <div style={s.sliderRow}>
                  <label style={s.lbl}>Target ATS Score</label>
                  <span style={s.sliderVal}>{targetScore}+</span>
                </div>
                <input type="range" min={70} max={98} value={targetScore}
                  onChange={e => setTargetScore(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#6366f1", cursor: "pointer" }} />
                <div style={s.sliderTicks}>
                  <span>70 — Good</span><span>85 — Great</span><span>98 — Perfect</span>
                </div>
              </div>
            </div>
          </div>

          {error   && <ErrBox msg={error} />}

          <button style={{ ...s.mainBtn, opacity: loading ? 0.72 : 1 }} onClick={optimize} disabled={loading}>
            {loading
              ? <><Spin />Rewriting with AI — please wait…</>
              : <><Sparkles size={17} style={{ marginRight: 8 }} />Optimize Resume for {targetScore}+ ATS Score</>}
          </button>

          {loading && (
            <div style={s.loadingNote}>
              This usually takes 15–30 seconds. Gemini is rewriting every bullet using the STAR method.
            </div>
          )}
        </>
      ) : (
        /* ── RESULT VIEW ── */
        <div>
          {warnings.length > 0 && (
            <div style={s.warnBox}>
              <AlertCircle size={15} style={{ marginRight: 6, flexShrink: 0 }} />
              <span>Minor AI issues auto-fixed: {warnings.slice(0, 2).join(" · ")}</span>
            </div>
          )}

          {/* Action bar */}
          <div style={s.actionBar}>
            <div style={s.tabRow}>
              {[["preview", Eye, "Preview"], ["raw", Code2, "JSON"]].map(([id, Icon, label]) => (
                <button key={id} style={{ ...s.tab, ...(activeTab === id ? s.tabActive : {}) }}
                  onClick={() => setActiveTab(id)}>
                  <Icon size={13} style={{ marginRight: 5 }} />{label}
                </button>
              ))}
            </div>
            <div style={s.btnRow}>
              <button style={s.ghostBtn} onClick={reset}>
                <RotateCcw size={13} style={{ marginRight: 5 }} />Optimize Another
              </button>
              <button style={s.emailBtn} onClick={() => navigate("email")}>
                <Mail size={13} style={{ marginRight: 5 }} />Use in Email
              </button>
              <button style={s.jsonBtn} onClick={handleExportJSON}>
                <FileJson size={13} style={{ marginRight: 5 }} />Export JSON
              </button>
              <button style={{ ...s.dlBtn, opacity: downloading ? 0.7 : 1 }}
                onClick={handleDownload} disabled={downloading}>
                {downloading
                  ? <><Spin />Generating…</>
                  : <><Download size={14} style={{ marginRight: 6 }} />Download PDF</>}
              </button>
            </div>
          </div>

          {jobTitle && (
            <div style={s.filenameBanner}>
              <CheckCircle size={13} style={{ marginRight: 6 }} />
              Will save as: <strong>{buildFilename(r, jobTitle)}</strong>
            </div>
          )}

          {activeTab === "preview" ? (
            <ResumePreview r={r} />
          ) : (
            <div style={s.jsonView}>
              <pre style={s.jsonPre}>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Resume Preview ─────────────────────────────────────────────────────── */
function ResumePreview({ r }) {
  const bd = r.basicDetails || {};
  return (
    <div style={p.resume}>
      {/* Header */}
      <div style={p.header}>
        <div style={p.nameArea}>
          <div style={p.name}>{bd.name || "—"}</div>
          <div style={p.contactLine}>
            {[bd.email, bd.phone, bd.location].filter(Boolean).join("  ·  ")}
          </div>
          {(bd.linkedin || bd.github) && (
            <div style={p.links}>{[bd.linkedin, bd.github].filter(Boolean).join("   |   ")}</div>
          )}
        </div>
      </div>

      {/* Summary */}
      {r.summary && (
        <Section title="Professional Summary">
          <p style={p.summary}>{r.summary}</p>
        </Section>
      )}

      {/* Skills */}
      {r.skills?.length > 0 && (
        <Section title="Core Competencies">
          <div style={p.skillsGrid}>
            {r.skills.map((sk, i) => <span key={i} style={p.skill}>{sk}</span>)}
          </div>
        </Section>
      )}

      {/* Experience */}
      {r.experience?.length > 0 && (
        <Section title="Professional Experience">
          {r.experience.map((exp, i) => (
            <div key={i} style={p.expBlock}>
              <div style={p.expHeader}>
                <div>
                  <div style={p.jobTitle}>{exp.jobTitle}</div>
                  <div style={p.company}>{exp.company}</div>
                </div>
                <div style={p.duration}>{exp.duration}</div>
              </div>
              <ul style={p.bullets}>
                {(exp.bullets || []).map((b, j) => (
                  <li key={j} style={p.bullet}>
                    <span style={p.bulletDot}>▸</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {/* Projects */}
      {r.projects?.length > 0 && (
        <Section title="Key Projects">
          {r.projects.map((proj, i) => (
            <div key={i} style={p.expBlock}>
              <div style={p.expHeader}>
                <div>
                  <div style={p.jobTitle}>{proj.name}</div>
                  {proj.technologies?.length > 0 && (
                    <div style={p.techRow}>
                      {proj.technologies.map((t, ti) => <span key={ti} style={p.techChip}>{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
              {proj.description && <p style={p.projDesc}>{proj.description}</p>}
              <ul style={p.bullets}>
                {(proj.bullets || []).map((b, j) => (
                  <li key={j} style={p.bullet}>
                    <span style={p.bulletDot}>▸</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {/* Additional sections */}
      {(r.additionalSections || []).map((sec, i) => (
        <Section key={i} title={sec.heading}>
          <p style={p.addContent}>{sec.content}</p>
        </Section>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={p.section}>
      <div style={p.secHdr}>
        <div style={p.secAccent} />
        <h3 style={p.secTitle}>{title}</h3>
        <div style={p.secLine} />
      </div>
      {children}
    </div>
  );
}

const p = {
  resume:    { background: "#fff", borderRadius: 16, maxWidth: 860, margin: "0 auto", overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.08)", border: "1px solid #e8eaff" },
  header:    { background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)", padding: "36px 44px 30px" },
  nameArea:  {},
  name:      { fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", marginBottom: 8 },
  contactLine:{ fontSize: 12, color: "rgba(200,210,255,0.85)", marginBottom: 4 },
  links:     { fontSize: 11, color: "#a5b4fc" },
  section:   { padding: "22px 44px 4px" },
  secHdr:    { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  secAccent: { width: 4, height: 18, background: "linear-gradient(180deg,#6366f1,#8b5cf6)", borderRadius: 2, flexShrink: 0 },
  secTitle:  { fontSize: 11.5, fontWeight: 800, color: "#1e1b4b", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 },
  secLine:   { flex: 1, height: 1, background: "#e8eaff" },
  summary:   { fontSize: 13.5, color: "#374151", lineHeight: 1.75, margin: 0, fontStyle: "italic", padding: "12px 16px", background: "#fafbff", borderRadius: 8, borderLeft: "3px solid #6366f1" },
  skillsGrid:{ display: "flex", flexWrap: "wrap", gap: 7, paddingBottom: 10 },
  skill:     { background: "#eef2ff", color: "#4338ca", padding: "4px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  expBlock:  { marginBottom: 20, paddingBottom: 18, borderBottom: "1px dashed #f1f3ff" },
  expHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  jobTitle:  { fontSize: 14.5, fontWeight: 800, color: "#0f172a", marginBottom: 3 },
  company:   { fontSize: 12, fontWeight: 600, color: "#6366f1" },
  duration:  { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", marginLeft: 12 },
  techRow:   { display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 },
  techChip:  { background: "#f0f9ff", color: "#0369a1", padding: "2px 9px", borderRadius: 10, fontSize: 10.5, fontWeight: 600 },
  projDesc:  { fontSize: 12.5, color: "#64748b", margin: "4px 0 8px", fontStyle: "italic" },
  bullets:   { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 },
  bullet:    { display: "flex", gap: 8, fontSize: 13, color: "#334155", lineHeight: 1.65, alignItems: "flex-start" },
  bulletDot: { color: "#6366f1", fontWeight: 900, flexShrink: 0, marginTop: 1 },
  addContent:{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: "0 0 10px" },
};

/* ─── Small helpers ──────────────────────────────────────────────────────── */
function ErrBox({ msg }) {
  return (
    <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "13px 16px", color: "#dc2626", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 }}>
      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{msg}</span>
    </div>
  );
}
function Spin() { return <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 8, verticalAlign: "middle" }} />; }

const s = {
  page:         { padding: "28px 32px", maxWidth: 1100, margin: "0 auto" },
  pageHdr:      { display: "flex", alignItems: "center", gap: 14, marginBottom: 28 },
  pageHdrIcon:  { width: 46, height: 46, borderRadius: 13, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  pageTitle:    { fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" },
  pageSub:      { color: "#64748b", fontSize: 13, margin: 0 },
  grid:         { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  card:         { background: "#fff", borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" },
  cardHdr:      { display: "flex", alignItems: "center", gap: 9, marginBottom: 16 },
  cTitle:       { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  dropZone:     { border: "2px dashed #c7d2fe", borderRadius: 12, padding: "22px 16px", textAlign: "center", cursor: "pointer", background: "#fafbff", marginBottom: 10, transition: "border 0.2s" },
  dropInner:    { pointerEvents: "none" },
  dropMain:     { fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 3 },
  dropSub:      { fontSize: 11, color: "#94a3b8" },
  orRow:        { textAlign: "center", margin: "6px 0", position: "relative" },
  orText:       { fontSize: 11, color: "#94a3b8", background: "#fff", padding: "0 8px" },
  ta:           { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box", color: "#1e293b" },
  charBadge:    { textAlign: "right", fontSize: 10, color: "#94a3b8", marginTop: 4 },
  field:        { marginBottom: 16 },
  lbl:          { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 },
  hint:         { fontWeight: 400, color: "#94a3b8", fontSize: 11 },
  req:          { color: "#ef4444" },
  inp:          { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b" },
  sliderRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sliderVal:    { fontSize: 16, fontWeight: 800, color: "#6366f1" },
  sliderTicks:  { display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 4 },
  mainBtn:      { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "15px 24px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", gap: 4, boxShadow: "0 4px 18px rgba(99,102,241,0.35)" },
  loadingNote:  { textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 12 },
  warnBox:      { display: "flex", alignItems: "center", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, padding: "10px 14px", color: "#92400e", fontSize: 12, marginBottom: 14 },
  actionBar:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 },
  tabRow:       { display: "flex", gap: 6 },
  btnRow:       { display: "flex", gap: 8, flexWrap: "wrap" },
  tab:          { display: "flex", alignItems: "center", padding: "8px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 12, color: "#64748b", cursor: "pointer", fontWeight: 500 },
  tabActive:    { background: "#6366f1", color: "#fff", borderColor: "#6366f1", fontWeight: 700 },
  ghostBtn:     { display: "flex", alignItems: "center", padding: "8px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 12, color: "#64748b", cursor: "pointer", fontWeight: 500 },
  emailBtn:     { display: "flex", alignItems: "center", padding: "8px 14px", background: "#f0f9ff", color: "#0ea5e9", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  jsonBtn:      { display: "flex", alignItems: "center", padding: "8px 14px", background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  dlBtn:        { display: "flex", alignItems: "center", padding: "9px 18px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  filenameBanner:{ display: "flex", alignItems: "center", padding: "9px 14px", background: "#f0fdf4", borderRadius: 9, fontSize: 12, color: "#166534", border: "1px solid #bbf7d0", marginBottom: 14 },
  jsonView:     { background: "#0f172a", borderRadius: 14, padding: 24, marginTop: 4 },
  jsonPre:      { color: "#c7d2fe", fontSize: 12, fontFamily: "monospace", margin: 0, whiteSpace: "pre-wrap", overflowWrap: "break-word" },
};

// Rate limit countdown hook (also used in Analyze)
// Already handled via error state above
