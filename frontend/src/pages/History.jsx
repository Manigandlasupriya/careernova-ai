import { useState, useEffect } from "react";
import { useAuth, useNav } from "../App";

export default function History() {
  const { token, API } = useAuth();
  const { navigate } = useNav();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetch(`${API}/api/history`, { headers }).then(r => r.json()).then(d => setHistory(d.history || [])).catch(() => setError("Failed to load history.")).finally(() => setLoading(false)); }, []);

  const openDetail = async (id) => {
    setSelected(id); setLoadingDetail(true); setDetail(null);
    try {
      const r = await fetch(`${API}/api/history/${id}`, { headers });
      const d = await r.json();
      setDetail(d.history);
    } catch { setError("Failed to load detail."); }
    finally { setLoadingDetail(false); }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this analysis?")) return;
    await fetch(`${API}/api/history/${id}`, { method: "DELETE", headers });
    setHistory(prev => prev.filter(h => h.id !== id));
    if (selected === id) { setSelected(null); setDetail(null); }
  };

  const scoreColor = (s) => s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";

  const formatDate = (str) => {
    if (!str) return "";
    return new Date(str).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return <div style={s.centered}>Loading history...</div>;

  return (
    <div style={s.page}>
      <div style={s.hdr}>
        <h1 style={s.title}>🕑 Analysis History</h1>
        <p style={s.sub}>Your past resume analyses — click any to see the full report.</p>
      </div>

      {error && <div style={s.errBox}>{error}</div>}

      {history.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>No analyses yet</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Run your first resume analysis to see it here.</div>
        </div>
      ) : (
        <div style={s.layout}>
          {/* List */}
          <div style={s.list}>
            {history.map(h => (
              <div key={h.id} style={{ ...s.listItem, ...(selected === h.id ? s.listItemActive : {}) }}
                onClick={() => openDetail(h.id)}>
                <div style={s.listTop}>
                  <div style={{ ...s.scoreBig, color: scoreColor(h.ats_score) }}>{h.ats_score}</div>
                  <div style={s.listMeta}>
                    <div style={s.listDate}>{formatDate(h.created_at)}</div>
                    <div style={s.scoreRow}>
                      <ScorePill label="KW" val={h.keyword_score} />
                      <ScorePill label="SEM" val={h.semantic_score} />
                    </div>
                  </div>
                  <button style={s.delBtn} onClick={e => remove(h.id, e)}>✕</button>
                </div>
                <div style={s.jdPreview}>{(h.job_description || "").slice(0, 100)}...</div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          <div style={s.detail}>
            {!selected && <div style={s.noSelect}>← Select an analysis to view details</div>}
            {loadingDetail && <div style={s.noSelect}>Loading...</div>}
            {detail && !loadingDetail && (
              <div>
                <h3 style={s.detailTitle}>Full Report</h3>
                <div style={s.scoreCards}>
                  {[
                    { label: "ATS Score", val: detail.ats_score },
                    { label: "Keywords", val: detail.keyword_score },
                    { label: "Semantic", val: detail.semantic_score },
                  ].map(sc => (
                    <div key={sc.label} style={s.scoreCard}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor(sc.val) }}>{sc.val}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{sc.label}</div>
                    </div>
                  ))}
                </div>

                {detail.report?.matchedKeywords?.length > 0 && (
                  <Section title="✅ Matched Keywords">
                    <div style={s.tagWrap}>{detail.report.matchedKeywords.map(k => <span key={k} style={s.tagGreen}>{k}</span>)}</div>
                  </Section>
                )}
                {detail.report?.missingKeywords?.length > 0 && (
                  <Section title="❌ Missing Keywords">
                    <div style={s.tagWrap}>{detail.report.missingKeywords.map(k => <span key={k} style={s.tagRed}>{k}</span>)}</div>
                  </Section>
                )}
                {detail.report?.recommendations?.improvements?.length > 0 && (
                  <Section title="💡 Improvements">
                    {detail.report.recommendations.improvements.map((imp, i) => <div key={i} style={s.listLine}>• {imp}</div>)}
                  </Section>
                )}
                {detail.report?.recommendations?.interviewTips?.length > 0 && (
                  <Section title="🎤 Interview Tips">
                    {detail.report.recommendations.interviewTips.map((tip, i) => <div key={i} style={s.listLine}>• {tip}</div>)}
                  </Section>
                )}

                {detail.optimized && Object.keys(detail.optimized).length > 0 && (
                  <Section title="⚡ Optimized Resume Available">
                    <div style={{ fontSize: 12, color: "#10b981", background: "#dcfce7", padding: "8px 12px", borderRadius: 8, fontWeight: 600 }}>
                      ✓ This analysis has an optimized resume saved
                    </div>
                  </Section>
                )}

                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 16 }}>Analyzed on {formatDate(detail.created_at)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function ScorePill({ label, val }) {
  const color = val >= 75 ? "#10b981" : val >= 50 ? "#f59e0b" : "#ef4444";
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "20", padding: "2px 6px", borderRadius: 10 }}>{label} {val}</span>;
}

const s = {
  page: { padding: "28px 32px" },
  hdr: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: "#1e1b4b", margin: "0 0 4px" },
  sub: { color: "#64748b", fontSize: 14, margin: 0 },
  errBox: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 },
  emptyCard: { background: "#fff", borderRadius: 12, padding: 48, textAlign: "center", boxShadow: "0 2px 12px rgba(99,102,241,0.07)", border: "1px solid #e8eaf6" },
  centered: { padding: 40, textAlign: "center", color: "#64748b" },
  layout: { display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  listItem: { background: "#fff", borderRadius: 10, padding: "14px 16px", border: "1.5px solid #e8eaf6", cursor: "pointer", transition: "all 0.15s" },
  listItemActive: { border: "1.5px solid #6366f1", boxShadow: "0 0 0 3px rgba(99,102,241,0.1)" },
  listTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  scoreBig: { fontSize: 28, fontWeight: 800, lineHeight: 1, minWidth: 40 },
  listMeta: { flex: 1 },
  listDate: { fontSize: 11, color: "#94a3b8", marginBottom: 4 },
  scoreRow: { display: "flex", gap: 5 },
  delBtn: { background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, width: 24, height: 24, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 },
  jdPreview: { fontSize: 11, color: "#94a3b8", lineHeight: 1.4 },
  detail: { background: "#fff", borderRadius: 12, padding: "22px 26px", border: "1px solid #e8eaf6", boxShadow: "0 2px 12px rgba(99,102,241,0.07)", minHeight: 300 },
  noSelect: { color: "#94a3b8", fontSize: 14, textAlign: "center", padding: 40 },
  detailTitle: { fontSize: 16, fontWeight: 700, color: "#1e1b4b", margin: "0 0 16px" },
  scoreCards: { display: "flex", gap: 12, marginBottom: 20 },
  scoreCard: { background: "#f8fafc", borderRadius: 10, padding: "12px 20px", textAlign: "center", border: "1px solid #e8eaf6" },
  tagWrap: { display: "flex", flexWrap: "wrap", gap: 5 },
  tagGreen: { background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600 },
  tagRed: { background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600 },
  listLine: { fontSize: 12, color: "#374151", marginBottom: 3, lineHeight: 1.5 },
};
