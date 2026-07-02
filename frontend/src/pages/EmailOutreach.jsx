import { useState, useRef } from "react";
import emailjs from "@emailjs/browser";
import { useAuth } from "../App";
import { getResumePDFBlob, buildFilename } from "../utils/pdfUtils";

const EMAIL_TYPES = [
  { id:"referral", label:"Referral Request", icon:"🤝", desc:"Ask your network for a referral" },
  { id:"cold",     label:"Cold Outreach",    icon:"📨", desc:"Reach out to recruiters directly" },
  { id:"cover",    label:"Cover Letter",     icon:"📄", desc:"Formal application cover letter" },
];
const SVC  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TMPL = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export default function EmailOutreach() {
  const { token, API }           = useAuth();
  const [step,setStep]           = useState(1);
  const [jobDesc,setJobDesc]     = useState("");
  const [jobTitle,setJobTitle]   = useState("");
  const [yourName,setYourName]   = useState("");
  const [background,setBg]       = useState("");
  const [resumeJson,setResumeJson] = useState(null);
  const [resumeFile,setResumeFile] = useState(null);
  const [resumeLink,setResumeLink] = useState(""); // manual link only
  const [templates,setTemplates] = useState({});
  const [selected,setSelected]   = useState(null);
  const [subject,setSubject]     = useState("");
  const [body,setBody]           = useState("");
  const [toEmail,setToEmail]     = useState("");
  const [loading,setLoading]     = useState(false);
  const [sending,setSending]     = useState(false);
  const [sent,setSent]           = useState(false);
  const [error,setError]         = useState("");
  const [copied,setCopied]       = useState(false);
  const jsonRef = useRef();

  const handleResumeJson = (e) => {
    const file = e.target.files[0]; if(!file) return;
    setResumeFile(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const p = JSON.parse(ev.target.result); setResumeJson(p);
        if(p.basicDetails?.name && !yourName) setYourName(p.basicDetails.name);
        setError("");
      } catch { setError("Invalid JSON file."); }
    };
    reader.readAsText(file);
  };

  const downloadAttachedResume = async () => {
    if(!resumeJson) return;
    try {
      const { blob, filename } = await getResumePDFBlob(resumeJson, jobTitle);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    } catch { setError("Could not generate PDF from this JSON file."); }
  };

  const generate = async () => {
    if(!jobDesc.trim()||!yourName.trim()) return setError("Name and job description required.");
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/email-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          yourName,
          jobDescription: jobDesc,
          jobTitle,
          background,
          resumeLink,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Failed to generate templates.");
      setTemplates(d.templates); setStep(2);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("rate") || msg.includes("503") || msg.includes("busy")) {
        setError("⏳ AI is temporarily busy. Please wait 20-30 seconds and try again.");
      } else {
        setError(msg || "Failed to generate templates.");
      }
    }
    finally { setLoading(false); }
  };

  const pick = (type) => {
    setSelected(type); setSubject(templates[type]?.subject||""); setBody(templates[type]?.body||""); setStep(3);
  };

  const sendEmail = async () => {
    if(!toEmail.trim()) return setError("Enter recipient email.");
    if(!SVC||!TMPL||!KEY) return setError("EmailJS not configured. Add VITE_EMAILJS_* to your .env");
    setError(""); setSending(true);
    try {
      await emailjs.send(SVC,TMPL,{to_email:toEmail,subject,message:body,from_name:yourName},KEY);
      setSent(true);
    } catch { setError("Email send failed. Check EmailJS config."); }
    finally { setSending(false); }
  };

  const copy = () => { navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const reset = () => { setStep(1);setJobDesc("");setJobTitle("");setYourName("");setBg("");setResumeJson(null);setResumeFile(null);setResumeLink("");setTemplates({});setSelected(null);setSubject("");setBody("");setToEmail("");setSent(false);setError(""); };

  return (
    <div style={s.page}>
      <div style={s.hdr}>
        <span style={{fontSize:28}}>✉️</span>
        <div><h1 style={s.title}>Email Outreach</h1><p style={s.sub}>AI-crafted emails with your resume link — 100% free.</p></div>
      </div>

      {/* Steps */}
      <div style={s.stepsRow}>
        {["Job Details","Choose Type","Edit & Send"].map((label,i)=>(
          <div key={i} style={s.stepWrap}>
            <div style={{...s.stepDot,background:step>i?"#10b981":step===i+1?"#6366f1":"#e2e8f0",color:step>=i+1?"#fff":"#94a3b8"}}>
              {step>i?"✓":i+1}
            </div>
            <span style={{fontSize:12,fontWeight:step===i+1?700:400,color:step>=i+1?"#6366f1":"#94a3b8"}}>{label}</span>
            {i<2&&<div style={s.stepLine}/>}
          </div>
        ))}
      </div>

      {error&&<div style={s.errBox}>{error}</div>}

      {/* STEP 1 */}
      {step===1&&(
        <div style={s.card}>
          <div style={s.formRow}>
            <Field label="Your Name *" value={yourName} onChange={setYourName} placeholder="Supriya Manigandla" />
            <Field label="Background (optional)" value={background} onChange={setBg} placeholder="B.Tech CSE, 1 year ML experience" />
          </div>
          <div style={s.formRow}>
            <Field label="Job Title (optional)" value={jobTitle} onChange={setJobTitle} placeholder="Application Support Engineer" />
          </div>

          {/* Resume link section */}
          <div style={s.resumeSec}>
            <div style={s.resumeSecTitle}>📎 Resume Link <span style={s.optBadge}>optional — included in email</span></div>

            <div style={{marginTop:4}}>
              <input style={s.inp} value={resumeLink} onChange={e=>setResumeLink(e.target.value)}
                placeholder="https://drive.google.com/... or any public link to your resume" />
              <div style={s.miniSub}>Paste a Google Drive, Dropbox, or any publicly accessible link to your resume</div>
            </div>

            <div style={{marginTop:14, paddingTop:14, borderTop:"1px dashed #e2e8f0"}}>
              <div style={s.miniLabel}>Don't have a link? Download your optimized resume PDF instead</div>
              <button style={s.upBtn} onClick={()=>jsonRef.current.click()}>
                {resumeFile?`✅ ${resumeFile}`:"Upload Optimized Resume JSON"}
              </button>
              <input ref={jsonRef} type="file" accept=".json" style={{display:"none"}} onChange={handleResumeJson}/>
              {resumeJson && (
                <button style={{...s.upBtn, marginLeft:8}} onClick={downloadAttachedResume}>
                  ⬇️ Download as PDF
                </button>
              )}
              <div style={s.miniSub}>Export the JSON from the ⚡ Optimize page, then attach the downloaded PDF to your email manually</div>
            </div>
          </div>

          <Field label="Job Description *" textarea value={jobDesc} onChange={setJobDesc}
            placeholder="Paste the full job description here..." rows={8} />
          <div style={s.charCount}>{jobDesc.length} characters</div>

          <button style={{...s.btn,opacity:loading?0.7:1}} onClick={generate} disabled={loading}>
            {loading?<><Spin/>Generating with AI...</>:"Generate Email Templates →"}
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step===2&&(
        <div style={s.card}>
          <h2 style={s.cardTitle}>Choose an email type</h2>
          <p style={s.cardSub}>All 3 templates are ready. Pick the one that fits your goal.</p>
          {resumeLink&&<div style={s.linkBanner}>📎 Resume link will be included automatically</div>}
          <div style={s.typeGrid}>
            {EMAIL_TYPES.map(t=>(
              <button key={t.id} style={s.typeCard} onClick={()=>pick(t.id)}>
                <span style={{fontSize:32}}>{t.icon}</span>
                <span style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{t.label}</span>
                <span style={{fontSize:11,color:"#64748b",lineHeight:1.4}}>{t.desc}</span>
                <span style={{fontSize:12,color:"#6366f1",fontWeight:600,marginTop:4}}>Use this →</span>
              </button>
            ))}
          </div>
          <button style={s.ghostBtn} onClick={()=>setStep(1)}>← Back</button>
        </div>
      )}

      {/* STEP 3 */}
      {step===3&&!sent&&(
        <div style={s.card}>
          <div style={s.editorTop}>
            <h2 style={s.cardTitle}>{EMAIL_TYPES.find(t=>t.id===selected)?.icon} {EMAIL_TYPES.find(t=>t.id===selected)?.label}</h2>
            <button style={s.ghostBtn} onClick={()=>setStep(2)}>← Change type</button>
          </div>
          <div style={s.switchRow}>
            <span style={{fontSize:12,color:"#94a3b8"}}>Switch:</span>
            {EMAIL_TYPES.filter(t=>t.id!==selected).map(t=>(
              <button key={t.id} style={s.switchBtn} onClick={()=>pick(t.id)}>{t.icon} {t.label}</button>
            ))}
          </div>
          <Field label="Recipient Email *" type="email" value={toEmail} onChange={setToEmail} placeholder="recruiter@company.com"/>
          <Field label="Subject" value={subject} onChange={setSubject}/>
          <Field label="Email Body" textarea value={body} onChange={setBody} rows={13} minH={260}/>
          {resumeLink&&<div style={s.linkBanner}>📎 Resume link is included in the email body above</div>}
          <div style={s.actionRow}>
            <button style={s.copyBtn} onClick={copy}>{copied?"✓ Copied!":"📋 Copy"}</button>
            <button style={{...s.sendBtn,opacity:sending?0.7:1}} onClick={sendEmail} disabled={sending}>
              {sending?<><Spin/>Sending...</>:"Send Email ✉️"}
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS */}
      {sent&&(
        <div style={s.successCard}>
          <div style={{fontSize:56}}>🎉</div>
          <h2 style={{fontSize:24,fontWeight:800,color:"#0f172a",margin:"12px 0 8px"}}>Email sent!</h2>
          <p style={{color:"#64748b",marginBottom:24}}>
            Your <strong>{EMAIL_TYPES.find(t=>t.id===selected)?.label}</strong> was sent to <strong>{toEmail}</strong>.
          </p>
          <button style={s.btn} onClick={reset}>Send another email</button>
        </div>
      )}
    </div>
  );
}

function Field({label,type="text",value,onChange,placeholder,textarea,rows,minH}) {
  const base={width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box",background:"#fafafa"};
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6}}>{label}</label>
      {textarea
        ? <textarea style={{...base,resize:"vertical",lineHeight:1.6,minHeight:minH||undefined}} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows||4}/>
        : <input style={base} type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}
    </div>
  );
}

function Spin(){return <span style={{display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin 0.8s linear infinite",marginRight:8}}/>;}

const s={
  page:{padding:"28px 32px",maxWidth:900,margin:"0 auto"},
  hdr:{display:"flex",alignItems:"center",gap:14,marginBottom:28},
  title:{fontSize:24,fontWeight:800,color:"#0f172a",margin:"0 0 4px"},
  sub:{color:"#64748b",fontSize:14,margin:0},
  stepsRow:{display:"flex",alignItems:"center",marginBottom:28},
  stepWrap:{display:"flex",alignItems:"center",gap:8},
  stepDot:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700},
  stepLine:{width:40,height:2,background:"#e2e8f0",margin:"0 8px"},
  card:{background:"#fff",borderRadius:14,padding:"28px 32px",boxShadow:"0 1px 8px rgba(0,0,0,0.05)",border:"1px solid #f1f5f9"},
  cardTitle:{fontSize:18,fontWeight:700,color:"#0f172a",margin:"0 0 6px"},
  cardSub:{fontSize:13,color:"#64748b",margin:"0 0 20px"},
  formRow:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:0},
  resumeSec:{background:"#fafbff",border:"1.5px solid #e8eaf6",borderRadius:12,padding:"18px 20px",marginBottom:16,marginTop:4},
  resumeSecTitle:{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:12,display:"flex",alignItems:"center",gap:8},
  optBadge:{background:"#eef2ff",color:"#6366f1",fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10},
  toggleRow:{display:"flex",gap:8,marginBottom:14},
  toggleBtn:{padding:"7px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:12,color:"#64748b",cursor:"pointer",fontWeight:500},
  toggleActive:{background:"#6366f1",color:"#fff",borderColor:"#6366f1",fontWeight:700},
  uploadFlow:{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"},
  uploadStep:{display:"flex",gap:10,alignItems:"flex-start"},
  miniNum:{width:22,height:22,borderRadius:"50%",background:"#6366f1",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,marginTop:2},
  miniLabel:{fontSize:12,fontWeight:600,color:"#0f172a",marginBottom:2},
  miniSub:{fontSize:10,color:"#94a3b8",marginTop:2},
  arrow:{fontSize:18,color:"#c7d2fe",fontWeight:700},
  upBtn:{marginTop:6,padding:"6px 14px",background:"#eef2ff",color:"#6366f1",border:"1.5px solid #c7d2fe",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer"},
  linkReady:{marginTop:10,padding:"8px 12px",background:"#dcfce7",borderRadius:7,fontSize:11,color:"#166534",border:"1px solid #bbf7d0",wordBreak:"break-all"},
  inp:{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box",background:"#fafafa"},
  charCount:{textAlign:"right",fontSize:11,color:"#94a3b8",marginBottom:8},
  btn:{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:13,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:8,gap:8},
  ghostBtn:{background:"none",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"7px 14px",fontSize:12,color:"#64748b",cursor:"pointer",fontWeight:500},
  typeGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16},
  typeCard:{display:"flex",flexDirection:"column",gap:6,padding:"20px 16px",borderRadius:12,border:"2px solid #f1f5f9",background:"#fafbff",cursor:"pointer",textAlign:"left"},
  editorTop:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  switchRow:{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"},
  switchBtn:{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#475569",cursor:"pointer",fontWeight:500},
  linkBanner:{padding:"10px 14px",background:"#eef2ff",borderRadius:8,fontSize:12,color:"#4338ca",fontWeight:600,marginBottom:14,border:"1px solid #c7d2fe"},
  actionRow:{display:"flex",gap:10,marginTop:12},
  copyBtn:{padding:"12px 18px",background:"#f1f5f9",border:"1.5px solid #e2e8f0",borderRadius:9,fontSize:13,color:"#475569",cursor:"pointer",fontWeight:600},
  sendBtn:{display:"flex",alignItems:"center",flex:1,justifyContent:"center",padding:"12px 24px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:9,fontSize:14,fontWeight:700,cursor:"pointer",gap:8},
  successCard:{background:"#fff",borderRadius:14,padding:"48px 32px",textAlign:"center",boxShadow:"0 1px 8px rgba(0,0,0,0.05)",border:"1px solid #f1f5f9"},
  errBox:{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 16px",color:"#dc2626",fontSize:13,marginBottom:16},
};
