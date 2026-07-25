/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/**
 * Export table data to an Excel file (.xlsx)
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  sheetName: string = "Rapport",
) {
  if (!data || data.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto-fit column widths
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch:
      Math.max(
        key.length,
        ...data.map((row) => String((row as Record<string, unknown>)[key] ?? "").length),
      ) + 3,
  }));
  worksheet["!cols"] = colWidths;

  const validFilename = filename.endsWith(".xlsx")
    ? filename
    : `${filename}.xlsx`;
  XLSX.writeFile(workbook, validFilename);
}

/**
 * Export table data to a styled PDF file (.pdf)
 */
export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  subtitle?: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("HÔTEL MAKARIM ****", 14, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title.toUpperCase(), 14, 20);

  if (subtitle) {
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(8);
    doc.text(subtitle, 14, 25);
  }

  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFontSize(8);
  doc.text(
    `Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`,
    200,
    12,
    { align: "right" },
  );

  // Table Generation using autoTable
  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    margin: { top: 32, right: 14, bottom: 20, left: 14 },
    didDrawPage: (data) => {
      // Footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} sur ${pageCount} — Document Officiel Hôtel Makarim`,
        105,
        287,
        { align: "center" },
      );
    },
  });

  const validFilename = filename.endsWith(".pdf")
    ? filename
    : `${filename}.pdf`;
  doc.save(validFilename);
}
