import PDFDocument from "pdfkit";

const ACCENT_BY_TEMPLATE = {
  Modern: "#7C3AED",
  Classic: "#111827",
  Minimal: "#0F172A",
  "ATS-Safe": "#000000",
};

export function renderResumePdf(
  { profile, resume },
  { template = "Modern", font = "Helvetica", accent, includeAiSummary = true } = {},
) {
  const chosenAccent = accent || ACCENT_BY_TEMPLATE[template] || "#7C3AED";
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: { Title: resume.name || "Resume" },
  });

  const baseFont = ["Helvetica", "Times-Roman", "Courier"].includes(font)
    ? font
    : "Helvetica";
  const bold = `${baseFont}-Bold`;

  // Header
  doc.font(bold).fontSize(24).fillColor("#0F172A").text(profile?.fullName || resume.name);
  if (profile?.jobTitle || profile?.targetRole) {
    doc
      .moveDown(0.2)
      .font(baseFont)
      .fontSize(11)
      .fillColor(chosenAccent)
      .text(profile?.targetRole || profile?.jobTitle);
  }
  doc.moveDown(0.8);
  doc.strokeColor(chosenAccent).lineWidth(1).moveTo(56, doc.y).lineTo(539, doc.y).stroke();
  doc.moveDown(0.6);

  const section = (title, body) => {
    if (!body || !body.trim()) return;
    doc.font(bold).fontSize(12).fillColor(chosenAccent).text(title.toUpperCase());
    doc.moveDown(0.25);
    doc.font(baseFont).fontSize(10.5).fillColor("#111827");
    const lines = body.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      if (/^[-•*]/.test(line.trim())) {
        doc.text(line.replace(/^[-•*]\s*/, "• "), { indent: 10 });
      } else {
        doc.text(line);
      }
    }
    doc.moveDown(0.6);
  };

  if (includeAiSummary && resume.sections.summary) {
    section("Summary", resume.sections.summary);
  }
  section("Experience", resume.sections.experience);
  section("Skills", resume.sections.skills);
  section("Education", resume.sections.education);

  doc.end();
  return doc;
}
