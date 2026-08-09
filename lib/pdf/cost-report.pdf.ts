// lib/pdf/cost-report.pdf.ts
//
// Module 13 — Cost Report PDF। dashboard.service.ts-এর
// ProjectCostSummary পুনর্ব্যবহার করা হয়েছে — Dashboard UI-তে যে
// সংখ্যা দেখা যায়, এই PDF-এ ঠিক সেই একই সংখ্যা যাবে।
//
// ── Phase 2 আপগ্রেড ──────────────────────────────────────────────
// cover page, ৫টা stat card (Material/Labour/Equipment/Overhead/
// Profit পাশাপাশি, Dashboard-এর card look-এর কাছাকাছি), cost-split
// donut chart (toCostBreakdownChartData() পুনর্ব্যবহার — Dashboard-এ
// যে chart data hisab আছে ঠিক সেটাই, নতুন কোনো hisab এখানে করা
// হয়নি), এবং itemsWithoutRateAnalysis-কে plain রঙিন টেক্সটের বদলে
// styled warning callout box-এ।
//
// ── Phase 5 রিফ্যাক্টর ───────────────────────────────────────────
// body-drawing লজিক drawCostReportBody()-এ বের করা হয়েছে,
// master-report.pdf.ts-এর জন্য reuse করার লক্ষ্যে (boq-report.pdf.ts
// দ্রষ্টব্য একই প্যাটার্নের ব্যাখ্যার জন্য)।

import jsPDF from 'jspdf'
import { CostReportContext } from '@/lib/services/reports.service'
import { toCostBreakdownChartData } from '@/lib/services/dashboard.service'
import {
  drawPdfHeader,
  drawPdfFooter,
  drawCoverPage,
  drawPdfTable,
  drawSectionTitle,
  drawSummaryLine,
  drawStatCards,
  drawCalloutBox,
  renderPieChartImage,
  addChartImage,
  downloadPdf,
  buildReportFilename,
  formatTaka,
  formatQty,
  PdfReportMeta,
  PDF_CHART_PALETTE,
} from '@/lib/pdf/pdf-shared'

export function drawCostReportBody(doc: jsPDF, context: CostReportContext, startY: number, reportMeta: PdfReportMeta): number {
  let y = startY

  if (!context.summary || context.boqItems.length === 0) {
    doc.setFontSize(10)
    doc.text(
      'No cost data available yet — complete BOQ (Module 3) and Rate Analysis (Module 4) first.',
      14,
      y
    )
    return y + 8
  }

  const s = context.summary

  y = drawSectionTitle(doc, 'Cost Summary', y, reportMeta)
  y = drawStatCards(
    doc,
    [
      { label: 'Material', value: formatTaka(s.totalMaterialCost), accent: PDF_CHART_PALETTE[0] },
      { label: 'Labour', value: formatTaka(s.totalLabourCost), accent: PDF_CHART_PALETTE[1] },
      { label: 'Equipment', value: formatTaka(s.totalEquipmentCost), accent: PDF_CHART_PALETTE[2] },
    ],
    y,
    reportMeta
  )
  y = drawStatCards(
    doc,
    [
      { label: 'Overhead', value: formatTaka(s.totalOverheadAmount), accent: PDF_CHART_PALETTE[3] },
      { label: 'Profit Margin', value: formatTaka(s.totalProfitAmount), accent: PDF_CHART_PALETTE[4] },
      { label: 'Total Project Cost', value: formatTaka(s.totalProjectCost), accent: PDF_CHART_PALETTE[6] },
    ],
    y,
    reportMeta
  )
  y += 2

  const chartData = toCostBreakdownChartData(s)
  if (chartData.length > 0) {
    y = drawSectionTitle(doc, 'Cost Split', y, reportMeta)
    const pieDataUrl = renderPieChartImage(chartData, {
      valueFormatter: formatTaka,
      centerLabel: 'Cost Split',
    })
    y = addChartImage(doc, pieDataUrl, y, { widthMm: 170 })
  }

  if (s.itemsWithoutRateAnalysis.length > 0) {
    y = drawCalloutBox(
      doc,
      [
        'Note: the following BOQ items have no Rate Analysis yet and are NOT included above:',
        ...s.itemsWithoutRateAnalysis.map((name) => `-  ${name}`),
      ],
      y,
      'warning',
      reportMeta
    )
  }

  doc.addPage()
  y = drawPdfHeader(doc, reportMeta)
  y = drawSectionTitle(doc, 'BOQ Item Costs', y, reportMeta)
  const head = [['Item', 'Unit', 'Quantity']]
  const body = context.boqItems.map((item) => [item.itemName, item.unit, formatQty(item.quantity, 3)])
  y = drawPdfTable(doc, y, head, body, { columnStyles: { 0: { cellWidth: 100 } } })

  return y
}

export function generateCostReportPdf(context: CostReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): jsPDF {
  const doc = new jsPDF()
  const reportMeta = { ...meta, reportTitle: 'Cost Report' }

  if (!context.summary || context.boqItems.length === 0) {
    const y = drawPdfHeader(doc, reportMeta)
    drawCostReportBody(doc, context, y, reportMeta)
    drawPdfFooter(doc)
    return doc
  }

  drawCoverPage(doc, reportMeta, { subtitle: `${context.boqItems.length} BOQ items costed` })

  doc.addPage()
  const y = drawPdfHeader(doc, reportMeta)
  drawCostReportBody(doc, context, y, reportMeta)

  drawPdfFooter(doc, { startPage: 2 })
  return doc
}

export function downloadCostReportPdf(context: CostReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): void {
  const doc = generateCostReportPdf(context, meta)
  downloadPdf(doc, buildReportFilename('Cost_Report', meta.projectName, meta.generatedAt))
}
