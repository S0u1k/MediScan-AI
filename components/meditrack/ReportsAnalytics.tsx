"use client";

import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { Activity, BarChart3, CheckCircle2, Download, Droplets, FileText, Pill, Sparkles } from "lucide-react";
import { storageService } from "@/lib/storage";
import { BarChart, GlassButton, GlassCard, SectionTitle, StatTile } from "./ui";

export function ReportsAnalytics() {
  const [medicineStats, setMedicineStats] = useState({ taken: 0, total: 0, percentage: 0 });
  const [weeklyWater, setWeeklyWater] = useState<{ day: string; amount: number; goal: number }[]>([]);
  const [bmiRecords, setBmiRecords] = useState<{ date: string; bmi: number }[]>([]);
  const [prescriptionCount, setPrescriptionCount] = useState(0);

  useEffect(() => {
    setMedicineStats(storageService.getMedicationAdherenceStats());
    setWeeklyWater(storageService.getWeeklyWaterStats());
    setBmiRecords(storageService.getBMIRecords());
    setPrescriptionCount(storageService.getPrescriptions().length);
  }, []);

  const weeklyAdherence = [
    { day: "Mon", rate: 100 },
    { day: "Tue", rate: 80 },
    { day: "Wed", rate: 100 },
    { day: "Thu", rate: 60 },
    { day: "Fri", rate: 100 },
    { day: "Sat", rate: 90 },
    { day: "Sun", rate: medicineStats.percentage },
  ];

  const avgAdherence = Math.round(weeklyAdherence.reduce((s, d) => s + d.rate, 0) / weeklyAdherence.length);
  const avgWater =
    weeklyWater.length > 0 ? Math.round(weeklyWater.reduce((s, d) => s + d.amount, 0) / weeklyWater.length) : 0;

  const healthScore = Math.round(
    avgAdherence * 0.4 +
      Math.min((avgWater / 2500) * 100, 100) * 0.3 +
      (bmiRecords.length > 0 && bmiRecords[0].bmi >= 18.5 && bmiRecords[0].bmi < 25 ? 100 : 70) * 0.3
  );

  const circumference = 2 * Math.PI * 70;

  const generateReport = () => {
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

  const downloadSummary = () => {
    const profile = storageService.getUserProfile();
    const summaryText = `MediScan Health Summary\n\n` +
      `Name: ${profile?.name ?? "Guest User"}\n` +
      `Email: ${profile?.email ?? "None"}\n` +
      `\nHealth Score: ${healthScore}%\n` +
      `Medication adherence: ${avgAdherence}%\n` +
      `Average hydration: ${avgWater} ml/day\n` +
      `BMI records: ${bmiRecords.length}\n` +
      `\nTop insights:\n` +
      `- ${healthScore >= 85 ? "Excellent wellness habits." : healthScore >= 70 ? "Good progress, keep improving." : "More consistency needed for medications and hydration."}\n` +
      `- ${Math.round(Math.min((avgWater / 2500) * 100, 100)) >= 80 ? "Hydration is on track." : "Try to drink more water each day."}\n` +
      `- ${bmiRecords.length > 0 ? `Latest BMI: ${bmiRecords[0].bmi}` : "No BMI data available."}\n` +
      `\nGenerated by MediScan AI on ${new Date().toLocaleDateString()}.`;

    const blob = new Blob([summaryText], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mediscan-summary-${new Date().toISOString().split("T")[0]}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const breakdown = [
    { label: "Medication Adherence", value: avgAdherence, Icon: Pill },
    { label: "Hydration Level", value: Math.round(Math.min((avgWater / 2500) * 100, 100)), Icon: Droplets },
    {
      label: "BMI Health",
      value: bmiRecords.length > 0 ? (bmiRecords[0].bmi >= 18.5 && bmiRecords[0].bmi < 25 ? 100 : 70) : 0,
      Icon: Activity,
    },
  ];

  return (
    <div className="space-y-6 bg-slate-950/10 p-4 rounded-[28px]">
      <GlassCard className="bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(20,184,166,0.14),_transparent_20%),bg-white/5 shadow-2xl border border-white/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-teal-200">
              <Sparkles className="h-3.5 w-3.5" /> New
            </div>
            <h2 className="text-2xl font-semibold text-white">Health Reports &amp; Analytics</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Generate a polished PDF report with website-inspired styling, track your progress, and download a quick summary instantly.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <GlassButton onClick={generateReport} className="bg-teal-500/15 text-white hover:bg-teal-500/20">
                <Download className="h-4 w-4" /> Download PDF
              </GlassButton>
              <GlassButton onClick={downloadSummary} className="bg-white/10 text-white hover:bg-white/15">
                <FileText className="h-4 w-4" /> Download Summary
              </GlassButton>
            </div>
          </div>
          <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
            {[
              "Website-style report background",
              "AI-driven health score",
              "Hydration & BMI insights",
              "Quick summary export",
            ].map((feature) => (
              <div key={feature} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-1 hover:bg-white/10 hover:shadow-2xl">
                <span className="block text-sm font-medium text-white">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-col items-center gap-8 md:flex-row">
          <div className="relative h-40 w-40">
            <svg className="h-full w-full -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - healthScore / 100)}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-4xl font-medium text-white">{healthScore}</p>
              <p className="text-sm text-white/50">Health Score</p>
            </div>
          </div>

          <div className="w-full flex-1">
            <h3 className="mb-4 font-medium text-white">Score Breakdown</h3>
            <div className="space-y-3">
              {breakdown.map(({ label, value, Icon }) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-white/60">
                      <Icon className="h-4 w-4" /> {label}
                    </span>
                    <span className="font-medium text-white">{value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white/70 transition-all duration-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle icon={<Pill className="h-5 w-5 text-white" strokeWidth={1.5} />}>
            Weekly Medication Adherence
          </SectionTitle>
          <div className="mt-4">
            <BarChart
              data={weeklyAdherence.map((d) => ({ label: d.day, value: d.rate, max: 100 }))}
              unitDivisor={1}
              unitSuffix="%"
            />
          </div>
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<Droplets className="h-5 w-5 text-white" strokeWidth={1.5} />}>
            Weekly Hydration
          </SectionTitle>
          <div className="mt-4">
            <BarChart
              data={weeklyWater.map((d) => ({ label: d.day, value: d.amount, max: d.goal }))}
              unitDivisor={1000}
              unitSuffix="L"
            />
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Medicines" value={medicineStats.total} icon={<Pill className="h-5 w-5 text-white" strokeWidth={1.5} />} />
        <StatTile label="Prescriptions" value={prescriptionCount} icon={<FileText className="h-5 w-5 text-white" strokeWidth={1.5} />} />
        <StatTile label="Avg. Water" value={`${(avgWater / 1000).toFixed(1)}L`} icon={<Droplets className="h-5 w-5 text-white" strokeWidth={1.5} />} />
        <StatTile label="BMI Records" value={bmiRecords.length} icon={<CheckCircle2 className="h-5 w-5 text-white" strokeWidth={1.5} />} />
      </div>
    </div>
  );
}
