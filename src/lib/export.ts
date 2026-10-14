export type Row = Record<string, string | number>;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV(rows: Row[], filename: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
  download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

/** jsPDF is loaded on demand: it is only needed when someone clicks "PDF". */
export async function exportPDF(rows: Row[], filename: string, title: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const W = doc.internal.pageSize.getWidth();
  const colW = (W - 80) / Math.max(1, cols.length);
  let y = 50;
  doc.setFontSize(16).setFont("helvetica", "bold").text(title, 40, y);
  doc.setFontSize(9).setFont("helvetica", "normal").text(`SmartU Transport · generated ${new Date().toLocaleString()}`, 40, (y += 16));
  y += 22;
  const header = () => {
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.setFillColor(29, 78, 216).rect(40, y - 12, W - 80, 20, "F").setTextColor(255);
    cols.forEach((c, i) => doc.text(c, 46 + i * colW, y + 2, { maxWidth: colW - 8 }));
    doc.setTextColor(20).setFont("helvetica", "normal");
    y += 22;
  };
  header();
  rows.forEach((r, ri) => {
    if (y > 540) {
      doc.addPage();
      y = 50;
      header();
    }
    if (ri % 2) doc.setFillColor(243, 245, 249).rect(40, y - 11, W - 80, 18, "F");
    cols.forEach((c, i) => doc.text(String(r[c] ?? ""), 46 + i * colW, y + 1, { maxWidth: colW - 8 }));
    y += 18;
  });
  doc.save(`${filename}.pdf`);
}
