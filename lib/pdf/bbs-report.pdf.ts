// lib/pdf/bbs-report.pdf.ts
//
// Module 13 — BBS (Bar Bending Schedule) PDF export। Module 7-এর
// calculateBBSRows() পুনর্ব্যবহার করা হয়েছে (BBSTable.tsx UI যা
// দেখায়, এই PDF-এও ঠিক সেই calculated column-গুলো)। diameter-ভিত্তিক
// breakdown-ও যোগ করা হয়েছে (summarizeBBSByDiameter — Module 8
// Procurement-এ যেটা ইতিমধ্যে ব্যবহৃত হচ্ছে, রিপোর্টেও একই ব্রেকডাউন
// দেখানো সংগত)।

import jsPDF from 'jspdf'
import { BBSReportContext } from '@/lib/services/reports.service'
import { calculateBBSRows, summarizeBBSByDiameter } from '@/lib/services/reinforcement.service'
import {
  drawPdfHeader,
  drawPdfFooter,
  drawPdfTable,
  drawSectionTitle,
  drawSummaryLine,
  downloadPdf,
  PdfReportMeta,
} from '@/lib/pdf/pdf-shared'

const SHAPE_LABELS: Record<string, string> = {
  straight: 'Straight',
  l_hook: 'L-Hook',
  u_hook: 'U-Hook',
  stirrup: 'Stirrup',
  cranked: 'Cranked',
}

const MEMBER_LABELS: Record<string, string> = {
  footing: 'Footing',
  column: 'Column',
  beam: 'Beam',
  slab: 'Slab',
  stair: 'Stair',
}

export function generateBBSReportPdf(context: BBSReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' })
  let y = drawPdfHeader(doc, { ...meta, reportTitle: 'Bar Bending Schedule (BBS)' })

  if (context.rows.length === 0) {
    doc.setFontSize(10)
    doc.text('No BBS rows found for this project yet.', 14, y)
    drawPdfFooter(doc)
    return doc
  }

  // calculateBBSRows()-এর warnings বাংলায় লেখা (reinforcement.service.ts
  // দ্রষ্টব্য) — jsPDF-এর built-in font বাংলা glyph render করতে পারে
  // না (pdf-shared.ts-এর উপরের নোট দেখুন), তাই সেই স্ট্রিং সরাসরি PDF-এ
  // না বসিয়ে একই শর্ত (effectiveUnitWeightKgPerM === 0) থেকে একটা
  // ইংরেজি-নিরাপদ সংস্করণ এখানে আলাদাভাবে তৈরি করা হচ্ছে।
  const { calculated } = calculateBBSRows(context.rows)
  const warnings = calculated
    .filter((row) => row.effectiveUnitWeightKgPerM === 0)
    .map((row) => `"${row.barMark}" (${row.diameterMm}mm) — no standard unit weight found; treated as 0 kg/m.`)

  y = drawSummaryLine(doc, 'Total Reinforcement Weight', `${context.totalWeightKg.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`, y)
  y += 4

  const head = [
    ['Bar Mark', 'Member', 'Dia (mm)', 'Shape', 'Cutting Len (m)', 'Nos', 'Total Len (m)', 'Unit Wt (kg/m)', 'Wastage %', 'Total Wt (kg)'],
  ]
  const body = calculated.map((row) => [
    row.barMark,
    MEMBER_LABELS[row.member] ?? row.member,
    String(row.diameterMm),
    SHAPE_LABELS[row.shape] ?? row.shape,
    row.cuttingLengthM.toFixed(2),
    String(row.numberOfBars),
    row.totalLengthM.toFixed(2),
    row.effectiveUnitWeightKgPerM.toFixed(3),
    row.wastagePercent.toFixed(1),
    row.totalWeightKg.toFixed(2),
  ])

  y = drawPdfTable(doc, y, head, body, { columnStyles: { 9: { halign: 'right' } } })

  const byDiameter = summarizeBBSByDiameter(calculated)
  const diameters = Object.keys(byDiameter).map(Number).sort((a, b) => a - b)
  if (diameters.length > 0) {
    y = drawSectionTitle(doc, 'Weight Breakdown by Diameter', y)
    const diaHead = [['Diameter (mm)', 'Total Weight (kg)']]
    const diaBody = diameters.map((d) => [`${d}mm`, byDiameter[d].toFixed(2)])
    y = drawPdfTable(doc, y, diaHead, diaBody, { columnStyles: { 0: { cellWidth: 40 } } })
  }

  if (warnings.length > 0) {
    doc.setFontSize(9)
    doc.setTextColor(180, 60, 20)
    doc.text('Warnings:', 14, y)
    y += 5
    warnings.forEach((w) => {
      doc.text(`- ${w}`, 18, y)
      y += 4.5
    })
  }

  drawPdfFooter(doc)
  return doc
}

export function downloadBBSReportPdf(context: BBSReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): void {
  const doc = generateBBSReportPdf(context, meta)
  downloadPdf(doc, `BBS_Report_${meta.projectName.replace(/\s+/g, '_')}.pdf`)
}
