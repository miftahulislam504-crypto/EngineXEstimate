// lib/pdf/boq-report.pdf.ts
//
// Module 13 — BOQ PDF export। Module 3-এর active BOQVersion থেকে
// সরাসরি table বানানো হয় — কোনো নতুন calculation নেই।
//
// ── Phase 3 আপগ্রেড ──────────────────────────────────────────────
// cover page, এবং items-কে দুই section-এ ভাগ: "Auto-generated (RCC)"
// vs "Manual / Custom Items"। এই grouping BOQItem.source ফিল্ডের
// ওপর ভিত্তি করে — Earthwork/Masonry/Finishing-এর মতো true
// category BOQItem টাইপে নেই (boq.types.ts-এর কমেন্ট দেখুন: এই
// মুহূর্তে শুধু RCC auto-generate হয়, বাকি সবই "Custom Item" হিসেবে
// manual, প্রকৃত category-metadata ছাড়া) — তাই source-ভিত্তিক
// grouping-ই একমাত্র grouping যা ডেটাতে সত্যিই আছে, বানানো category
// বসানো হয়নি। এছাড়া version history-র একটা সংক্ষিপ্ত সারণি যোগ
// হয়েছে (context.history আগে থেকেই fetch হতো কিন্তু builder ব্যবহার
// করত না)।
//
// ── Phase 5 রিফ্যাক্টর ───────────────────────────────────────────
// body-drawing লজিক drawBOQReportBody()-এ বের করা হয়েছে (header
// আঁকা পর্যন্ত, cover page/footer বাদে) যাতে master-report.pdf.ts
// এই একই ফাংশন নিজের multi-section doc-এ reuse করতে পারে —
// generateBOQReportPdf() আগের মতোই standalone PDF বানায়, পুরনো
// public API/signature অপরিবর্তিত।

import jsPDF from 'jspdf'
import { BOQReportContext } from '@/lib/services/reports.service'
import { BOQItem, BOQ_UNIT_LABELS } from '@/lib/types/boq.types'
import {
  drawPdfHeader,
  drawPdfFooter,
  drawCoverPage,
  drawPdfTable,
  drawSectionTitle,
  drawSummaryLine,
  drawStatCards,
  downloadPdf,
  buildReportFilename,
  formatQty,
  PdfReportMeta,
  PDF_CHART_PALETTE,
} from '@/lib/pdf/pdf-shared'

function drawItemsTable(doc: jsPDF, y: number, items: BOQItem[]): number {
  const head = [['Item', 'Unit', 'Quantity', 'Floor']]
  const body = items.map((item) => [
    item.itemName,
    BOQ_UNIT_LABELS[item.unit],
    formatQty(item.quantity, 3),
    item.floorId ?? '—',
  ])
  return drawPdfTable(doc, y, head, body, {
    columnStyles: {
      0: { cellWidth: 80 },
      2: { halign: 'right' },
    },
  })
}

/**
 * BOQ section-এর মূল কন্টেন্ট আঁকে — caller (standalone PDF বা
 * Master Report) আগে থেকে drawPdfHeader() কল করে thisY পাস করবে
 * বলে ধরে নেওয়া হয়েছে; caller প্রয়োজনে নতুন পাতা/footer নিজে
 * সামলাবে। কোনো ডেটা না থাকলে একটা "no data" লাইন এঁকে ফিরে আসে।
 */
export function drawBOQReportBody(doc: jsPDF, context: BOQReportContext, startY: number, reportMeta: PdfReportMeta): number {
  let y = startY

  if (!context.version || context.version.items.length === 0) {
    doc.setFontSize(10)
    doc.text('No BOQ items found for this project yet.', 14, y)
    return y + 8
  }

  const autoItems = context.version.items.filter((item) => item.source === 'auto_rcc')
  const manualItems = context.version.items.filter((item) => item.source === 'manual')

  y = drawSectionTitle(doc, 'Overview', y, reportMeta)
  y = drawStatCards(
    doc,
    [
      { label: 'Total Line Items', value: String(context.version.items.length), accent: PDF_CHART_PALETTE[0] },
      { label: 'Auto-generated (RCC)', value: String(autoItems.length), accent: PDF_CHART_PALETTE[1] },
      { label: 'Manual / Custom', value: String(manualItems.length), accent: PDF_CHART_PALETTE[3] },
    ],
    y,
    reportMeta
  )
  y = drawSummaryLine(doc, 'BOQ Version', context.version.versionId, y, reportMeta)
  y += 6

  if (autoItems.length > 0) {
    y = drawSectionTitle(doc, 'Auto-generated Items (RCC — from Quantity Takeoff)', y, reportMeta)
    y = drawItemsTable(doc, y, autoItems)
  }

  if (manualItems.length > 0) {
    // নতুন পাতা — auto items table-এর ঠিক পরপরই দ্বিতীয় বড় table
    // শুরু হলে page-break-এর মাঝে কাটা পড়ার ঝুঁকি বেশি
    doc.addPage()
    y = drawPdfHeader(doc, reportMeta)
    y = drawSectionTitle(doc, 'Manual / Custom Items', y, reportMeta)
    y = drawItemsTable(doc, y, manualItems)
  }

  // ── Version history (context.history আগে থেকেই fetch হতো, শুধু
  // builder এতদিন ব্যবহার করত না) ──
  if (context.history.length > 1) {
    doc.addPage()
    y = drawPdfHeader(doc, reportMeta)
    y = drawSectionTitle(doc, 'Version History', y, reportMeta)
    const historyHead = [['Version', 'Label', 'Created', 'Line Items']]
    const historyBody = context.history.map((v) => [
      v.versionId,
      v.label ?? '—',
      new Date(v.createdAt).toLocaleString('en-US'),
      String(v.items.length),
    ])
    y = drawPdfTable(doc, y, historyHead, historyBody, { columnStyles: { 1: { cellWidth: 55 } } })
  }

  return y
}

export function generateBOQReportPdf(context: BOQReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): jsPDF {
  const doc = new jsPDF()
  const reportMeta = { ...meta, reportTitle: 'Bill of Quantities (BOQ)' }

  if (!context.version || context.version.items.length === 0) {
    const y = drawPdfHeader(doc, reportMeta)
    drawBOQReportBody(doc, context, y, reportMeta)
    drawPdfFooter(doc)
    return doc
  }

  drawCoverPage(doc, reportMeta, { subtitle: `${context.version.items.length} line items — Version ${context.version.versionId}` })
  doc.addPage()
  const y = drawPdfHeader(doc, reportMeta)
  drawBOQReportBody(doc, context, y, reportMeta)

  drawPdfFooter(doc, { startPage: 2 })
  return doc
}

export function downloadBOQReportPdf(context: BOQReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): void {
  const doc = generateBOQReportPdf(context, meta)
  downloadPdf(doc, buildReportFilename('BOQ_Report', meta.projectName, meta.generatedAt))
}
