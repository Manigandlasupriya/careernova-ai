import { useState, useEffect } from "react";
import { useAuth, useNav } from "../App";

const STATUSES = ["Wishlist", "Applied", "Interviewing", "Offer", "Rejected"];
const STATUS_COLORS = {
  Wishlist:     { bg: "#f1f5f9", text: "#475569" },
  Applied:      { bg: "#dbeafe", text: "#1d4ed8" },
  Interviewing: { bg: "#fef9c3", text: "#854d0e" },
  Offer:        { bg: "#dcfce7", text: "#166534" },
  Rejected:     { bg: "#fee2e2", text: "#991b1b" },
};

const EMPTY = { companyName: "", roleTitle: "", location: "", salary: "", status: "Applied", notes: "", appliedDate: "", linkedinUrl: "" };

export default function Tracker() {
  const { token, API } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/tracker`, { headers });
      const d = await r.json();
      setJobs(d.trackers || []);
    } catch { setError("Failed to load jobs."); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (job) => { setEditing(job.id); setForm({ companyName: job.company_name || "", roleTitle: job.role_title || "", location: job.location || "", salary: job.salary || "", status: job.status || "Applied", notes: job.notes || "", appliedDate: job.applied_date?.split("T")[0] || "", linkedinUrl: job.linkedin_url || "" }); setShowForm(true); };

  const save = async () => {
    if (!form.companyName.trim() || !form.roleTitle.trim()) return setError("Company and role are required.");
    setSaving(true); setError("");
    try {
      const url = editing ? `${API}/api/tracker/${editing}` : `${API}/api/tracker`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers, body: JSON.stringify(form) });
      if (!r.ok) throw new Error("Save failed");
      await fetchJobs();
      setShowForm(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this job?")) return;
    await fetch(`${API}/api/tracker/${id}`, { method: "DELETE", headers });
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const filtered = filter === "All" ? jobs : jobs.filter(j => j.status === filter);

  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: jobs.filter(j => j.status === s).length }), {});

  return (
    <div style={s.page}>
      <div style={s.hdr}>
        <div>
          <h1 style={s.title}>📋 Job Tracker</h1>
          <p style={s.sub}>Track every application in one place.</p>
        </div>
        <button style={s.addBtn} onClick={openAdd}>+ Add Job</button>
      </div>

      {/* Status summary */}
      <div style={s.summaryRow}>
        {["All", ...STATUSES].map(st => (
          <button key={st} style={{ ...s.filterBtn, ...(filter === st ? s.filterActive : {}), ...(st !== "All" ? { background: STATUS_COLORS[st]?.bg, color: STATUS_COLORS[st]?.text } : {}) }}
            onClick={() => setFilter(st)}>
            {st} <span style={s.filterCount}>{st === "All" ? jobs.length : counts[st] || 0}</span>
          </button>
        ))}
      </div>

      {error && <div style={s.errBox}>{error}</div>}

      {loading ? (
        <div style={s.empty}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>No jobs {filter !== "All" ? `with status "${filter}"` : "tracked yet"}</div>
          <button style={s.addBtn2} onClick={openAdd}>Add your first job</button>
        </div>
      ) : (
        <div style={s.table}>
          <div style={s.tableHead}>
            <span>Company</span><span>Role</span><span>Location</span><span>Salary</span><span>Status</span><span>Date</span><span>Actions</span>
          </div>
          {filtered.map(job => (
            <div key={job.id} style={s.tableRow}>
              <span style={s.company}>{job.company_name || "—"}</span>
              <span style={s.role}>{job.role_title || "—"}</span>
              <span style={s.cell}>{job.location || "—"}</span>
              <span style={s.cell}>{job.salary || "—"}</span>
              <span>
                <span style={{ ...s.badge, background: STATUS_COLORS[job.status]?.bg, color: STATUS_COLORS[job.status]?.text }}>
                  {job.status}
                </span>
              </span>
              <span style={s.cell}>{job.applied_date?.split("T")[0] || "—"}</span>
              <span style={s.actions}>
                {job.linkedin_url && <a href={job.linkedin_url} target="_blank" rel="noreferrer" style={s.linkBtn}>🔗</a>}
                <button style={s.editBtn} onClick={() => openEdit(job)}>Edit</button>
                <button style={s.delBtn} onClick={() => remove(job.id)}>✕</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Notes panel for selected */}
      {filtered.some(j => j.notes) && (
        <div style={s.notesSection}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b", marginBottom: 12 }}>📝 Notes</h3>
          {filtered.filter(j => j.notes).map(j => (
            <div key={j.id} style={s.noteCard}>
              <strong style={{ color: "#6366f1" }}>{j.company_name} – {j.role_title}</strong>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>{j.notes}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={s.modal}>
            <div style={s.modalHdr}>
              <h2 style={s.modalTitle}>{editing ? "Edit Job" : "Add Job"}</h2>
              <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            {error && <div style={s.errBox}>{error}</div>}
            <div style={s.formGrid}>
              {[
                { key: "companyName", label: "Company *", placeholder: "Google" },
                { key: "roleTitle", label: "Role *", placeholder: "Software Engineer" },
                { key: "location", label: "Location", placeholder: "Remote / Bangalore" },
                { key: "salary", label: "Salary", placeholder: "₹12 LPA" },
                { key: "appliedDate", label: "Applied Date", type: "date" },
                { key: "linkedinUrl", label: "LinkedIn / Job URL", placeholder: "https://..." },
              ].map(f => (
                <div key={f.key} style={s.field}>
                  <label style={s.lbl}>{f.label}</label>
                  <input style={s.inp} type={f.type || "text"} value={form[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={s.field}>
              <label style={s.lbl}>Status</label>
              <div style={s.statusRow}>
                {STATUSES.map(st => (
                  <button key={st} style={{ ...s.statusBtn, background: form.status === st ? STATUS_COLORS[st].bg : "#f8fafc", color: form.status === st ? STATUS_COLORS[st].text : "#94a3b8", border: `2px solid ${form.status === st ? STATUS_COLORS[st].text + "40" : "#e2e8f0"}`, fontWeight: form.status === st ? 700 : 400 }}
                    onClick={() => setForm(p => ({ ...p, status: st }))}>
                    {st}
                  </button>
                ))}
              </div>
            </div>
            <div style={s.field}>
              <label style={s.lbl}>Notes</label>
              <textarea style={s.ta} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Interview rounds, contact person, next steps..." rows={3} />
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { padding: "28px 32px" },
  hdr: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 800, color: "#1e1b4b", margin: "0 0 4px" },
  sub: { color: "#64748b", fontSize: 14, margin: 0 },
  addBtn: { padding: "10px 20px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  addBtn2: { marginTop: 14, padding: "10px 22px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  summaryRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 },
  filterBtn: { padding: "6px 14px", borderRadius: 20, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 },
  filterActive: { border: "1.5px solid #6366f1", fontWeight: 700 },
  filterCount: { background: "rgba(0,0,0,0.08)", borderRadius: 10, padding: "1px 6px", fontSize: 11 },
  errBox: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 },
  empty: { textAlign: "center", padding: 40, color: "#94a3b8" },
  emptyCard: { background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", boxShadow: "0 2px 12px rgba(99,102,241,0.07)", border: "1px solid #e8eaf6" },
  table: { background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(99,102,241,0.07)", border: "1px solid #e8eaf6", overflow: "hidden" },
  tableHead: { display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr 1fr", padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e8eaf6", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", gap: 10 },
  tableRow: { display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr 1fr", padding: "14px 20px", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: 13, gap: 10, transition: "background 0.1s" },
  company: { fontWeight: 700, color: "#1e1b4b" },
  role: { color: "#374151" },
  cell: { color: "#64748b", fontSize: 12 },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  actions: { display: "flex", gap: 6, alignItems: "center" },
  linkBtn: { textDecoration: "none", fontSize: 15 },
  editBtn: { padding: "4px 10px", background: "#eef2ff", color: "#6366f1", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" },
  delBtn: { padding: "4px 8px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" },
  notesSection: { marginTop: 20, background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 12px rgba(99,102,241,0.07)", border: "1px solid #e8eaf6" },
  noteCard: { padding: "10px 14px", background: "#fafbff", borderRadius: 8, marginBottom: 8, border: "1px solid #e8eaf6" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#fff", borderRadius: 14, padding: "28px 32px", width: "100%", maxWidth: 620, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalHdr: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1e1b4b", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  field: { marginBottom: 14 },
  lbl: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 },
  inp: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  ta: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" },
  statusRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  statusBtn: { padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  cancelBtn: { padding: "10px 20px", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#64748b", fontSize: 13, cursor: "pointer", fontWeight: 500 },
  saveBtn: { padding: "10px 24px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" },
};
