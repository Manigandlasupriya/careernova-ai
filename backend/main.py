"""
CareerNova AI — FastAPI Backend v5
Rate Limit Fix: Rotating multiple Gemini API keys (Solution 2)
"""


from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import mysql.connector
import os, hashlib, secrets, json, re, time, itertools
from datetime import datetime, timedelta
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# ═══════════════════════════════════════════════════════════════════════════════
# ── GEMINI KEY ROTATION — Add up to 5 keys in your .env ──────────────────────
# ═══════════════════════════════════════════════════════════════════════════════
def load_gemini_keys() -> list:
    keys = []
    # Load GEMINI_KEY_1, GEMINI_KEY_2, GEMINI_KEY_3 ... GEMINI_KEY_5
    for i in range(1, 6):
        k = os.getenv(f"GEMINI_KEY_{i}", "").strip()
        if k:
            keys.append(k)
    # Also support old single key GEMINI_API_KEY
    single = os.getenv("GEMINI_API_KEY", "").strip()
    if single and single not in keys:
        keys.append(single)
    if not keys:
        raise RuntimeError("No Gemini API keys found! Add GEMINI_KEY_1 in your .env file.")
    print(f"✅ Loaded {len(keys)} Gemini API key(s).")
    return keys

GEMINI_KEYS   = load_gemini_keys()
key_cycle     = itertools.cycle(GEMINI_KEYS)   # infinite rotation
GEMINI_MODEL  = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Fallback model list if primary is rate-limited
# NOTE: gemini-2.0-flash / gemini-2.0-flash-lite were shut down by Google on
# June 1, 2026, and all gemini-1.5-* models are already retired (they now
# return 404 NOT_FOUND). Only 2.5-family / newer models are kept here.
FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"]

# ── MySQL ──────────────────────────────────────────────────────────────────────
DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "user":     os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "careernova_ai"),
}

def get_db():
    conn = mysql.connector.connect(**DB_CONFIG)
    conn.autocommit = True
    try:
        yield conn
    finally:
        if conn.is_connected():
            conn.close()

def execute(conn, query, params=(), fetch="all"):
    cur = conn.cursor(dictionary=True)
    cur.execute(query, params)
    if fetch == "all":   r = cur.fetchall(); cur.close(); return r
    elif fetch == "one": r = cur.fetchone(); cur.close(); return r
    else:                cur.close(); return None

# ── Schema ─────────────────────────────────────────────────────────────────────
EXPECTED = {
    "users":            {"id","name","email","password_hash","created_at"},
    "sessions":         {"token","user_id","expires_at"},
    "analysis_history": {"id","user_id","job_description","ats_score","keyword_score",
                         "semantic_score","report_json","optimized_json","created_at"},
    "job_tracker":      {"id","user_id","company_name","role_title","location","salary",
                         "status","notes","applied_date","linkedin_url","last_updated"},
}

DDL = {
    "users": """CREATE TABLE users (
        id            VARCHAR(64)  PRIMARY KEY,
        name          VARCHAR(120) NOT NULL,
        email         VARCHAR(180) NOT NULL UNIQUE,
        password_hash VARCHAR(128) NOT NULL,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )""",
    "sessions": """CREATE TABLE sessions (
        token      VARCHAR(128) PRIMARY KEY,
        user_id    VARCHAR(64)  NOT NULL,
        expires_at DATETIME     NOT NULL
    )""",
    "analysis_history": """CREATE TABLE analysis_history (
        id              VARCHAR(64)  PRIMARY KEY,
        user_id         VARCHAR(64)  NOT NULL,
        job_description TEXT,
        ats_score       INT,
        keyword_score   INT,
        semantic_score  INT,
        report_json     LONGTEXT,
        optimized_json  LONGTEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )""",
    "job_tracker": """CREATE TABLE job_tracker (
        id           VARCHAR(64)  PRIMARY KEY,
        user_id      VARCHAR(64)  NOT NULL,
        company_name VARCHAR(120),
        role_title   VARCHAR(120),
        location     VARCHAR(120),
        salary       VARCHAR(80),
        status       ENUM('Wishlist','Applied','Interviewing','Offer','Rejected') DEFAULT 'Applied',
        notes        TEXT,
        applied_date DATE,
        linkedin_url VARCHAR(300),
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )""",
}

def init_db():
    cfg  = {k: v for k, v in DB_CONFIG.items() if k != "database"}
    conn = mysql.connector.connect(**cfg)
    cur  = conn.cursor()
    cur.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
    cur.execute(f"USE {DB_CONFIG['database']}")
    for table, expected_cols in EXPECTED.items():
        cur.execute(f"SHOW TABLES LIKE '{table}'")
        if cur.fetchone():
            cur.execute(f"SHOW COLUMNS FROM {table}")
            actual = {row[0] for row in cur.fetchall()}
            if not expected_cols.issubset(actual):
                print(f"⚠️  Recreating '{table}' (schema mismatch)…")
                cur.execute(f"DROP TABLE {table}")
                cur.execute(DDL[table])
        else:
            cur.execute(DDL[table])
            print(f"✅ Created '{table}'")
    conn.commit(); cur.close(); conn.close()
    print("✅ Database ready.")

# ── App ────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try: init_db()
    except Exception as e: print(f"⚠️  DB warning: {e}")
    yield

app = FastAPI(title="CareerNova AI API", version="5.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# ── Auth helpers ───────────────────────────────────────────────────────────────
def hash_pw(pw: str) -> str:
    salt = os.getenv("PASSWORD_SALT", "careernova_salt_v1").encode()
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000).hex()

def gen_token() -> str:
    return secrets.token_hex(32)

def current_user(authorization: str = Header(default=""), db=Depends(get_db)):
    tok = authorization.replace("Bearer ", "").strip()
    if not tok: raise HTTPException(401, "Missing token")
    sess = execute(db, "SELECT user_id FROM sessions WHERE token=%s AND expires_at>NOW()",
                   (tok,), fetch="one")
    if not sess: raise HTTPException(401, "Invalid or expired token")
    user = execute(db, "SELECT * FROM users WHERE id=%s", (sess["user_id"],), fetch="one")
    if not user: raise HTTPException(401, "User not found")
    return user

# ── Schemas ────────────────────────────────────────────────────────────────────
class RegisterReq(BaseModel):
    name: str; email: str; password: str

class LoginReq(BaseModel):
    email: str; password: str

class AnalyzeReq(BaseModel):
    resumeText: str; jobDescription: str

class OptimizeReq(BaseModel):
    resumeText: str; jobDescription: str
    targetAtsScore: Optional[int] = 90
    historyId: Optional[str] = None

class InterviewReq(BaseModel):
    messages: List[dict]
    jobTitle: Optional[str] = "Software Engineer"
    type: Optional[str] = "full"
    userMessage: Optional[str] = ""

class EmailGenReq(BaseModel):
    yourName: str
    jobDescription: str
    jobTitle: Optional[str] = ""
    background: Optional[str] = ""
    resumeLink: Optional[str] = ""

class TrackerReq(BaseModel):
    companyName: Optional[str] = None; roleTitle: Optional[str] = None
    location:    Optional[str] = None; salary:    Optional[str] = None
    status:      Optional[str] = "Applied"; notes: Optional[str] = None
    appliedDate: Optional[str] = None;  linkedinUrl: Optional[str] = None

# ══════════════════════════════════════════════════════════════════════════════
# ── AI CORE — Key rotation + model fallback ───────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def clean_json(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```\s*$",       "", raw, flags=re.MULTILINE)
    raw = raw.strip()
    raw = re.sub(r",(\s*[}\]])", r"\1", raw)   # remove trailing commas
    return raw

def extract_json_object(raw: str):
    """Try multiple strategies to pull a valid JSON object out of messy AI text."""
    candidates = []
    cleaned = clean_json(raw)
    candidates.append(cleaned)

    # Strategy: grab the largest {...} block
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if m:
        candidates.append(clean_json(m.group(0)))

    # Strategy: remove any leading/trailing prose before first { and after last }
    first = cleaned.find("{")
    last  = cleaned.rfind("}")
    if first != -1 and last != -1 and last > first:
        candidates.append(clean_json(cleaned[first:last + 1]))

    for cand in candidates:
        try:
            return json.loads(cand)
        except json.JSONDecodeError:
            continue

    # Last resort: fix common single-quote / unescaped issues then retry
    try:
        fixed = re.sub(r"(?<!\\)'", '"', candidates[0])
        return json.loads(fixed)
    except Exception:
        pass

    return None

def is_rate_limit(err: str) -> bool:
    e = err.lower()
    return ("429" in err or "quota" in e or "resource_exhausted" in e
            or "overloaded" in e or "rate" in e)

def is_model_not_found(err: str) -> bool:
    """True if the model name itself is invalid/retired (no point retrying other keys)."""
    e = err.lower()
    return ("404" in err or "not_found" in e or "not found" in e
            or "is not found for api version" in e)

def is_bad_key(err: str) -> bool:
    """True if the API key itself is invalid (no point retrying this key on any model)."""
    e = err.lower()
    return ("api key not valid" in e or "api_key_invalid" in e
            or "permission_denied" in e or "403" in err)

def parse_wait(err: str) -> float:
    m = re.search(r"retry[_ ]?(?:after)?[:\s]+([0-9.]+)", err, re.IGNORECASE)
    if m: return min(float(m.group(1)) + 1, 60)
    m = re.search(r"retry in ([0-9.]+)\s*s", err, re.IGNORECASE)
    if m: return min(float(m.group(1)) + 1, 60)
    return 15.0   # longer default — give Gemini more breathing room

def try_generate(api_key: str, model_name: str, prompt: str, max_tokens: int) -> str:
    """Configure key and call Gemini using the new google-genai SDK. Returns raw text."""
    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=0.3,
            response_mime_type="application/json",   # forces Gemini to return pure JSON
        )
    )
    return resp.text

def ai_call(prompt: str, max_tokens: int = 2000) -> dict:
    """
    Strategy:
    1. Try next key in rotation with primary model.
       - On bad JSON → try to repair it; if repair fails, try NEXT key (don't give up).
       - On 429 → immediately try NEXT key.
    2. If all keys exhausted for primary model → try fallback models.
    3. If truly all fail → wait 10s and try once more.
    4. Clear 503 error to frontend only as last resort.
    """
    total_keys    = len(GEMINI_KEYS)
    tried_keys    = 0
    tried_models  = set()
    last_json_err = None

    # ── Phase 1: Rotate through all keys with primary model ───────────────────
    while tried_keys < total_keys:
        key = next(key_cycle)
        tried_keys += 1
        short_key  = key[:12] + "…"
        try:
            print(f"🔑 Key {tried_keys}/{total_keys} ({short_key}) | model: {GEMINI_MODEL}")
            raw    = try_generate(key, GEMINI_MODEL, prompt, max_tokens)
            result = extract_json_object(raw)
            if result is not None:
                print(f"✅ Success with key {short_key}")
                return result
            last_json_err = raw[:200]
            print(f"⚠️  Key {short_key} returned unparseable JSON. Trying next key/model…")
            continue
        except Exception as e:
            err = str(e)
            if is_model_not_found(err):
                print(f"❌ Model '{GEMINI_MODEL}' not found/retired ({err[:150]}). Skipping straight to fallback models…")
                break
            if is_bad_key(err):
                print(f"❌ Key {short_key} invalid/rejected: {err[:150]}. Trying next key…")
                continue
            if is_rate_limit(err):
                wait = parse_wait(err)
                if tried_keys < total_keys:
                    print(f"⏳ Key {short_key} rate-limited. Switching to next key (wait {min(wait,8):.0f}s)…")
                    time.sleep(min(wait, 8))
                else:
                    print(f"⏳ All {total_keys} keys tried. Waiting {wait:.0f}s before fallback models…")
                    time.sleep(wait)
            else:
                print(f"❌ Non-rate-limit error with key {short_key}: {err[:120]}")
                continue

    tried_models.add(GEMINI_MODEL)

    # ── Phase 2: Try fallback models with each key ─────────────────────────────
    for fb_model in FALLBACK_MODELS:
        if fb_model in tried_models:
            continue
        tried_models.add(fb_model)
        for key in GEMINI_KEYS:
            short_key = key[:12] + "…"
            try:
                print(f"🔄 Fallback model: {fb_model} | key {short_key}")
                raw    = try_generate(key, fb_model, prompt, max_tokens)
                result = extract_json_object(raw)
                if result is not None:
                    print(f"✅ Fallback {fb_model} succeeded.")
                    return result
                last_json_err = raw[:200]
                continue
            except Exception as e:
                if is_rate_limit(str(e)):
                    print(f"⏳ Fallback {fb_model} ({short_key}) rate-limited.")
                    time.sleep(6)
                continue

    # ── Phase 3: Final retry after longer wait, with stricter re-prompt ────────
    print("⏳ All models and keys struggled. Final retry in 25s with stricter prompt…")
    time.sleep(25)
    strict_prompt = prompt + "\n\nIMPORTANT: Output ONLY the raw JSON object. No markdown, no explanation, no code fences."
    key = next(key_cycle)
    final_model = FALLBACK_MODELS[0]  # retry a known-current model, not necessarily the (possibly dead) primary
    try:
        raw    = try_generate(key, final_model, strict_prompt, max_tokens)
        result = extract_json_object(raw)
        if result is not None:
            print("✅ Final retry succeeded.")
            return result
    except Exception:
        pass

    raise HTTPException(
        status_code=503,
        detail=(
            "⏳ The AI is having trouble generating a valid response right now. "
            "This usually resolves itself — please click the button again in a few seconds. "
            "If it keeps happening, try shortening your resume/job description text."
        )
    )

def ai_text(prompt: str) -> str:
    """For non-JSON calls (interview, email generation). Full key rotation + model fallback."""
    total_keys = len(GEMINI_KEYS)

    # ── Phase 1: Rotate through all keys with primary model ───────────────────
    tried_keys = 0
    while tried_keys < total_keys:
        key = next(key_cycle)
        tried_keys += 1
        short_key = key[:12] + "…"
        try:
            print(f"🔑 [text] Key {tried_keys}/{total_keys} ({short_key}) | model: {GEMINI_MODEL}")
            client = genai.Client(api_key=key)
            resp = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
            if resp.text and resp.text.strip():
                print(f"✅ [text] Success with key {short_key}")
                return resp.text.strip()
            continue
        except Exception as e:
            err = str(e)
            if is_model_not_found(err):
                print(f"❌ [text] Model '{GEMINI_MODEL}' not found/retired ({err[:150]}). Skipping straight to fallback models…")
                break
            if is_bad_key(err):
                print(f"❌ [text] Key {short_key} invalid/rejected: {err[:150]}. Trying next key…")
                continue
            if is_rate_limit(err):
                wait = parse_wait(err)
                if tried_keys < total_keys:
                    print(f"⏳ [text] Key {short_key} rate-limited. Switching to next key (wait {min(wait,8):.0f}s)…")
                    time.sleep(min(wait, 8))
                else:
                    print(f"⏳ [text] All {total_keys} keys tried. Waiting {wait:.0f}s before fallback models…")
                    time.sleep(wait)
            else:
                print(f"❌ [text] Non-rate-limit error with key {short_key}: {err[:120]}")
                continue

    # ── Phase 2: Try fallback models with each key ─────────────────────────────
    for fb_model in FALLBACK_MODELS:
        if fb_model == GEMINI_MODEL:
            continue
        for key in GEMINI_KEYS:
            short_key = key[:12] + "…"
            try:
                print(f"🔄 [text] Fallback model: {fb_model} | key {short_key}")
                client = genai.Client(api_key=key)
                resp = client.models.generate_content(model=fb_model, contents=prompt)
                if resp.text and resp.text.strip():
                    print(f"✅ [text] Fallback {fb_model} succeeded.")
                    return resp.text.strip()
                continue
            except Exception as e:
                if is_rate_limit(str(e)):
                    print(f"⏳ [text] Fallback {fb_model} ({short_key}) rate-limited.")
                    time.sleep(6)
                continue

    # ── Phase 3: Final retry after longer wait ──────────────────────────────────
    print("⏳ [text] All models and keys struggled. Final retry in 25s…")
    time.sleep(25)
    key = next(key_cycle)
    final_model = FALLBACK_MODELS[0]  # retry a known-current model, not necessarily the (possibly dead) primary
    try:
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(model=final_model, contents=prompt)
        if resp.text and resp.text.strip():
            print("✅ [text] Final retry succeeded.")
            return resp.text.strip()
    except Exception:
        pass

    raise HTTPException(
        503,
        "⏳ The AI is temporarily busy across all available keys and models. "
        "Please wait about 30 seconds and try again."
    )

# ══════════════════════════════════════════════════════════════════════════════
# ── AUTH ROUTES ───────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/api/register", status_code=201)
def register(body: RegisterReq, db=Depends(get_db)):
    name  = body.name.strip()
    email = body.email.strip().lower()
    if not all([name, email, body.password]):
        raise HTTPException(400, "All fields required")
    if execute(db, "SELECT id FROM users WHERE email=%s", (email,), fetch="one"):
        raise HTTPException(409, "Email already registered")
    uid = "u_" + secrets.token_hex(12)
    execute(db, "INSERT INTO users (id,name,email,password_hash) VALUES (%s,%s,%s,%s)",
            (uid, name, email, hash_pw(body.password)), fetch="none")
    tok = gen_token()
    execute(db, "INSERT INTO sessions (token,user_id,expires_at) VALUES (%s,%s,%s)",
            (tok, uid, datetime.now() + timedelta(days=7)), fetch="none")
    return {"token": tok, "user": {"id": uid, "name": name, "email": email}}

@app.post("/api/login")
def login(body: LoginReq, db=Depends(get_db)):
    email = body.email.strip().lower()
    user  = execute(db, "SELECT * FROM users WHERE email=%s", (email,), fetch="one")
    if not user or user["password_hash"] != hash_pw(body.password):
        raise HTTPException(401, "Invalid email or password")
    tok = gen_token()
    execute(db, "INSERT INTO sessions (token,user_id,expires_at) VALUES (%s,%s,%s)",
            (tok, user["id"], datetime.now() + timedelta(days=7)), fetch="none")
    return {"token": tok, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}

@app.post("/api/logout")
def logout(authorization: str = Header(default=""), db=Depends(get_db), u=Depends(current_user)):
    tok = authorization.replace("Bearer ", "").strip()
    execute(db, "DELETE FROM sessions WHERE token=%s", (tok,), fetch="none")
    return {"message": "Logged out"}

@app.get("/api/me")
def me(u=Depends(current_user)):
    return {"user": {"id": u["id"], "name": u["name"], "email": u["email"]}}

# ══════════════════════════════════════════════════════════════════════════════
# ── ANALYZE ───────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/api/analyze")
def analyze(body: AnalyzeReq, db=Depends(get_db), u=Depends(current_user)):
    if not body.resumeText.strip() or not body.jobDescription.strip():
        raise HTTPException(400, "Resume and job description required")

    resume = body.resumeText[:2000]
    jd     = body.jobDescription[:1000]

    prompt = f"""ATS resume analyzer. Return ONLY valid JSON, no markdown, no extra text.

RESUME: {resume}

JOB DESCRIPTION: {jd}

Return exactly this JSON:
{{"atsScore":85,"keywordScore":80,"semanticScore":78,"completenessScore":82,"formattingScore":75,"matchedKeywords":["Python","SQL"],"missingKeywords":["Docker","Kubernetes"],"gapAnalysis":{{"missingSkills":["Docker"],"missingCertifications":[],"missingTechnologies":["Kubernetes"],"recommendations":["Add Docker experience"]}},"recommendations":{{"strengths":["Strong Python skills"],"weaknesses":["Missing cloud certs"],"improvements":["Add metrics to bullets"],"interviewTips":["Prepare STAR stories"]}}}}"""

    try:
        report = ai_call(prompt, max_tokens=1000)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")

    for k in ("atsScore","keywordScore","semanticScore","completenessScore","formattingScore"):
        report.setdefault(k, 0)
    report.setdefault("matchedKeywords", [])
    report.setdefault("missingKeywords", [])
    report.setdefault("gapAnalysis", {"missingSkills":[],"missingCertifications":[],"missingTechnologies":[],"recommendations":[]})
    report.setdefault("recommendations", {"strengths":[],"weaknesses":[],"improvements":[],"interviewTips":[]})

    hid = "h_" + secrets.token_hex(10)
    execute(db,
        "INSERT INTO analysis_history (id,user_id,job_description,ats_score,keyword_score,semantic_score,report_json) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (hid, u["id"], body.jobDescription[:1000],
         report.get("atsScore",0), report.get("keywordScore",0),
         report.get("semanticScore",0), json.dumps(report)), fetch="none")

    return {"historyId": hid, "report": report}

# ══════════════════════════════════════════════════════════════════════════════
# ── OPTIMIZE ──────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/api/optimize")
def optimize(body: OptimizeReq, db=Depends(get_db), u=Depends(current_user)):
    if not body.resumeText.strip() or not body.jobDescription.strip():
        raise HTTPException(400, "Resume and job description required")

    resume = body.resumeText[:2000]
    jd     = body.jobDescription[:1000]
    score  = body.targetAtsScore or 90

    prompt = f"""Professional resume writer. Rewrite for {score}+ ATS score.
Write like a confident 10-year experienced professional. Natural language, varied openers, quantified results.
Return ONLY valid JSON, no markdown, no backticks, no trailing commas.

JD: {jd}

RESUME: {resume}

Return this exact JSON structure:
{{"basicDetails":{{"name":"","email":"","phone":"","location":"","linkedin":"","github":""}},"summary":"3-sentence confident professional summary aligned to JD","skills":["skill1","skill2","skill3"],"experience":[{{"jobTitle":"","company":"","duration":"","bullets":["Led X resulting in Y% improvement","Engineered Z reducing time by N hours","Partnered with team to deliver A improving B by C%","Drove initiative achieving D outcome for E users"]}}],"projects":[{{"name":"","technologies":["tech1","tech2"],"description":"brief one-line description","bullets":["Built X using Y achieving Z","Optimized A reducing B by C%"]}}],"additionalSections":[{{"heading":"Education","content":"Degree, Institute, Year"}},{{"heading":"Certifications","content":"Cert1; Cert2"}},{{"heading":"Achievements","content":"Award1; Award2"}}]}}"""

    try:
        opt = ai_call(prompt, max_tokens=2500)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(500, f"AI returned malformed JSON. Please try again. ({e})")
    except Exception as e:
        raise HTTPException(500, f"Optimization failed: {e}")

    # Safety normalization
    opt.setdefault("basicDetails", {})
    opt.setdefault("summary", "")
    opt.setdefault("skills", [])
    opt.setdefault("experience", [])
    opt.setdefault("projects", [])
    opt.setdefault("additionalSections", [])
    opt["skills"] = [s for s in opt["skills"] if s and str(s).strip()]
    for exp in opt["experience"]:
        exp.setdefault("bullets", [])
        exp["bullets"] = [b for b in exp["bullets"] if b and str(b).strip()]
    for proj in opt.get("projects", []):
        proj.setdefault("bullets", [])
        proj.setdefault("technologies", [])
        proj["bullets"] = [b for b in proj["bullets"] if b and str(b).strip()]

    if body.historyId:
        execute(db,
            "UPDATE analysis_history SET optimized_json=%s WHERE id=%s AND user_id=%s",
            (json.dumps(opt), body.historyId, u["id"]), fetch="none")

    return {"optimizedResume": opt}

# ══════════════════════════════════════════════════════════════════════════════
# ── INTERVIEW ─────────────────════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/api/interview")
def interview(body: InterviewReq):
    system = (
        f"You are an expert interview coach for a {body.type} interview for: {body.jobTitle}. "
        "Ask one focused question at a time. After each answer give: "
        "**Score: X/10** | ✅ Strength: [what they did well] | 💡 Improve: [specific suggestion]. "
        "Then ask the next question."
    )
    history_lines = "\n".join(
        f"{'Interviewer' if m['role']=='assistant' else 'Candidate'}: {m['content']}"
        for m in body.messages[-10:]
    )
    if not body.messages:
        prompt = f"{system}\n\nGreet the candidate warmly and ask your first interview question."
    else:
        prompt = f"{system}\n\nConversation:\n{history_lines}\n\nCandidate: {body.userMessage}\n\nRespond:"

    try:
        return {"message": ai_text(prompt)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Interview session failed: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# ── EMAIL OUTREACH GENERATOR ─────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/api/email-generate")
def email_generate(body: EmailGenReq, u=Depends(current_user)):
    if not body.yourName.strip() or not body.jobDescription.strip():
        raise HTTPException(400, "Your name and job description are required")

    link_note = f"Resume link: {body.resumeLink}" if body.resumeLink else ""
    jd = body.jobDescription[:1500]

    prompt = f"""Generate 3 professional outreach email templates. Return ONLY valid JSON, no markdown.

CANDIDATE: {body.yourName}
BACKGROUND: {body.background or "Not specified"}
JOB TITLE: {body.jobTitle or "Not specified"}
{link_note}
JOB DESCRIPTION: {jd}

Rules:
- If a resume link is provided, naturally include it as "📎 Resume: <link>" near the end of the body
- Keep emails concise (120-180 words), professional, and personalized to the job
- referral = asking a connection at the company for a referral
- cold = direct cold outreach to a recruiter/hiring manager
- cover = formal cover letter style email attached to an application

Return exactly this JSON:
{{"referral":{{"subject":"...","body":"..."}},"cold":{{"subject":"...","body":"..."}},"cover":{{"subject":"...","body":"..."}}}}"""

    try:
        templates = ai_call(prompt, max_tokens=1500)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Email generation failed: {e}")

    for key in ("referral", "cold", "cover"):
        templates.setdefault(key, {"subject": "", "body": ""})

    return {"templates": templates}

# ══════════════════════════════════════════════════════════════════════════════
# ── HISTORY ───────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/history")
def get_history(db=Depends(get_db), u=Depends(current_user)):
    rows = execute(db,
        "SELECT id,job_description,ats_score,keyword_score,semantic_score,created_at "
        "FROM analysis_history WHERE user_id=%s ORDER BY created_at DESC LIMIT 20",
        (u["id"],))
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return {"history": rows}

@app.get("/api/history/{hid}")
def get_history_detail(hid: str, db=Depends(get_db), u=Depends(current_user)):
    row = execute(db, "SELECT * FROM analysis_history WHERE id=%s AND user_id=%s",
                  (hid, u["id"]), fetch="one")
    if not row: raise HTTPException(404, "Not found")
    row["report"]    = json.loads(row.pop("report_json")    or "{}")
    row["optimized"] = json.loads(row.pop("optimized_json") or "{}")
    if isinstance(row.get("created_at"), datetime):
        row["created_at"] = row["created_at"].isoformat()
    return {"history": row}

@app.delete("/api/history/{hid}")
def delete_history(hid: str, db=Depends(get_db), u=Depends(current_user)):
    execute(db, "DELETE FROM analysis_history WHERE id=%s AND user_id=%s",
            (hid, u["id"]), fetch="none")
    return {"message": "Deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# ── JOB TRACKER ───────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/tracker")
def get_tracker(db=Depends(get_db), u=Depends(current_user)):
    rows = execute(db,
        "SELECT * FROM job_tracker WHERE user_id=%s ORDER BY last_updated DESC",
        (u["id"],))
    for r in rows:
        for k in ("applied_date", "last_updated"):
            if isinstance(r.get(k), datetime): r[k] = r[k].isoformat()
    return {"trackers": rows}

@app.post("/api/tracker", status_code=201)
def add_tracker(body: TrackerReq, db=Depends(get_db), u=Depends(current_user)):
    tid = "t_" + secrets.token_hex(10)
    execute(db,
        "INSERT INTO job_tracker (id,user_id,company_name,role_title,location,salary,"
        "status,notes,applied_date,linkedin_url) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (tid, u["id"], body.companyName, body.roleTitle, body.location, body.salary,
         body.status, body.notes, body.appliedDate or datetime.now().date(),
         body.linkedinUrl), fetch="none")
    return {"id": tid, "message": "Added"}

@app.put("/api/tracker/{tid}")
def update_tracker(tid: str, body: TrackerReq, db=Depends(get_db), u=Depends(current_user)):
    execute(db,
        "UPDATE job_tracker SET company_name=%s,role_title=%s,location=%s,salary=%s,"
        "status=%s,notes=%s,linkedin_url=%s WHERE id=%s AND user_id=%s",
        (body.companyName, body.roleTitle, body.location, body.salary,
         body.status, body.notes, body.linkedinUrl, tid, u["id"]), fetch="none")
    return {"message": "Updated"}

@app.delete("/api/tracker/{tid}")
def delete_tracker(tid: str, db=Depends(get_db), u=Depends(current_user)):
    execute(db, "DELETE FROM job_tracker WHERE id=%s AND user_id=%s",
            (tid, u["id"]), fetch="none")
    return {"message": "Deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# ── HEALTH & ROOT ─────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/health")
def health(db=Depends(get_db)):
    try:
        execute(db, "SELECT 1", fetch="one")
        return {
            "status": "ok",
            "app": "CareerNova AI v5",
            "database": DB_CONFIG["database"],
            "gemini_keys_loaded": len(GEMINI_KEYS),
            "primary_model": GEMINI_MODEL
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/")
def root():
    return {
        "message": "CareerNova AI API v5.0 ✅",
        "gemini_keys": len(GEMINI_KEYS),
        "model": GEMINI_MODEL
    }
