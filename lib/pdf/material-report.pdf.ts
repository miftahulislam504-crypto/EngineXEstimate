// lib/pdf/material-report.pdf.ts
//
// Module 13 — Material Report PDF। Module 5-এর organization-wide
// Material list (project-scoped না) — currentRate ও last-updated
// দেখানো হয়, price history পুরোটা না (সেটা আলাদা, বড় হতে পারে;
// এই report শুধু বর্তমান অবস্থার snapshot)।

import jsPDF from 'jspdf'
import { MaterialReportContext } from '@/lib/services/reports.service'
import { drawPdfHeader, drawPdfFooter, drawPdfTable, downloadPdf, formatTaka, PdfReportMeta } from '@/lib/pdf/pdf-shared'

const CATEGORY_LABELS: Record<string, string> = {
  cement: 'Cement',
  sand: 'Sand',
  stone: 'Stone',
  rebar: 'Rebar',
  brick: 'Brick',
  tiles: 'Tiles',
  paint: 'Paint',
  other: 'Other',
}

export function generateMaterialReportPdf(
  context: MaterialReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle'>
): jsPDF {
  const doc = new jsPDF()
  let y = drawPdfHeader(doc, { ...meta, reportTitle: 'Material Report' })

  if (context.materials.length === 0) {
    doc.setFontSize(10)
    doc.text('No active materials found in the Material Database yet.', 14, y)
    drawPdfFooter(doc)
    return doc
  }

  const head = [['Material', 'Category', 'Brand', 'Unit', 'Current Rate', 'Last Updated']]
  const body = context.materials
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => [
      m.name,
      CATEGORY_LABELS[m.category] ?? m.category,
      m.brand ?? '—',
      m.unit,
      formatTaka(m.currentRate),
      new Date(m.lastUpdatedAt).toLocaleDateString('en-US'),
    ])

  drawPdfTable(doc, y, head, body, { columnStyles: { 0: { cellWidth: 55 } } })

  drawPdfFooter(doc)
  return doc
}

export function downloadMaterialReportPdf(
  context: MaterialReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle'>
): void {
  const doc = generateMaterialReportPdf(context, meta)
  downloadPdf(doc, `Material_Report_${meta.projectName.replace(/\s+/g, '_')}.pdf`)
}
