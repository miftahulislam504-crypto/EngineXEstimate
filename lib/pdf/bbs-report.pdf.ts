// lib/pdf/bbs-report.pdf.ts
//
// Module 13 — BBS (Bar Bending Schedule) PDF export। Module 7-এর
// calculateBBSRows() পুনর্ব্যবহার করা হয়েছে (BBSTable.tsx UI যা
// দেখায়, এই PDF-এও ঠিক সেই calculated column-গুলো)। diameter-ভিত্তিক
// breakdown-ও যোগ করা হয়েছে (summarizeBBSByDiameter — Module 8
// Procurement-এ যেটা ইতিমধ্যে ব্যবহৃত হচ্ছে, রিপোর্টেও একই ব্রেকডাউন
// দেখানো সংগত)।
//
// ── Phase 4 আপগ্রেড ──────────────────────────────────────────────
// cover page, diameter breakdown এখন pie chart সহ, member-wise
// (footing/column/beam/slab/stair) breakdown নতুন যোগ হয়েছে
// (summarizeBBSByMember — reinforcement.service.ts-এ
// summarizeBBSByDiameter-এর পাশে নতুন export, একই প্যাটার্নে), এবং
// warnings এখন styled warning callout box-এ (আগে plain রঙিন টেক্সট)।
//
// ── Phase 5 রিফ্যাক্টর ───────────────────────────────────────────
// body-drawing লজিক drawBBSReportBody()-এ বের করা হয়েছে, যাতে
// master-report.pdf.ts এটা নিজের multi-section doc-এ reuse করতে
// পারে। ⚠️ এই report landscape (column-ভারী table বলে), বাকি সব
// report portrait — তাই master-report.pdf.ts-কে page-level
// orientation switch করতে হয় এই section-এ ঢোকা ও বের হওয়ার সময়
// (jsPDF-এ addPage(format, orientation) প্রতি-পাতা orientation
// সাপোর্ট করে বলে সম্ভব)। এই ফাইলে caller-কে boundary-তে orientation
// সামলাতে হবে বলে ধরে নেওয়া হয়েছে — drawBBSReportBody() নিজে থেকে
// কোনো addPage('a4', 'landscape') কল করবে না প্রথম পাতায়, কিন্তু
// এর ভেতরের দ্বিতীয় পাতা-বিভাজন (schedule table বড় বলে) এখনো
// landscape-ই বহাল রাখে, কারণ সেটা caller-এর orientation switch-এর
// পরের ধাপ।

import jsPDF from 'jspdf'
import { BBSReportContext } from '@/lib/services/reports.service'
import { calculateBBSRows, summarizeBBSByDiameter, summarizeBBSByMember } from '@/lib/services/reinforcement.service'
import {
  drawSidebar,
  drawPdfFooter,
  drawCoverPage,
  drawPdfTable,
  drawSectionTitle,
  drawSummaryLine,
  drawCalloutBox,
  renderPieChartImage,
  addChartImage,
  downloadPdf,
  buildReportFilename,
  formatQty,
  sidebarRightMargin,
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

/**
 * BBS section-এর মূল কন্টেন্ট আঁকে। startY-তে caller ইতিমধ্যে একটা
 * landscape পাতায় drawPdfHeader() কল করে থাকবে বলে ধরে নেওয়া
 * হয়েছে। এই ফাংশনের ভেতরের doc.addPage() কলগুলো সব ('a4','landscape')
 * সহ, তাই caller-এর orientation বজায় থাকে যতক্ষণ caller নিজে থেকে
 * অন্য orientation-এ switch না করে।
 */
export function drawBBSReportBody(doc: jsPDF, context: BBSReportContext, startY: number, reportMeta: PdfReportMeta): number {
  let y = startY

  if (context.rows.length === 0) {
    doc.setFontSize(10)
    doc.text('No BBS rows found for this project yet.', 14, y)
    return y + 8
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

  y = drawSummaryLine(doc, 'Total Reinforcement Weight', `${formatQty(context.totalWeightKg, 1)} kg`, y, reportMeta)
  y += 4

  // ── Diameter breakdown — pie chart ──
  const byDiameter = summarizeBBSByDiameter(calculated)
  const diameters = Object.keys(byDiameter).map(Number).sort((a, b) => a - b)
  const byMember = summarizeBBSByMember(calculated)
  const members = Object.keys(byMember)

  if (diameters.length > 1) {
    y = drawSectionTitle(doc, 'Weight Breakdown by Diameter', y, reportMeta)
    const diaChartData = diameters.map((d) => ({ label: `${d}mm`, value: byDiameter[d] }))
    const diaDataUrl = renderPieChartImage(diaChartData, {
      valueFormatter: (v) => `${formatQty(v, 1)} kg`,
      widthPx: 620,
      heightPx: 300,
    })
    y = addChartImage(doc, diaDataUrl, y, { widthMm: 120, aspectRatio: 620 / 300 })
  }

  // ── Member-wise breakdown table (footing/column/beam/slab/stair) ──
  if (members.length > 0) {
    y = drawSectionTitle(doc, 'Weight Breakdown by Member', y, reportMeta)
    const memberHead = [['Member', 'Total Weight (kg)']]
    const memberBody = members
      .sort((a, b) => byMember[b] - byMember[a])
      .map((m) => [MEMBER_LABELS[m] ?? m, formatQty(byMember[m])])
    y = drawPdfTable(doc, y, memberHead, memberBody, {
      columnStyles: { 0: { cellWidth: 40 }, 1: { halign: 'right' } },
      rightMargin: sidebarRightMargin(doc),
    })
  }

  doc.addPage('a4', 'landscape')
  y = drawSidebar(doc, reportMeta, { sheetNumber: 'BBS-2', sheetTitle: 'Bar Bending Schedule' })
  y = drawSectionTitle(doc, 'Bar Bending Schedule', y, reportMeta)

  const head = [
    ['Bar Mark', 'Member', 'Dia (mm)', 'Shape', 'Cutting Len (m)', 'Nos', 'Total Len (m)', 'Unit Wt (kg/m)', 'Wastage %', 'Total Wt (kg)'],
  ]
  const body = calculated.map((row) => [
    row.barMark,
    MEMBER_LABELS[row.member] ?? row.member,
    String(row.diameterMm),
    SHAPE_LABELS[row.shape] ?? row.shape,
    formatQty(row.cuttingLengthM),
    String(row.numberOfBars),
    formatQty(row.totalLengthM),
    formatQty(row.effectiveUnitWeightKgPerM, 3),
    formatQty(row.wastagePercent, 1),
    formatQty(row.totalWeightKg),
  ])

  y = drawPdfTable(doc, y, head, body, { columnStyles: { 9: { halign: 'right' } }, rightMargin: sidebarRightMargin(doc) })

  if (diameters.length > 0) {
    y = drawSectionTitle(doc, 'Weight Breakdown by Diameter', y, reportMeta)
    const diaHead = [['Diameter (mm)', 'Total Weight (kg)']]
    const diaBody = diameters.map((d) => [`${d}mm`, formatQty(byDiameter[d])])
    y = drawPdfTable(doc, y, diaHead, diaBody, { columnStyles: { 0: { cellWidth: 40 } }, rightMargin: sidebarRightMargin(doc) })
  }

  if (warnings.length > 0) {
    y = drawCalloutBox(doc, ['Warnings:', ...warnings.map((w) => `-  ${w}`)], y, 'warning', reportMeta)
  }

  return y
}

export function generateBBSReportPdf(context: BBSReportContext, meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' })
  const reportMeta: PdfReportMeta = { ...meta, reportTitle: 'Bar Bending Schedule (BBS)', reportKind: 'BBS_Report' }

  if (context.rows.length === 0) {
    const y = drawSidebar(doc, reportMeta, { sheetNumber: 'BBS-1', sheetTitle: reportMeta.reportTitle })
    drawBBSReportBody(doc, context, y, reportMeta)
    drawPdfFooter(doc, { reportMeta })
    return doc
  }

  const { calculated } = calculateBBSRows(context.rows)
  drawCoverPage(doc, reportMeta, {
    subtitle: `${calculated.length} bar mark${calculated.length === 1 ? '' : 's'} — ${formatQty(context.totalWeightKg, 1)} kg total`,
  })

  doc.addPage('a4', 'landscape')
  const y = drawSidebar(doc, reportMeta, { sheetNumber: 'BBS-1', sheetTitle: reportMeta.reportTitle })
  drawBBSReportBody(doc, context, y, reportMeta)

  drawPdfFooter(doc, { startPage: 2, reportMeta })
  return doc
}

export function downloadBBSReportPdf(context: BBSReportContext, meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>): void {
  const doc = generateBBSReportPdf(context, meta)
  downloadPdf(doc, buildReportFilename('BBS_Report', meta.projectName, meta.generatedAt))
}
