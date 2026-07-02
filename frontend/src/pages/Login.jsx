import { useState } from "react";
import { API } from "../App";

export function Login({ onLogin, onSwitch }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const submit = async () => {
    if (!email || !password) return setError("Fill in all fields.");
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Login failed");
      onLogin(d.token, d.user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2 style={s.h}>Sign in</h2>
      {error && <div style={s.err}>{error}</div>}
      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
      <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" onEnter={submit} />
      <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
        {loading ? "Signing in..." : "Sign in →"}
      </button>
      <p style={s.sw}>Don't have an account? <button style={s.lnk} onClick={onSwitch}>Register</button></p>
    </div>
  );
}

export function Register({ onLogin, onSwitch }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const submit = async () => {
    if (!name || !email || !password) return setError("Fill in all fields.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Registration failed");
      onLogin(d.token, d.user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2 style={s.h}>Create account</h2>
      {error && <div style={s.err}>{error}</div>}
      <Field label="Full Name"  value={name}     onChange={setName}     placeholder="Jane Doe" />
      <Field label="Email"      type="email"  value={email}    onChange={setEmail}    placeholder="you@example.com" />
      <Field label="Password"   type="password" value={password} onChange={setPassword} placeholder="Min 6 characters" onEnter={submit} />
      <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
        {loading ? "Creating account..." : "Create account →"}
      </button>
      <p style={s.sw}>Already have an account? <button style={s.lnk} onClick={onSwitch}>Sign in</button></p>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, onEnter }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.lbl}>{label}</label>
      <input style={s.inp} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} onKeyDown={e => e.key === "Enter" && onEnter?.()} />
    </div>
  );
}

const s = {
  h:   { fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 20px" },
  err: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 },
  lbl: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 },
  inp: { width: "100%", padding: "11px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.15s", background: "#fafafa" },
  btn: { width: "100%", padding: 13, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4, boxShadow: "0 4px 14px rgba(99,102,241,0.3)" },
  sw:  { textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 18, marginBottom: 0 },
  lnk: { background: "none", border: "none", color: "#6366f1", fontWeight: 700, cursor: "pointer", fontSize: 13 },
};

export default Login;
