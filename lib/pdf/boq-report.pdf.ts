// lib/pdf/boq-report.pdf.ts
//
// Module 13 — BOQ PDF export। Module 3-এর active BOQVersion থেকে
// সরাসরি table বানানো হয় — কোনো নতুন calculation নেই।
//
// ── Phase 3 আপগ্রেড ──────────────────────────────────────────────
// cover page, এবং items-কে সেকশনে ভাগ। এছাড়া version history-র একটা
// সংক্ষিপ্ত সারণি যোগ হয়েছে (context.history আগে থেকেই fetch হতো
// কিন্তু builder ব্যবহার করত না)।
//
// ── ২০২৬-০৮-২০ আপডেট (audit gap #2 সমাধানের অংশ) ──────────────────
// boq.service.ts এখন RCC ছাড়াও Earthwork/Masonry/Finishing/Stair
// auto-generate করে (৪টা নতুন BOQItemSource)। আগে এখানে grouping
// ছিল শুধু "auto_rcc হলে Auto, নাহলে Manual" — এই বাইনারি চেকের
// কারণে নতুন auto-source গুলো ভুলভাবে "Manual / Custom Items"
// section-এ পড়ে যেত (BOQGenerator.tsx-এ একই ধরনের bug ছিল, ওখানে
// AUTO_SOURCES/sourceLabel() দিয়ে ঠিক করা হয়েছে)। এখানে trade-ভিত্তিক
// আলাদা section (RCC/Earthwork/Masonry/Finishing/Stair/Manual) —
// এখন BOQItem.source-এ প্রকৃত trade-metadata আছে বলে এই grouping
// বাস্তব ডেটার ওপর ভিত্তি করেই সম্ভব, আগের মতো বানানো category না।
//
// ── Phase 5 রিফ্যাক্টর ───────────────────────────────────────────
// body-drawing লজিক drawBOQReportBody()-এ বের করা হয়েছে (header
// আঁকা পর্যন্ত, cover page/footer বাদে) যাতে master-report.pdf.ts
// এই একই ফাংশন নিজের multi-section doc-এ reuse করতে পারে —
// generateBOQReportPdf() আগের মতোই standalone PDF বানায়, পুরনো
// public API/signature অপরিবর্তিত।

import jsPDF from 'jspdf'
import { BOQReportContext } from '@/lib/services/reports.service'
import { BOQItem, BOQItemSource, BOQ_UNIT_LABELS } from '@/lib/types/boq.types'
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

  // ট্রেড-ভিত্তিক section order — নির্মাণের স্বাভাবিক ক্রম অনুসরণ করে
  // (মাটির কাজ → RCC → গাঁথুনি → ফিনিশিং → স্টেয়ার), BOQ document-এ
  // এই ক্রম-ই প্রচলিত। প্রতিটা group শুধু তখনই section পায় যখন
  // items.length > 0 — খালি section দেখানো হয় না।
  const TRADE_GROUPS: { source: BOQItemSource; title: string }[] = [
    { source: 'auto_earthwork', title: 'Earthwork (Auto-generated — from Quantity Takeoff)' },
    { source: 'auto_rcc', title: 'RCC (Auto-generated — from Quantity Takeoff)' },
    { source: 'auto_stair', title: 'Stair (Auto-generated — from Quantity Takeoff)' },
    { source: 'auto_masonry', title: 'Masonry / Brick Work (Auto-generated — from Quantity Takeoff)' },
    { source: 'auto_finishing', title: 'Finishing (Auto-generated — from Quantity Takeoff)' },
    { source: 'auto_doors_windows', title: 'Doors & Windows (Auto-generated — from Quantity Takeoff)' },
    { source: 'auto_electrical', title: 'Electrical (Auto-generated — from Module 16)' },
    { source: 'auto_plumbing', title: 'Plumbing & Sanitary (Auto-generated — from Module 17)' },
  ]
  const groupedItems = TRADE_GROUPS.map((g) => ({ ...g, items: context.version!.items.filter((item) => item.source === g.source) }))
  const manualItems = context.version.items.filter((item) => item.source === 'manual')
  const autoCount = context.version.items.length - manualItems.length

  y = drawSectionTitle(doc, 'Overview', y, reportMeta)
  y = drawStatCards(
    doc,
    [
      { label: 'Total Line Items', value: String(context.version.items.length), accent: PDF_CHART_PALETTE[0] },
      { label: 'Auto-generated', value: String(autoCount), accent: PDF_CHART_PALETTE[1] },
      { label: 'Manual / Custom', value: String(manualItems.length), accent: PDF_CHART_PALETTE[3] },
    ],
    y,
    reportMeta
  )
  y = drawSummaryLine(doc, 'BOQ Version', context.version.versionId, y, reportMeta)
  y += 6

  let firstSectionDrawn = false
  for (const group of groupedItems) {
    if (group.items.length === 0) continue
    if (firstSectionDrawn) {
      // প্রথম section আগের overview-এর পরপরই বসে (একই পাতায়), তার
      // পরের প্রতিটা trade section নতুন পাতায় — একটা বড় table
      // page-break-এর মাঝে কাটা পড়ার ঝুঁকি এড়াতে (BOQ-তে একটা
      // trade-এর row ভেঙে দুই পাতায় পড়লে পড়তে অসুবিধা হয়)
      doc.addPage()
      y = drawPdfHeader(doc, reportMeta)
    }
    y = drawSectionTitle(doc, group.title, y, reportMeta)
    y = drawItemsTable(doc, y, group.items)
    firstSectionDrawn = true
  }

  if (manualItems.length > 0) {
    if (firstSectionDrawn) {
      doc.addPage()
      y = drawPdfHeader(doc, reportMeta)
    }
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
