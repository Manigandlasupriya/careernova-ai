import { useState, useRef, useEffect } from "react";
import { useAuth } from "../App";

const TYPES = [
  { id:"technical",  label:"Technical",      icon:"💻", desc:"DSA, system design, coding" },
  { id:"behavioral", label:"Behavioral",     icon:"🧠", desc:"STAR method, soft skills" },
  { id:"full",       label:"Full Interview", icon:"🎯", desc:"Mixed technical + behavioral" },
];

export default function Interview() {
  const { token, API }  = useAuth();
  const [jobTitle,  setJobTitle]  = useState("");
  const [type,      setType]      = useState("full");
  const [started,   setStarted]   = useState(false);
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,   // ← Fixed: was missing token
  };

  const start = async () => {
    if (!jobTitle.trim()) return setError("Please enter a job title.");
    setError(""); setStarted(true); setLoading(true);
    try {
      const r = await fetch(`${API}/api/interview`, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: [], jobTitle, type, userMessage: "" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Failed to start interview");
      setMessages([{ role: "assistant", content: d.message }]);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("503") || msg.includes("rate") || msg.includes("busy")) {
        setError("⏳ AI is busy. Please wait 30 seconds and try again.");
      } else if (msg.includes("401")) {
        setError("Session expired. Please refresh the page and log in again.");
      } else {
        setError(msg || "Failed to start interview. Please try again.");
      }
      setStarted(false);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg  = { role: "user", content: input };
    const newMsgs  = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/interview`, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: newMsgs, jobTitle, type, userMessage: input }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "No response from AI");
      setMessages(p => [...p, { role: "assistant", content: d.message }]);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("503") || msg.includes("rate") || msg.includes("busy")) {
        setError("⏳ AI is busy. Wait 30 seconds and send again.");
      } else {
        setError(msg || "Failed to get response. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStarted(false); setMessages([]); setInput(""); setJobTitle(""); setError("");
  };

  if (!started) return (
    <div style={s.page}>
      <div style={s.hdr}>
        <div style={s.hdrIcon}>🎤</div>
        <div>
          <h1 style={s.title}>Interview Coach</h1>
          <p style={s.sub}>Practice with an AI interviewer and get real-time scored feedback.</p>
        </div>
      </div>

      <div style={s.setupCard}>
        <div style={s.field}>
          <label style={s.lbl}>Job Title <span style={{ color: "#ef4444" }}>*</span></label>
          <input style={s.inp} value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
            placeholder="e.g. Software Engineer, Data Scientist, Product Manager"
            onKeyDown={e => e.key === "Enter" && start()} />
        </div>

        <div style={s.field}>
          <label style={s.lbl}>Interview Type</label>
          <div style={s.typeGrid}>
            {TYPES.map(t => (
              <button key={t.id}
                style={{ ...s.typeCard, ...(type === t.id ? s.typeActive : {}) }}
                onClick={() => setType(t.id)}>
                <span style={{ fontSize: 26 }}>{t.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{t.label}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div style={s.err}>{error}</div>}

        <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
          onClick={start} disabled={loading}>
          {loading ? <><Spin />Starting interview…</> : "Start Interview →"}
        </button>

        <div style={s.tip}>
          💡 Answer as you would in a real interview. You'll get a score and feedback after each answer.
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.chatPage}>
      {/* Header */}
      <div style={s.chatHdr}>
        <div>
          <div style={s.chatTitle}>
            🎤 {jobTitle} — {TYPES.find(t => t.id === type)?.label}
          </div>
          <div style={s.chatSub}>{messages.length} exchanges</div>
        </div>
        <button style={s.endBtn} onClick={reset}>End Interview</button>
      </div>

      {/* Messages */}
      <div style={s.chatArea}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...s.msgWrap, ...(m.role === "user" ? s.userWrap : {}) }}>
            {m.role === "assistant" && <div style={s.aiAv}>🤖</div>}
            <div style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.aiBubble) }}>
              {m.role === "assistant"
                ? m.content.split("\n").map((line, j) => (
                    <span key={j} style={{ display: "block", marginBottom: line ? 2 : 6 }}>{line}</span>
                  ))
                : m.content}
            </div>
            {m.role === "user" && (
              <div style={s.userAv}>{m.content[0]?.toUpperCase() || "U"}</div>
            )}
          </div>
        ))}

        {loading && (
          <div style={s.msgWrap}>
            <div style={s.aiAv}>🤖</div>
            <div style={{ ...s.bubble, ...s.aiBubble }}>
              <span style={s.typingDot} />
              <span style={{ ...s.typingDot, animationDelay: "0.2s" }} />
              <span style={{ ...s.typingDot, animationDelay: "0.4s" }} />
            </div>
          </div>
        )}

        {error && (
          <div style={s.errInChat}>{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={s.inputArea}>
        <textarea style={s.chatInput} value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          rows={3} />
        <button
          style={{ ...s.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }}
          onClick={send} disabled={loading || !input.trim()}>
          Send →
        </button>
      </div>
    </div>
  );
}

function Spin() {
  return <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 8 }} />;
}

const s = {
  page:       { padding: "28px 32px", maxWidth: 800, margin: "0 auto" },
  hdr:        { display: "flex", alignItems: "center", gap: 14, marginBottom: 28 },
  hdrIcon:    { fontSize: 36, flexShrink: 0 },
  title:      { fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" },
  sub:        { color: "#64748b", fontSize: 14, margin: 0 },
  setupCard:  { background: "#fff", borderRadius: 14, padding: "28px 32px", boxShadow: "0 1px 8px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9" },
  field:      { marginBottom: 22 },
  lbl:        { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 },
  inp:        { width: "100%", padding: "11px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", color: "#0f172a" },
  typeGrid:   { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 },
  typeCard:   { display: "flex", flexDirection: "column", gap: 5, padding: "16px", borderRadius: 12, border: "2px solid #f1f5f9", background: "#fafbff", cursor: "pointer", textAlign: "left" },
  typeActive: { border: "2px solid #6366f1", background: "#eef2ff" },
  btn:        { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: 13, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8, gap: 8 },
  err:        { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, margin: "12px 0" },
  tip:        { marginTop: 14, padding: "10px 14px", background: "#fefce8", borderRadius: 8, fontSize: 11, color: "#713f12", border: "1px solid #fde68a" },
  chatPage:   { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },
  chatHdr:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: "#fff", borderBottom: "1px solid #f1f5f9", flexShrink: 0 },
  chatTitle:  { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  chatSub:    { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  endBtn:     { padding: "8px 16px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  chatArea:   { flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 },
  msgWrap:    { display: "flex", gap: 10, alignItems: "flex-start", maxWidth: "82%" },
  userWrap:   { alignSelf: "flex-end", flexDirection: "row-reverse" },
  aiAv:       { fontSize: 22, flexShrink: 0, marginTop: 2 },
  userAv:     { width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  bubble:     { padding: "12px 16px", borderRadius: 12, fontSize: 13, lineHeight: 1.7 },
  aiBubble:   { background: "#fff", border: "1px solid #f1f5f9", color: "#1e293b", borderTopLeftRadius: 2 },
  userBubble: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", borderTopRightRadius: 2 },
  typingDot:  { display: "inline-block", width: 7, height: 7, background: "#c7d2fe", borderRadius: "50%", margin: "0 2px", animation: "spin 1s ease-in-out infinite" },
  errInChat:  { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 12, alignSelf: "center", maxWidth: 400, textAlign: "center" },
  inputArea:  { padding: "14px 24px", background: "#fff", borderTop: "1px solid #f1f5f9", display: "flex", gap: 12, flexShrink: 0 },
  chatInput:  { flex: 1, padding: "10px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.6, color: "#0f172a" },
  sendBtn:    { padding: "10px 22px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" },
};
