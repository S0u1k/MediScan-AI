from pathlib import Path

path = Path(r"d:\Grand coder\Final\Medi\Medi\components\meditrack\ReportsAnalytics.tsx")
text = path.read_text(encoding='utf-8')
start = "  const generateReport = () => {\n"
end = "\n  const downloadSummary = () => {\n"
idx = text.find(start)
jdx = text.find(end, idx + len(start))
if idx == -1 or jdx == -1:
    raise RuntimeError(f"markers not found idx={idx} jdx={jdx}")
new_function = '''  const generateReport = () => {
    const profile = storageService.getUserProfile();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const leftPanelWidth = 190;
    const midGap = 16;
    const rightPanelWidth = contentWidth - leftPanelWidth - midGap;

    const drawBackground = () => {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      doc.setFillColor(237, 245, 255);
      doc.circle(pageWidth - 90, 110, 100, "F");
      doc.setFillColor(209, 250, 242);
      doc.circle(100, pageHeight - 130, 80, "F");
    };

    const drawHeader = () => {
      drawBackground();
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(margin, 34, 68, 68, 16, 16, "F");
      doc.setFillColor(20, 184, 166);
      doc.roundedRect(margin + 14, 48, 40, 40, 12, 12, "F");
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(3);
      doc.line(margin + 22, 74, margin + 30, 62);
      doc.line(margin + 30, 62, margin + 38, 70);
      doc.line(margin + 38, 70, margin + 46, 56);
      doc.line(margin + 46, 56, margin + 54, 68);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("MediScan AI", margin + 86, 66);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Smart Clinical Intelligence", margin + 86, 82);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(32);
      doc.setTextColor(15, 23, 42);
      doc.text("PRESCRIPTION", margin, 146);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Smart Clinical Intelligence & Prescription Management", margin, 162);

      doc.setFillColor(20, 184, 166);
      doc.roundedRect(pageWidth - margin - 98, 112, 98, 72, 16, 16, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.text("Rx", pageWidth - margin - 49, 156, { align: "center", baseline: "middle" });
    };

    const drawDoctorDetails = () => {
      const top = 180;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, top, contentWidth, 70, 16, 16, "FD");

      const fields = [
        { label: "Doctor Name", value: "Dr. Priya Sharma" },
        { label: "Registration Number", value: "MED-879012" },
        { label: "Clinic / Hospital", value: "MediScan Health Center" },
        { label: "Contact", value: "+91 98765 43210" },
        { label: "Date", value: new Date().toLocaleDateString() },
      ];

      const fieldWidth = (contentWidth - 40) / 5;
      fields.forEach((field, index) => {
        const x = margin + 20 + index * fieldWidth;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(field.label, x, top + 20);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(field.value, x, top + 36);
      });
    };

    const drawSidebar = () => {
      const top = 266;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, top, leftPanelWidth, 473, 20, 20, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("AI Clinical Summary", margin + 18, top + 28);

      let itemTop = top + 48;
      const cardHeight = 84;
      const summaryCards = [
        { title: "Overall Health Score", value: "51 / 100", badge: "FAIR", note: "" },
        { title: "Medication Compliance", value: "76%", badge: "", note: "Recommended adherence is 85% or higher." },
        { title: "Hydration Status", value: "0%", badge: "Needs Improvement", note: "Daily Goal: 2500 ml" },
        { title: "BMI Status", value: "N/A", badge: "", note: "No recent BMI data available" },
      ];

      summaryCards.forEach((card) => {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin + 14, itemTop, leftPanelWidth - 28, cardHeight, 14, 14, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(card.title, margin + 24, itemTop + 22);
        doc.setFontSize(18);
        doc.setTextColor(37, 99, 235);
        doc.text(card.value, margin + 24, itemTop + 46);
        if (card.badge) {
          doc.setFillColor(20, 184, 166);
          doc.roundedRect(margin + 24, itemTop + 54, 84, 18, 10, 10, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(255, 255, 255);
          doc.text(card.badge, margin + 66, itemTop + 66, { align: "center" });
        }
        if (card.note) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(card.note, margin + 24, itemTop + 78, { maxWidth: leftPanelWidth - 56 });
        }
        itemTop += cardHeight + 10;
      });

      const detailsTop = itemTop + 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Report ID:", margin + 24, detailsTop);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("MS-838340", margin + 24, detailsTop + 16);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin + 24, detailsTop + 32);
      doc.text(`Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, margin + 24, detailsTop + 48);

      const qrTop = detailsTop + 72;
      doc.setFillColor(246, 252, 255);
      doc.roundedRect(margin + 24, qrTop, leftPanelWidth - 48, 102, 14, 14, "FD");
      doc.setFillColor(15, 23, 42);
      doc.rect(margin + 36, qrTop + 18, 68, 68, "F");
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          if ((row + col) % 2 === 0) {
            doc.setFillColor(255, 255, 255);
            doc.rect(margin + 36 + col * 16, qrTop + 18 + row * 16, 14, 14, "F");
          }
        }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Verified Report", margin + leftPanelWidth / 2, qrTop + 96, { align: "center" });
    };

    const drawPatientCard = () => {
      const top = 266;
      const startX = margin + leftPanelWidth + midGap;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(startX, top, rightPanelWidth, 220, 20, 20, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Patient Information", startX + 18, top + 28);

      const patientFields = [
        { label: "Patient Name", value: profile?.name ?? "N/A" },
        { label: "Patient ID", value: "PT-293874" },
        { label: "Age / Gender", value: "29 / Female" },
        { label: "Weight", value: "72 kg" },
        { label: "Blood Group", value: "B+" },
        { label: "Contact", value: "+91 91234 56789" },
      ];

      let infoY = top + 48;
      patientFields.forEach((field, index) => {
        const x = startX + 18 + (index % 2) * ((rightPanelWidth - 48) / 2 + 14);
        if (index > 0 && index % 2 === 0) infoY += 38;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(field.label, x, infoY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(field.value, x, infoY + 14);
      });

      const addressY = top + 164;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Address", startX + 18, addressY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(
        "123 Wellness Avenue, Sector 8, Bangalore, India",
        startX + 18,
        addressY + 14,
        { maxWidth: rightPanelWidth - 56 }
      );
    };

    const drawDiagnosis = () => {
      const top = 500;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, top, contentWidth, 106, 20, 20, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Clinical Diagnosis", margin + 18, top + 28);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Patient presents with moderate fatigue, mild dehydration, and medication adherence below target. Recommend ongoing monitoring of vitals, fluid intake, and a follow-up visit.",
        margin + 18,
        top + 46,
        { maxWidth: contentWidth - 48 }
      );
    };

    const drawPrescriptionTable = () => {
      const top = 620;
      const startX = margin;
      const tableWidth = contentWidth;
      const rowHeight = 28;
      const headers = ["No.", "Medication", "Dose", "Duration", "Instructions"];
      const widths = [30, 180, 90, 90, tableWidth - 30 - 180 - 90 - 90 - 24];

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(startX, top, tableWidth, rowHeight * 6 + 24, 20, 20, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Prescription", startX + 18, top + 24);

      let rowY = top + 40;
      doc.setDrawColor(226, 232, 240);
      let colX = startX + 14;
      headers.forEach((header, index) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(header, colX + 4, rowY + 14);
        colX += widths[index] + 2;
      });

      rowY += rowHeight;
      for (let i = 1; i <= 5; i += 1) {
        let cellX = startX + 14;
        widths.forEach((width) => {
          doc.setDrawColor(226, 232, 240);
          doc.line(cellX, rowY, cellX + width, rowY);
          cellX += width + 2;
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`${i}.`, startX + 18, rowY + 18);
        rowY += rowHeight;
      }
    };

    const drawRecommendations = () => {
      const top = 796;
      const leftWidth = (contentWidth - 18) / 2;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, top, leftWidth, 140, 20, 20, "FD");
      doc.roundedRect(margin + leftWidth + 18, top, leftWidth, 140, 20, 20, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Lifestyle Recommendations", margin + 18, top + 28);

      const recommendations = [
        "Drink 2.5L water daily",
        "Follow medication schedule",
        "Maintain healthy BMI",
        "Regular exercise",
        "Follow-up consultation",
      ];
      let recY = top + 48;
      recommendations.forEach((text) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(16, 185, 129);
        doc.text("✔", margin + 18, recY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(text, margin + 34, recY);
        recY += 20;
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Follow-up", margin + leftWidth + 36, top + 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Next Visit Date: ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}`, margin + leftWidth + 36, top + 52);
      doc.text("Additional Notes:", margin + leftWidth + 36, top + 74);
      doc.text(
        "Continue therapy review in 2 weeks and monitor medication adherence.",
        margin + leftWidth + 36,
        top + 92,
        { maxWidth: leftWidth - 54 }
      );
    };

    const drawFooter = () => {
      const top = pageHeight - 100;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.line(margin, top, pageWidth - margin, top);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("Doctor Signature", margin + 18, top + 22);
      doc.text("Digital Signature", margin + 300, top + 22);
      doc.line(margin + 18, top + 28, margin + 180, top + 28);
      doc.line(margin + 300, top + 28, margin + 462, top + 28);

      doc.setFillColor(37, 99, 235);
      doc.circle(pageWidth - margin - 80, top + 24, 28, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("Verified", pageWidth - margin - 80, top + 18, { align: "center" });
      doc.text("Report", pageWidth - margin - 80, top + 26, { align: "center" });

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      const disclaimerText = doc.splitTextToSize(
        "Disclaimer: This report is generated by MediScan AI based on tracked health indicators. It is for informational and educational purposes only and does not substitute for certified clinical advice.",
        contentWidth - 120
      );
      doc.text(disclaimerText, margin + 18, top + 48);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(20, 24, 82);
      doc.text("MediScan AI – Empowering Smarter Healthcare Decisions", pageWidth / 2, pageHeight - 18, {
        align: "center",
      });
    };

    drawHeader();
    drawDoctorDetails();
    drawSidebar();
    drawPatientCard();
    drawDiagnosis();
    drawPrescriptionTable();
    drawRecommendations();
    drawFooter();

    doc.save(`mediscan-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };
'''
text = text[:idx] + new_function + text[jdx:]
path.write_text(text, encoding='utf-8')
print('done')
