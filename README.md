# 🚀 CareerNova AI — Launch Your Career with AI

An all-in-one AI-powered career platform: ATS resume analysis, AI resume optimization, mock interviews, job tracker, and email outreach.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Resume Analyzer** | ATS score, keyword match, gap analysis |
| ⚡ **Resume Optimizer** | AI rewrites resume with STAR bullets + JD keywords → 90+ ATS |
| 🎤 **Interview Coach** | AI mock interviews with real-time scored feedback |
| 📋 **Job Tracker** | Kanban-style application pipeline |
| ✉️ **Email Outreach** | AI-crafted cold emails, referrals, cover letters |
| 🕑 **History** | All past analyses saved and searchable |

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, lucide-react, jsPDF, pdfjs-dist
- **Backend**: Python 3.11+, FastAPI, MySQL, Google Gemini 2.5 Flash
- **Auth**: Token-based sessions (7-day expiry)

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your GEMINI_API_KEY and MySQL credentials
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# (Optional) Add EmailJS keys to .env
npm run dev
```

### 3. Open in Browser

```
http://localhost:5173
```

---

## 📄 Optimized Resume PDF

The PDF uses a **modern 2-column layout**:
- **Left sidebar**: Contact info, Skills (pill style), Education, Certifications, Achievements
- **Right main**: Professional Summary (boxed), Work Experience (STAR bullets), Projects (tech chips)
- Indigo/Navy color scheme, clean typography, recruiter-ready

---

## ⚙️ Environment Variables

### Backend `.env`
```
GEMINI_API_KEY=your_key
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=careernova_ai
PASSWORD_SALT=careernova_salt_v1
```

### Frontend `.env` (optional — for email sending)
```
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
```

---

## 📁 Project Structure

```
careernova-ai/
├── backend/
│   ├── main.py              # FastAPI app (all routes)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── public/
    │   └── careernova-logo.jpg
    ├── src/
    │   ├── App.jsx           # Root + sidebar layout
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Analyze.jsx
    │   │   ├── Optimize.jsx  # Main feature — AI resume rewriter
    │   │   ├── Interview.jsx
    │   │   ├── Tracker.jsx
    │   │   ├── EmailOutreach.jsx
    │   │   ├── History.jsx
    │   │   ├── Login.jsx
    │   │   └── Register.jsx
    │   └── utils/
    │       └── pdfUtils.js   # PDF generation (2-column modern layout)
    ├── package.json
    └── vite.config.js
```
