// lib/pdf/cost-report.pdf.ts
//
// Module 13 — Cost Report PDF। dashboard.service.ts-এর
// ProjectCostSummary পুনর্ব্যবহার করা হয়েছে — Dashboard UI-তে যে
// সংখ্যা দেখা যায়, এই PDF-এ ঠিক সেই একই সংখ্যা যাবে।

import jsPDF from 'jspdf'
import { CostReportContext } from '@/lib/services/reports.service'
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

export function generateCostReportPdf(context: CostReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): jsPDF {
  const doc = new jsPDF()
  let y = drawPdfHeader(doc, { ...meta, reportTitle: 'Cost Report' })

  if (!context.summary || context.boqItems.length === 0) {
    doc.setFontSize(10)
    doc.text(
      'No cost data available yet — complete BOQ (Module 3) and Rate Analysis (Module 4) first.',
      14,
      y
    )
    drawPdfFooter(doc)
    return doc
  }

  const s = context.summary

  y = drawSectionTitle(doc, 'Cost Summary', y)
  y = drawSummaryLine(doc, 'Material Cost', formatTaka(s.totalMaterialCost), y)
  y = drawSummaryLine(doc, 'Labour Cost', formatTaka(s.totalLabourCost), y)
  y = drawSummaryLine(doc, 'Equipment Cost', formatTaka(s.totalEquipmentCost), y)
  y = drawSummaryLine(doc, 'Overhead Cost', formatTaka(s.totalOverheadAmount), y)
  y = drawSummaryLine(doc, 'Profit Margin', formatTaka(s.totalProfitAmount), y)
  doc.setDrawColor(200, 200, 200)
  doc.line(14, y, 90, y)
  y += 6
  y = drawSummaryLine(doc, 'Total Project Cost', formatTaka(s.totalProjectCost), y)
  y += 6

  if (s.itemsWithoutRateAnalysis.length > 0) {
    doc.setFontSize(9)
    doc.setTextColor(180, 60, 20)
    doc.text('Note: the following BOQ items have no Rate Analysis yet and are NOT included above:', 14, y)
    y += 5
    s.itemsWithoutRateAnalysis.forEach((name) => {
      doc.text(`- ${name}`, 18, y)
      y += 4.5
    })
    doc.setTextColor(20, 20, 20)
    y += 4
  }

  y = drawSectionTitle(doc, 'BOQ Item Costs', y)
  const head = [['Item', 'Unit', 'Quantity']]
  const body = context.boqItems.map((item) => [item.itemName, item.unit, item.quantity.toLocaleString('en-US')])
  drawPdfTable(doc, y, head, body, { columnStyles: { 0: { cellWidth: 100 } } })

  drawPdfFooter(doc)
  return doc
}

export function downloadCostReportPdf(context: CostReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): void {
  const doc = generateCostReportPdf(context, meta)
  downloadPdf(doc, `Cost_Report_${meta.projectName.replace(/\s+/g, '_')}.pdf`)
}
