"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { storageService } from "@/lib/storage";
import { GlassButton, GlassCard } from "./ui";

export function DataExport() {
  const [exporting, setExporting] = useState(false);

  const exportData = () => {
    setExporting(true);
    try {
      const profile = storageService.getUserProfile();
      const medicines = storageService.getMedicines();
      const prescriptions = storageService.getPrescriptions();
      const waterLogs = storageService.getWeeklyWaterStats();
      const bmiRecords = storageService.getBMIRecords();
      const emergencyContacts = storageService.getEmergencyContacts();
      const chatHistory = storageService.getChatHistory();

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 48;
      const contentWidth = pageWidth - margin * 2;
      let y = 0;
      let pageCount = 1;

      // Helper: Draw a beautiful header on each page
      const drawPageHeader = (pageNum: number) => {
        // Slate Header Band
        doc.setFillColor(15, 23, 42); // Slate 900
        doc.rect(0, 0, pageWidth, 80, "F");
        
        doc.setFillColor(13, 148, 136); // Teal 600
        doc.rect(0, 80, pageWidth, 4, "F");

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("MediScan Health Record", margin, 42);
        
        // Subtitle
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text("Comprehensive Health History & Personal Data Export", margin, 62);

        // Page Indicator
        doc.setFontSize(9);
        doc.text(`Page ${pageNum}`, pageWidth - margin, 48, { align: "right" });
      };

      // Helper: Draw page footer
      const drawPageFooter = () => {
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setLineWidth(1);
        doc.line(margin, pageHeight - 60, pageWidth - margin, pageHeight - 60);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text(
          "Personal Records Export. Always consult a certified healthcare professional for medical diagnoses and treatment plans.",
          margin,
          pageHeight - 45
        );
      };

      // Helper: Check space and push page if needed
      const checkSpace = (heightNeeded: number) => {
        if (y + heightNeeded > pageHeight - 75) {
          drawPageFooter();
          doc.addPage();
          pageCount++;
          drawPageHeader(pageCount);
          y = 115;
        }
      };

      // Initialize Page 1
      drawPageHeader(pageCount);
      y = 115;

      // 1. Patient Profile Info Block
      checkSpace(120);
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(1);
      doc.roundedRect(margin, y, contentWidth, 100, 8, 8, "FD");

      // Left column: Profile Details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(profile ? profile.name : "Guest User", margin + 18, y + 26);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(profile ? profile.email : "No email linked", margin + 18, y + 40);

      // Specs
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85); // Slate 700
      let detailsY = y + 60;
      if (profile?.bloodType) {
        doc.text(`Blood Type: ${profile.bloodType}`, margin + 18, detailsY);
        detailsY += 15;
      }
      if (profile?.height && profile?.weight) {
        doc.text(`Height: ${profile.height} cm  |  Weight: ${profile.weight} kg`, margin + 18, detailsY);
      }

      // Right column: Clinical warnings / notes (Allergies & Conditions)
      let rightDetailsY = y + 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      
      if (profile?.allergies?.length) {
        doc.setTextColor(220, 38, 38); // Red 600 for Allergies
        doc.text(`ALLERGIES: ${profile.allergies.join(", ")}`, margin + 260, rightDetailsY);
        rightDetailsY += 18;
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text("ALLERGIES: None Reported", margin + 260, rightDetailsY);
        rightDetailsY += 18;
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      if (profile?.conditions?.length) {
        doc.text(`CONDITIONS: ${profile.conditions.join(", ")}`, margin + 260, rightDetailsY);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text("CONDITIONS: None Reported", margin + 260, rightDetailsY);
      }

      y += 120;

      // Section drawing helper
      const drawSectionHeader = (title: string) => {
        checkSpace(35);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.setTextColor(15, 23, 42); // Slate 900
        doc.text(title, margin, y);
        
        doc.setFillColor(13, 148, 136); // Teal 600
        doc.rect(margin, y + 4, 25, 2, "F");
        
        doc.setDrawColor(241, 245, 249); // Slate 100
        doc.line(margin + 30, y + 5, pageWidth - margin, y + 5);
        y += 22;
      };

      // 2. Medication Reminders Panel
      if (medicines.length > 0) {
        drawSectionHeader("Prescribed Medications & Schedule");
        
        // List items in nice grid format
        medicines.forEach((m) => {
          checkSpace(30);

          // Card row background
          doc.setFillColor(252, 252, 253);
          doc.setDrawColor(241, 245, 249);
          doc.roundedRect(margin, y, contentWidth, 24, 4, 4, "FD");

          // Bullet icon replacement (colored dot)
          doc.setFillColor(13, 148, 136); // Teal
          doc.circle(margin + 12, y + 12, 3, "F");

          // Name and Dosage
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
          doc.text(m.name, margin + 26, y + 15);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          const dosageOffset = doc.getTextWidth(m.name) + 36;
          doc.text(`—  Dosage: ${m.dosage}`, margin + dosageOffset, y + 15);

          // Schedule time
          doc.setFont("helvetica", "bold");
          doc.setTextColor(71, 85, 105);
          doc.text(`Time: ${m.time}`, margin + 270, y + 15);

          // Status Badge (Pill style)
          if (m.taken) {
            // Taken Pill (Green)
            doc.setFillColor(209, 250, 229); // Green 100
            doc.roundedRect(pageWidth - margin - 75, y + 5, 60, 14, 7, 7, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(6, 95, 70); // Green 800
            doc.text("TAKEN", pageWidth - margin - 45, y + 15, { align: "center" });
          } else {
            // Pending Pill (Amber)
            doc.setFillColor(254, 243, 199); // Amber 100
            doc.roundedRect(pageWidth - margin - 75, y + 5, 60, 14, 7, 7, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(146, 64, 14); // Amber 800
            doc.text("PENDING", pageWidth - margin - 45, y + 15, { align: "center" });
          }

          y += 28;
        });
        y += 12;
      }

      // 3. Emergency Contacts
      if (emergencyContacts.length > 0) {
        drawSectionHeader("Emergency Contact Directory");

        emergencyContacts.forEach((c) => {
          checkSpace(35);

          // Box container for each contact
          doc.setFillColor(252, 252, 253);
          doc.setDrawColor(241, 245, 249);
          doc.roundedRect(margin, y, contentWidth, 28, 4, 4, "FD");

          doc.setFillColor(239, 68, 68); // Red accent for emergency contacts
          doc.circle(margin + 12, y + 14, 3, "F");

          // Name & Relation
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
          doc.text(c.name, margin + 26, y + 18);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          const relationshipOffset = doc.getTextWidth(c.name) + 36;
          doc.text(`(${c.relationship})`, margin + relationshipOffset, y + 18);

          // Phone number on the right
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
          doc.text(c.phone, pageWidth - margin - 20, y + 18, { align: "right" });

          y += 32;
        });
        y += 12;
      }

      // 4. BMI History Table
      if (bmiRecords.length > 0) {
        drawSectionHeader("Recent Body Mass Index (BMI) Logs");
        
        // Table Header
        checkSpace(25);
        doc.setFillColor(241, 245, 249); // Slate 100 header
        doc.rect(margin, y, contentWidth, 20, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text("Record Date", margin + 12, y + 14);
        doc.text("Weight", margin + 140, y + 14);
        doc.text("Height", margin + 260, y + 14);
        doc.text("Computed BMI", pageWidth - margin - 20, y + 14, { align: "right" });
        y += 20;

        // Render records (up to 8 for neat formatting)
        bmiRecords.slice(0, 8).forEach((r) => {
          checkSpace(22);
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 20, "F");
          doc.line(margin, y + 20, pageWidth - margin, y + 20); // bottom border row

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          doc.text(r.date, margin + 12, y + 14);
          doc.text(`${r.weight} kg`, margin + 140, y + 14);
          doc.text(`${r.height} cm`, margin + 260, y + 14);
          
          doc.setFont("helvetica", "bold");
          doc.text(String(r.bmi), pageWidth - margin - 20, y + 14, { align: "right" });

          y += 20;
        });
        y += 16;
      }

      // 5. Water Consumption Logs
      if (waterLogs.length > 0) {
        drawSectionHeader("Weekly Hydration Metrics");
        
        // Grid Table Header
        checkSpace(25);
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, contentWidth, 20, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text("Weekday", margin + 12, y + 14);
        doc.text("Amount Drunk (ml)", margin + 180, y + 14);
        doc.text("Hydration Status", pageWidth - margin - 20, y + 14, { align: "right" });
        y += 20;

        waterLogs.forEach((w) => {
          checkSpace(22);
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, y + 20, pageWidth - margin, y + 20);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          doc.text(w.day, margin + 12, y + 14);
          doc.text(`${w.amount} ml  /  ${w.goal} ml`, margin + 180, y + 14);

          // Status calculation
          const hydRate = w.amount / w.goal;
          doc.setFont("helvetica", "bold");
          if (hydRate >= 1.0) {
            doc.setTextColor(16, 185, 129); // Emerald
            doc.text("Goal Met", pageWidth - margin - 20, y + 14, { align: "right" });
          } else if (hydRate >= 0.7) {
            doc.setTextColor(14, 165, 233); // Sky
            doc.text("Optimal", pageWidth - margin - 20, y + 14, { align: "right" });
          } else {
            doc.setTextColor(245, 158, 11); // Amber
            doc.text("Under Hydrated", pageWidth - margin - 20, y + 14, { align: "right" });
          }
          y += 20;
        });
        y += 16;
      }

      // 6. Diagnostics Export Summary
      drawSectionHeader("Clinical Records Summary");
      checkSpace(40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      
      doc.text(`Total Scanned Prescriptions:     ${prescriptions.length} items`, margin + 12, y + 16);
      doc.text(`Total Chat History Interactions:   ${chatHistory.length} prompts recorded`, margin + 12, y + 32);

      // Finalize footer drawing
      drawPageFooter();

      // Download save
      doc.save(`mediscan-health-data-${new Date().toISOString().split("T")[0]}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Export My Health Data</p>
            <p className="text-xs text-white/50">Download all your data as a PDF</p>
          </div>
        </div>
        <GlassButton onClick={exportData} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? "Exporting…" : "Download PDF"}
        </GlassButton>
      </div>
    </GlassCard>
  );
}
