// lib/pdf/boq-report.pdf.ts
//
// Module 13 — BOQ PDF export। Module 3-এর active BOQVersion থেকে
// সরাসরি table বানানো হয় — কোনো নতুন calculation নেই।

import jsPDF from 'jspdf'
import { BOQReportContext } from '@/lib/services/reports.service'
import { BOQ_UNIT_LABELS } from '@/lib/types/boq.types'
import { drawPdfHeader, drawPdfFooter, drawPdfTable, drawSummaryLine, downloadPdf, PdfReportMeta } from '@/lib/pdf/pdf-shared'

export function generateBOQReportPdf(context: BOQReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): jsPDF {
  const doc = new jsPDF()
  let y = drawPdfHeader(doc, { ...meta, reportTitle: 'Bill of Quantities (BOQ)' })

  if (!context.version || context.version.items.length === 0) {
    doc.setFontSize(10)
    doc.text('No BOQ items found for this project yet.', 14, y)
    drawPdfFooter(doc)
    return doc
  }

  y = drawSummaryLine(doc, 'BOQ Version', context.version.versionId, y)
  y = drawSummaryLine(doc, 'Total Line Items', String(context.version.items.length), y + 2)
  y += 4

  const head = [['Item', 'Unit', 'Quantity', 'Source', 'Floor']]
  const body = context.version.items.map((item) => [
    item.itemName,
    BOQ_UNIT_LABELS[item.unit],
    item.quantity.toLocaleString('en-US', { maximumFractionDigits: 3 }),
    item.source === 'auto_rcc' ? 'Auto (RCC)' : 'Manual',
    item.floorId ?? '—',
  ])

  drawPdfTable(doc, y, head, body, {
    columnStyles: {
      0: { cellWidth: 70 },
      2: { halign: 'right' },
    },
  })

  drawPdfFooter(doc)
  return doc
}

export function downloadBOQReportPdf(context: BOQReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): void {
  const doc = generateBOQReportPdf(context, meta)
  downloadPdf(doc, `BOQ_Report_${meta.projectName.replace(/\s+/g, '_')}.pdf`)
}
