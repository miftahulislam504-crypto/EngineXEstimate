// lib/pdf/tender-report.pdf.ts
//
// Module 13 — Tender Report PDF। Module 12-এর Engineer Estimate,
// Contractor Bids, Comparative Statement, ও (থাকলে) Finalization
// একসাথে দেখানো হয় — অনেকটা tender submission-এ যেভাবে single
// document হিসেবে জমা দেওয়া হয় তার কাছাকাছি।

import jsPDF from 'jspdf'
import { TenderReportContext } from '@/lib/services/reports.service'
import {
  drawPdfHeader,
  drawPdfFooter,
  drawPdfTable,
  drawSectionTitle,
  drawSummaryLine,
  downloadPdf,
  formatTaka,
  PdfReportMeta,
} from '@/lib/pdf/pdf-shared'

export function generateTenderReportPdf(context: TenderReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): jsPDF {
  const doc = new jsPDF()
  let y = drawPdfHeader(doc, { ...meta, reportTitle: 'Tender Report' })

  if (!context.engineerEstimate && context.bids.length === 0) {
    doc.setFontSize(10)
    doc.text('No tender data found for this project yet.', 14, y)
    drawPdfFooter(doc)
    return doc
  }

  y = drawSectionTitle(doc, 'Engineer Estimate', y)
  if (context.engineerEstimate) {
    y = drawSummaryLine(doc, 'Total Amount', formatTaka(context.engineerEstimate.totalAmount), y)
    y += 4
  } else {
    doc.setFontSize(9.5)
    doc.text('No Engineer Estimate has been entered yet.', 14, y)
    y += 8
  }

  if (context.bids.length > 0) {
    y = drawSectionTitle(doc, 'Contractor Bids', y)
    const bidHead = [['Contractor', 'Bid Amount', 'Contact', 'Submitted']]
    const bidBody = context.bids.map((bid) => [
      bid.contractorName,
      formatTaka(bid.bidAmount),
      bid.contactInfo ?? '—',
      new Date(bid.submittedAt).toLocaleDateString('en-US'),
    ])
    y = drawPdfTable(doc, y, bidHead, bidBody, { columnStyles: { 0: { cellWidth: 55 } } })
  }

  if (context.comparativeStatement.length > 0) {
    y = drawSectionTitle(doc, 'Comparative Statement', y)
    const cmpHead = [['Contractor', 'Bid Amount', 'Diff. from Estimate', 'Diff %', 'Lowest?']]
    const cmpBody = context.comparativeStatement.map((row) => [
      row.contractorName,
      formatTaka(row.bidAmount),
      formatTaka(row.differenceFromEngineerEstimate),
      `${row.differenceFromEngineerEstimate > 0 ? '+' : ''}${row.differencePercent.toFixed(1)}%`,
      row.isLowestBid ? 'Yes' : '',
    ])
    y = drawPdfTable(doc, y, cmpHead, cmpBody, { columnStyles: { 0: { cellWidth: 55 } } })
  }

  if (context.finalization) {
    y = drawSectionTitle(doc, 'Finalization', y)
    const winningBid = context.comparativeStatement.find((row) => row.bidId === context.finalization!.selectedBidId)
    y = drawSummaryLine(doc, 'Selected Contractor', winningBid?.contractorName ?? '—', y)
    y = drawSummaryLine(doc, 'Finalized Amount', formatTaka(context.finalization.finalizedAmount), y)
    y = drawSummaryLine(doc, 'Finalized On', new Date(context.finalization.finalizedAt).toLocaleDateString('en-US'), y)
  } else {
    doc.setFontSize(9)
    doc.setTextColor(150, 100, 20)
    doc.text('This tender has not been finalized yet (finalization requires admin approval).', 14, y)
  }

  drawPdfFooter(doc)
  return doc
}

export function downloadTenderReportPdf(context: TenderReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): void {
  const doc = generateTenderReportPdf(context, meta)
  downloadPdf(doc, `Tender_Report_${meta.projectName.replace(/\s+/g, '_')}.pdf`)
}
