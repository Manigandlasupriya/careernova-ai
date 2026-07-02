import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(" ") + "\n";
  }
  return fullText.trim();
}

export function buildFilename(optimizedResume, jobTitle = "") {
  const name    = optimizedResume?.basicDetails?.name || "Resume";
  const cleanName = name.trim().replace(/\s+/g, "_");
  const cleanJob  = (jobTitle || "").trim().replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  return cleanJob ? `${cleanName}_${cleanJob}_Resume.pdf` : `${cleanName}_Optimized_Resume.pdf`;
}

// ─── PROFESSIONAL RESUME PDF GENERATOR ───────────────────────────────────────
// Modern 2-column layout: left sidebar (contact/skills/education) + right main body
export async function generateResumePDF(resume, jobTitle = "") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const W = 210, H = 297;
  const sideW  = 68;    // sidebar width
  const mainX  = sideW + 4;
  const mainW  = W - mainX - 10;
  const sideML = 7;
  const sideTW = sideW - sideML - 4;

  // ── Color palette ──────────────────────────────────────────────────────────
  const C = {
    sidebarBg:  [15,  23, 42],   // #0f172a  deep navy
    accentBar:  [99, 102,241],   // #6366f1  indigo
    accentLight:[165,180,252],   // #a5b4fc  light indigo
    white:      [255,255,255],
    bodyText:   [30,  41, 59],   // #1e293b
    muted:      [100,116,139],   // #64748b
    headingText:[15,  23, 42],   // #0f172a
    divider:    [226,232,240],   // #e2e8f0
    chipBg:     [238,242,255],   // #eef2ff
    chipText:   [67, 56,202],    // #4338ca
    nameGrad1:  [99, 102,241],
    nameGrad2:  [139, 92,246],
  };

  const rgb  = (arr) => arr;
  const hex  = (arr) => `#${arr.map(v => v.toString(16).padStart(2,"0")).join("")}`;
  const setFill = (arr) => doc.setFillColor(...arr);
  const setDraw = (arr) => doc.setDrawColor(...arr);
  const setTxt  = (arr) => doc.setTextColor(...arr);

  // ── Page helpers ───────────────────────────────────────────────────────────
  let page = 1;
  let yMain = 0;   // cursor in main column
  let ySide = 0;   // cursor in sidebar

  const newPage = () => {
    doc.addPage();
    page++;
    // Redraw sidebar bg on new page
    setFill(C.sidebarBg);
    doc.rect(0, 0, sideW, H, "F");
    yMain = 12;
    ySide = 12;
  };

  const checkMain = (need = 12) => {
    if (yMain + need > H - 10) newPage();
  };

  const checkSide = (need = 10) => {
    // sidebar overflows → just let it clip (rare for 1 page)
    if (ySide + need > H - 10) ySide = H - 12;
  };

  // ── Text helpers ───────────────────────────────────────────────────────────
  const printMain = (text, x, maxW, size, style, color, lineH = 5.2) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    setTxt(color);
    const lines = doc.splitTextToSize(String(text || ""), maxW);
    lines.forEach(ln => {
      checkMain(lineH + 1);
      doc.text(ln, x, yMain);
      yMain += lineH;
    });
    return lines.length;
  };

  const printSide = (text, x, maxW, size, style, color, lineH = 4.8) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    setTxt(color);
    const lines = doc.splitTextToSize(String(text || ""), maxW);
    lines.forEach(ln => {
      doc.text(ln, x, ySide);
      ySide += lineH;
    });
    return lines.length;
  };

  const mainSection = (title) => {
    checkMain(16);
    yMain += 3;
    // accent bar + title
    setFill(C.accentBar);
    doc.rect(mainX - 1, yMain - 5, 3, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setTxt(C.headingText);
    doc.text(title.toUpperCase(), mainX + 4, yMain);
    yMain += 3;
    // thin divider
    setDraw(C.divider);
    doc.setLineWidth(0.4);
    doc.line(mainX + 4, yMain, mainX + mainW, yMain);
    yMain += 6;
  };

  const sideSection = (title) => {
    ySide += 4;
    // accent strip
    setFill(C.accentBar);
    doc.rect(sideML, ySide - 3, sideTW, 0.7, "F");
    ySide += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    setTxt(C.accentLight);
    doc.text(title.toUpperCase(), sideML, ySide);
    ySide += 5;
  };

  // ── Draw sidebar background ────────────────────────────────────────────────
  setFill(C.sidebarBg);
  doc.rect(0, 0, sideW, H, "F");

  // ── HEADER (full-width top banner) ─────────────────────────────────────────
  const hdrH = 44;
  setFill(C.headingText);
  doc.rect(0, 0, W, hdrH, "F");
  // indigo accent strip at bottom of header
  setFill(C.accentBar);
  doc.rect(0, hdrH - 2, W, 2, "F");

  const r = resume;
  const bd = r.basicDetails || {};

  // Name — large bold
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  setTxt(C.white);
  doc.text(bd.name || "Your Name", mainX + 2, 18);

  // Role subtitle from summary first line or jobTitle
  const roleSubtitle = jobTitle || (r.summary?.split(".")?.[0]?.slice(0,60)) || "Professional";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setTxt(C.accentLight);
  doc.text(roleSubtitle.slice(0, 55), mainX + 2, 27);

  // Contact details in header (right side of main column)
  const contacts = [
    bd.email   ? `✉ ${bd.email}`    : null,
    bd.phone   ? `✆ ${bd.phone}`    : null,
    bd.location? `⚲ ${bd.location}` : null,
  ].filter(Boolean);

  doc.setFontSize(8);
  setTxt([190, 210, 240]);
  contacts.forEach((c, i) => {
    doc.text(c, mainX + 2, 34 + i * 4.5);
  });

  // LinkedIn / GitHub in header
  const links = [bd.linkedin, bd.github].filter(Boolean);
  if (links.length) {
    doc.setFontSize(7.5);
    setTxt(C.accentLight);
    doc.text(links.join("   ·   ").slice(0, 70), mainX + 2, 35 + contacts.length * 4.5);
  }

  // ── Sidebar initials avatar ────────────────────────────────────────────────
  const initials = (bd.name || "CN").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
  setFill(C.accentBar);
  doc.circle(sideW / 2, 20, 13, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setTxt(C.white);
  doc.text(initials, sideW / 2, 23, { align: "center" });

  // ── Init cursors after header ──────────────────────────────────────────────
  yMain = hdrH + 8;
  ySide = hdrH + 8;

  // ══════════════════════════════════════════════════════════════════════════
  // SIDEBAR CONTENT
  // ══════════════════════════════════════════════════════════════════════════

  // Contact (sidebar)
  sideSection("Contact");
  const sideContacts = [
    { icon: "✉", val: bd.email },
    { icon: "✆", val: bd.phone },
    { icon: "⚲", val: bd.location },
    { icon: "in", val: bd.linkedin },
    { icon: "gh", val: bd.github },
  ].filter(c => c.val);

  sideContacts.forEach(c => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setTxt(C.accentLight);
    doc.text(c.icon, sideML, ySide);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setTxt([200, 210, 230]);
    const wrapped = doc.splitTextToSize(c.val, sideTW - 8);
    wrapped.forEach((ln, i) => {
      doc.text(ln, sideML + 7, ySide + i * 4);
    });
    ySide += wrapped.length * 4 + 2;
  });

  // Skills (sidebar)
  if (r.skills?.length) {
    sideSection("Core Skills");
    r.skills.forEach(sk => {
      checkSide(8);
      // pill background
      const tw = doc.getStringUnitWidth(sk) * 7.5 / doc.internal.scaleFactor;
      const pillW = Math.min(tw + 6, sideTW);
      setFill([30, 45, 80]);
      doc.roundedRect(sideML, ySide - 4, pillW, 6, 1.5, 1.5, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setTxt(C.accentLight);
      doc.text(sk.slice(0, 22), sideML + 3, ySide);
      ySide += 7.5;
    });
  }

  // Education (sidebar from additionalSections)
  const eduSection = (r.additionalSections || []).find(s =>
    /education/i.test(s.heading)
  );
  if (eduSection) {
    sideSection("Education");
    const lines = (eduSection.content || "").split(/[;\n]/);
    lines.forEach(ln => {
      if (!ln.trim()) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setTxt([200, 210, 230]);
      const wrapped = doc.splitTextToSize(ln.trim(), sideTW);
      wrapped.forEach(wl => { doc.text(wl, sideML, ySide); ySide += 4.5; });
      ySide += 1.5;
    });
  }

  // Certifications (sidebar)
  const certSection = (r.additionalSections || []).find(s =>
    /cert/i.test(s.heading)
  );
  if (certSection) {
    sideSection("Certifications");
    const certs = (certSection.content || "").split(/[;\n]/);
    certs.forEach(c => {
      if (!c.trim()) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setTxt([200, 210, 230]);
      const wrapped = doc.splitTextToSize("• " + c.trim(), sideTW);
      wrapped.forEach(wl => { doc.text(wl, sideML, ySide); ySide += 4.5; });
    });
  }

  // Achievements (sidebar)
  const achSection = (r.additionalSections || []).find(s =>
    /achiev|award/i.test(s.heading)
  );
  if (achSection) {
    sideSection("Achievements");
    const achs = (achSection.content || "").split(/[;\n]/);
    achs.forEach(a => {
      if (!a.trim()) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setTxt([200, 210, 230]);
      const wrapped = doc.splitTextToSize("★ " + a.trim(), sideTW);
      wrapped.forEach(wl => { doc.text(wl, sideML, ySide); ySide += 4.5; });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN COLUMN CONTENT
  // ══════════════════════════════════════════════════════════════════════════

  // Professional Summary
  if (r.summary) {
    mainSection("Professional Summary");
    // Box around summary
    const sumLines = doc.splitTextToSize(r.summary, mainW - 4);
    const sumH     = sumLines.length * 5.2 + 8;
    checkMain(sumH + 4);
    setFill([245, 247, 255]);
    setDraw(C.divider);
    doc.setLineWidth(0.3);
    doc.roundedRect(mainX + 2, yMain - 3, mainW - 2, sumH, 2, 2, "FD");
    // left accent line on summary box
    setFill(C.accentBar);
    doc.roundedRect(mainX + 2, yMain - 3, 2.5, sumH, 0, 0, "F");

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.2);
    setTxt([50, 60, 80]);
    sumLines.forEach(ln => { doc.text(ln, mainX + 8, yMain); yMain += 5.2; });
    yMain += 5;
  }

  // Work Experience
  if (r.experience?.length) {
    mainSection("Work Experience");
    r.experience.forEach((exp, ei) => {
      checkMain(20);
      // Job title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      setTxt(C.headingText);
      doc.text(exp.jobTitle || "", mainX + 4, yMain);

      // Duration (right aligned)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setTxt(C.muted);
      doc.text(exp.duration || "", mainX + mainW, yMain, { align: "right" });
      yMain += 5;

      // Company name with indigo color + location
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setTxt(C.accentBar);
      doc.text(exp.company || "", mainX + 4, yMain);
      yMain += 5.5;

      // Bullets
      (exp.bullets || []).forEach(b => {
        if (!b || !b.trim()) return;
        checkMain(6);
        // bullet dot
        setFill(C.accentBar);
        doc.circle(mainX + 5.5, yMain - 1.2, 1, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setTxt(C.bodyText);
        const lines = doc.splitTextToSize(b, mainW - 12);
        lines.forEach((ln, li) => {
          checkMain(5.5);
          doc.text(ln, mainX + 9, yMain);
          yMain += 5;
        });
      });

      // Spacing between jobs
      if (ei < r.experience.length - 1) {
        setDraw([235, 238, 245]);
        doc.setLineWidth(0.3);
        doc.line(mainX + 4, yMain + 2, mainX + mainW, yMain + 2);
        yMain += 7;
      } else {
        yMain += 4;
      }
    });
  }

  // Projects
  if (r.projects?.length) {
    mainSection("Key Projects");
    r.projects.forEach((proj, pi) => {
      checkMain(18);

      // Project name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setTxt(C.headingText);
      doc.text(proj.name || "", mainX + 4, yMain);
      yMain += 5;

      // Technologies as small chips
      if (proj.technologies?.length) {
        let techX = mainX + 4;
        proj.technologies.slice(0, 6).forEach(tech => {
          const tw = doc.getStringUnitWidth(tech) * 7.5 / doc.internal.scaleFactor + 5;
          if (techX + tw > mainX + mainW) return;
          setFill(C.chipBg);
          doc.roundedRect(techX, yMain - 3.5, tw, 5.5, 1.2, 1.2, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          setTxt(C.chipText);
          doc.text(tech, techX + 2.5, yMain);
          techX += tw + 2;
        });
        yMain += 6;
      }

      // Description
      if (proj.description) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.8);
        setTxt(C.muted);
        const descLines = doc.splitTextToSize(proj.description, mainW - 8);
        descLines.forEach(ln => { checkMain(5); doc.text(ln, mainX + 4, yMain); yMain += 4.8; });
        yMain += 1;
      }

      // Bullets
      (proj.bullets || []).forEach(b => {
        if (!b || !b.trim()) return;
        checkMain(6);
        setFill(C.accentBar);
        doc.circle(mainX + 5.5, yMain - 1.2, 1, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setTxt(C.bodyText);
        const lines = doc.splitTextToSize(b, mainW - 12);
        lines.forEach(ln => { checkMain(5); doc.text(ln, mainX + 9, yMain); yMain += 5; });
      });

      if (pi < r.projects.length - 1) {
        setDraw([235, 238, 245]);
        doc.setLineWidth(0.3);
        doc.line(mainX + 4, yMain + 2, mainX + mainW, yMain + 2);
        yMain += 7;
      } else {
        yMain += 4;
      }
    });
  }

  // ── Page numbers ───────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setTxt(C.muted);
    doc.text(`${i} / ${total}`, W - 10, H - 5, { align: "right" });
    // footer line
    setDraw(C.divider);
    doc.setLineWidth(0.3);
    doc.line(sideW + 4, H - 8, W - 5, H - 8);
  }

  return doc;
}

export async function downloadResumePDF(optimizedResume, jobTitle = "") {
  const doc      = await generateResumePDF(optimizedResume, jobTitle);
  const filename = buildFilename(optimizedResume, jobTitle);
  doc.save(filename);
  return filename;
}

export async function getResumePDFBlob(optimizedResume, jobTitle = "") {
  const doc = await generateResumePDF(optimizedResume, jobTitle);
  return { blob: doc.output("blob"), filename: buildFilename(optimizedResume, jobTitle) };
}
