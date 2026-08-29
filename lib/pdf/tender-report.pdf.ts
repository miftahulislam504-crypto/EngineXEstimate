// lib/pdf/tender-report.pdf.ts
//
// Module 13 — Tender Report PDF। Module 12-এর Engineer Estimate,
// Contractor Bids, Comparative Statement, ও (থাকলে) Finalization
// একসাথে দেখানো হয় — অনেকটা tender submission-এ যেভাবে single
// document হিসেবে জমা দেওয়া হয় তার কাছাকাছি।
//
// ── Phase 2 আপগ্রেড ──────────────────────────────────────────────
// cover page, bid-comparison bar chart (Engineer Estimate + প্রতিটা
// contractor bid পাশাপাশি, lowest bid আলাদা রঙে হাইলাইট), এবং
// Finalization/pending status-কে callout box-এ।
//
// ── Phase 5 রিফ্যাক্টর ───────────────────────────────────────────
// body-drawing লজিক drawTenderReportBody()-এ বের করা হয়েছে,
// master-report.pdf.ts-এর জন্য reuse করার লক্ষ্যে (boq-report.pdf.ts
// দ্রষ্টব্য একই প্যাটার্নের ব্যাখ্যার জন্য)। watermark (DRAFT/FINAL)
// শুধু standalone PDF-এর cover page-এ প্রযোজ্য — Master Report-এর
// নিজস্ব cover page/watermark থাকবে, তাই সেই লজিক generateTenderReportPdf()-এই
// থেকে গেছে, body function-এ না।

import jsPDF from 'jspdf'
import { TenderReportContext } from '@/lib/services/reports.service'
import {
  drawSidebar,
  drawPdfFooter,
  drawCoverPage,
  drawPdfTable,
  drawSectionTitle,
  drawSummaryLine,
  drawCalloutBox,
  renderBarChartImage,
  addChartImage,
  downloadPdf,
  buildReportFilename,
  formatTaka,
  sidebarRightMargin,
  PdfReportMeta,
  PDF_BRAND_COLOR,
  PDF_SUCCESS_COLOR,
} from '@/lib/pdf/pdf-shared'

export function drawTenderReportBody(doc: jsPDF, context: TenderReportContext, startY: number, reportMeta: PdfReportMeta): number {
  let y = startY

  if (!context.engineerEstimate && context.bids.length === 0) {
    doc.setFontSize(10)
    doc.text('No tender data found for this project yet.', 14, y)
    return y + 8
  }

  y = drawSectionTitle(doc, 'Engineer Estimate', y, reportMeta)
  if (context.engineerEstimate) {
    y = drawSummaryLine(doc, 'Total Amount', formatTaka(context.engineerEstimate.totalAmount), y, reportMeta)
    y += 4
  } else {
    doc.setFontSize(9.5)
    doc.text('No Engineer Estimate has been entered yet.', 14, y)
    y += 8
  }

  // ── Bid comparison bar chart — Engineer Estimate + প্রতিটা bid
  // পাশাপাশি, লোয়েস্ট bid সবুজে হাইলাইট যাতে চোখে সহজে পড়ে ──
  if (context.bids.length > 0) {
    y = drawSectionTitle(doc, 'Bid Comparison', y, reportMeta)
    const lowestBidId = context.comparativeStatement.find((r) => r.isLowestBid)?.bidId
    const chartData = [
      ...(context.engineerEstimate
        ? [{ label: 'Estimate', value: context.engineerEstimate.totalAmount, color: PDF_BRAND_COLOR }]
        : []),
      ...context.bids.map((bid) => ({
        label: bid.contractorName,
        value: bid.bidAmount,
        color: bid.id === lowestBidId ? PDF_SUCCESS_COLOR : ([156, 163, 175] as [number, number, number]),
      })),
    ]
    const barDataUrl = renderBarChartImage(chartData, { valueFormatter: formatTaka })
    y = addChartImage(doc, barDataUrl, y, { widthMm: 182 })
  }

  if (context.bids.length > 0) {
    y = drawSectionTitle(doc, 'Contractor Bids', y, reportMeta)
    const bidHead = [['Contractor', 'Bid Amount', 'Contact', 'Submitted']]
    const bidBody = context.bids.map((bid) => [
      bid.contractorName,
      formatTaka(bid.bidAmount),
      bid.contactInfo ?? '—',
      new Date(bid.submittedAt).toLocaleDateString('en-US'),
    ])
    y = drawPdfTable(doc, y, bidHead, bidBody, { columnStyles: { 0: { cellWidth: 55 } }, rightMargin: sidebarRightMargin(doc) })
  }

  if (context.comparativeStatement.length > 0) {
    // নতুন পাতা — bid table-এর পরপরই comparative statement শুরু
    // হলে page-break-এর মাঝে table কাটা পড়ার ঝুঁকি বেশি থাকে
    doc.addPage()
    y = drawSidebar(doc, reportMeta, { sheetNumber: 'TND-2', sheetTitle: 'Comparative Statement' })
    y = drawSectionTitle(doc, 'Comparative Statement', y, reportMeta)
    const cmpHead = [['Contractor', 'Bid Amount', 'Diff. from Estimate', 'Diff %', 'Lowest?']]
    const cmpBody = context.comparativeStatement.map((row) => [
      row.contractorName,
      formatTaka(row.bidAmount),
      formatTaka(row.differenceFromEngineerEstimate),
      `${row.differenceFromEngineerEstimate > 0 ? '+' : ''}${row.differencePercent.toFixed(1)}%`,
      row.isLowestBid ? 'Yes' : '',
    ])
    y = drawPdfTable(doc, y, cmpHead, cmpBody, { columnStyles: { 0: { cellWidth: 55 } }, rightMargin: sidebarRightMargin(doc) })
  }

  if (context.finalization) {
    y = drawSectionTitle(doc, 'Finalization', y, reportMeta)
    const winningBid = context.comparativeStatement.find((row) => row.bidId === context.finalization!.selectedBidId)
    y = drawSummaryLine(doc, 'Selected Contractor', winningBid?.contractorName ?? '—', y, reportMeta)
    y = drawSummaryLine(doc, 'Finalized Amount', formatTaka(context.finalization.finalizedAmount), y, reportMeta)
    y = drawSummaryLine(doc, 'Finalized On', new Date(context.finalization.finalizedAt).toLocaleDateString('en-US'), y, reportMeta)
  } else {
    y = drawCalloutBox(
      doc,
      ['This tender has not been finalized yet (finalization requires admin approval).'],
      y,
      'warning',
      reportMeta
    )
  }

  return y
}

export function generateTenderReportPdf(context: TenderReportContext, meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' })
  const reportMeta: PdfReportMeta = { ...meta, reportTitle: 'Tender Report', reportKind: 'Tender_Report' }

  if (!context.engineerEstimate && context.bids.length === 0) {
    const y = drawSidebar(doc, reportMeta, { sheetNumber: 'TND-1', sheetTitle: reportMeta.reportTitle })
    drawTenderReportBody(doc, context, y, reportMeta)
    drawPdfFooter(doc, { reportMeta })
    return doc
  }

  drawCoverPage(doc, reportMeta, {
    subtitle: `${context.bids.length} contractor bid${context.bids.length === 1 ? '' : 's'} received`,
    watermark: context.finalization ? 'FINAL' : 'DRAFT',
  })

  doc.addPage()
  const y = drawSidebar(doc, reportMeta, { sheetNumber: 'TND-1', sheetTitle: reportMeta.reportTitle })
  drawTenderReportBody(doc, context, y, reportMeta)

  drawPdfFooter(doc, { startPage: 2, reportMeta })
  return doc
}

export function downloadTenderReportPdf(context: TenderReportContext, meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>): void {
  const doc = generateTenderReportPdf(context, meta)
  downloadPdf(doc, buildReportFilename('Tender_Report', meta.projectName, meta.generatedAt))
}
