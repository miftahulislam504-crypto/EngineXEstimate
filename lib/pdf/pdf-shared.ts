// lib/pdf/pdf-shared.ts
//
// প্রতিটা report builder (boq/quantity/cost/material/bbs/tender)
// একই header/footer/table-style ব্যবহার করে, যাতে ৬টা PDF দেখতে
// একই পরিবারের document মনে হয় — আলাদা আলাদা component ৬ বার
// একই layout code লেখার বদলে এই একটা shared module।
//
// jsPDF + jspdf-autotable ব্যবহার করা হয়েছে (Reports & Export app-এ
// যা ব্যবহৃত হয়েছিল তার সাথে সামঞ্জস্যপূর্ণ পছন্দ), কারণ এটা pure
// client-side (কোনো server/Cloud Function লাগে না) এবং React-এর
// বাইরে থেকেও (এই ফাইলের মতো plain .ts module) ব্যবহারযোগ্য।
//
// ⚠️ বাংলা টেক্সট সীমাবদ্ধতা: jsPDF-এর built-in font-এ বাংলা
// ইউনিকোড glyph নেই (Latin-only)। ফলে UI যদি বাংলা mode-এ থাকে,
// তাহলেও এই মুহূর্তে PDF-এর লেবেল/হেডার ইংরেজিতেই থাকছে — bn label
// pass করলে glyph-না-থাকা box/প্রশ্নবোধক চিহ্ন হয়ে যেত, যেটা খালি
// বাক্সের চেয়েও খারাপ (fake output)। data value (নাম, নোট) যদি
// ব্যবহারকারী বাংলায় লেখেন সেগুলোও একই কারণে ঠিকভাবে render হবে না।
// এই সীমাবদ্ধতা প্রতিটা report-এর ভেতরে/UI-তে স্পষ্ট করে জানানো
// আছে (দেখুন ReportsPanel.tsx-এর bengaliPdfLimitationNote)। ভবিষ্যতে
// bn PDF দরকার হলে একটা বাংলা Unicode font (যেমন Noto Sans Bengali)
// jsPDF-এ addFont() দিয়ে embed করতে হবে — এই মুহূর্তে সেই font ফাইল
// bundle-এ নেই বলে করা হয়নি।

import jsPDF from 'jspdf'
import autoTable, { RowInput } from 'jspdf-autotable'

export const PDF_BRAND_COLOR: [number, number, number] = [21, 128, 61] // brand-700-এর কাছাকাছি সবুজ, globals.css টোকেনের সাথে সামঞ্জস্যপূর্ণ
export const PDF_MUTED_COLOR: [number, number, number] = [107, 114, 128]

export interface PdfReportMeta {
  reportTitle: string // ইংরেজিতেই থাকবে, উপরের নোট দেখুন
  projectName: string
  projectCode?: string
  generatedAt: number
}

/**
 * প্রতিটা report PDF-এর প্রথম পাতার উপরে বসানো standard header —
 * app name, report title, project name/code, generated-at timestamp।
 * Returns the Y position where the caller should start drawing body content.
 */
export function drawPdfHeader(doc: jsPDF, meta: PdfReportMeta): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(9)
  doc.setTextColor(...PDF_MUTED_COLOR)
  doc.text('CivilOS Estimating', 14, 12)

  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.text(meta.reportTitle, 14, 22)
  doc.setFont('helvetica', 'normal')

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  const projectLine = meta.projectCode ? `${meta.projectName} (${meta.projectCode})` : meta.projectName
  doc.text(projectLine, 14, 29)

  doc.setFontSize(8)
  doc.setTextColor(...PDF_MUTED_COLOR)
  const generatedLabel = `Generated: ${new Date(meta.generatedAt).toLocaleString('en-US')}`
  doc.text(generatedLabel, pageWidth - 14, 12, { align: 'right' })

  doc.setDrawColor(...PDF_BRAND_COLOR)
  doc.setLineWidth(0.5)
  doc.line(14, 33, pageWidth - 14, 33)

  return 40
}

/**
 * প্রতিটা পাতার নিচে page number — multi-page report-এ (BOQ, BBS
 * বড় হতে পারে) কোন পাতা কততম তা বোঝার জন্য জরুরি।
 */
export function drawPdfFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
    doc.text('CivilOS Estimating — Auto-generated report', 14, pageHeight - 8)
  }
}

/**
 * autoTable-এর জন্য common styling — head সবুজ (brand color),
 * alternate row shading, ছোট font (BOQ/BBS-এর মতো column-ভারী
 * table-এ readability-র জন্য জরুরি)।
 */
export function drawPdfTable(
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: RowInput[],
  options?: { columnStyles?: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }> }
): number {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'striped',
    headStyles: { fillColor: PDF_BRAND_COLOR, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: 30 },
    alternateRowStyles: { fillColor: [245, 247, 245] },
    margin: { left: 14, right: 14 },
    columnStyles: options?.columnStyles,
  })
  // jspdf-autotable প্লাগইন doc-এ lastAutoTable attach করে (টাইপ
  // declaration-এ augment করা আছে) — পরবর্তী table/content কোথা
  // থেকে শুরু হবে সেই Y-position এখান থেকে বের করা।
  return doc.lastAutoTable.finalY + 8
}

/**
 * একটা section sub-heading (যেমন "Material Cost", "Comparative
 * Statement") — table-এর আগে দাগ কেটে দেওয়ার জন্য।
 */
export function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(title, 14, y)
  doc.setFont('helvetica', 'normal')
  return y + 6
}

/**
 * একটা key-value সারাংশ লাইন (যেমন "Total Project Cost: ৳12,34,500")
 * — table-এর বাইরে বড় summary number দেখানোর জন্য।
 */
export function drawSummaryLine(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(label, 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(value, 90, y)
  doc.setFont('helvetica', 'normal')
  return y + 6
}

export function formatTaka(amount: number): string {
  // jsPDF-এর built-in font-এ ৳ glyph নেই বলে "Tk" ব্যবহার করা হচ্ছে,
  // ৳ প্রতীক দিলে সেই জায়গায় খালি বক্স/বিকৃত glyph দেখাবে।
  return `Tk ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename)
}
