// lib/pdf/quantity-report.pdf.ts
//
// Module 13 — Quantity Report PDF। Module 2-এর active
// StoredQuantityTakeoff থেকে floor-ভিত্তিক Architectural ও
// Structural quantity একসাথে দেখানো হয়। effectiveArchitectural/
// StructuralQuantities() ব্যবহার করা হয়েছে (raw না) — override করা
// থাকলে সেই মান-ই সঠিক, ঠিক QuantityBreakdown.tsx UI যেভাবে দেখায়।
//
// ── Phase 3 আপগ্রেড ──────────────────────────────────────────────
// cover page, প্রজেক্ট-ওয়াইড summary stat card (মোট wall area, মোট
// RCC volume — উভয় বিভাগের টেবিলের যোগফল, নতুন hisab না, শুধু
// .reduce()), এবং floor-wise total RCC volume bar chart
// (summarizeFloorVolumes()-এর বিদ্যমান totalRccVolumeM3 পুনর্ব্যবহার)।
//
// ── Phase 5 রিফ্যাক্টর ───────────────────────────────────────────
// body-drawing লজিক drawQuantityReportBody()-এ বের করা হয়েছে,
// master-report.pdf.ts-এর জন্য reuse করার লক্ষ্যে (boq-report.pdf.ts
// দ্রষ্টব্য একই প্যাটার্নের ব্যাখ্যার জন্য)।

import jsPDF from 'jspdf'
import { QuantityReportContext, effectiveArchitecturalQuantities, effectiveStructuralQuantities, summarizeFloorVolumes } from '@/lib/services/reports.service'
import {
  drawPdfHeader,
  drawPdfFooter,
  drawCoverPage,
  drawPdfTable,
  drawSectionTitle,
  drawStatCards,
  renderBarChartImage,
  addChartImage,
  downloadPdf,
  buildReportFilename,
  formatQty,
  PdfReportMeta,
  PDF_CHART_PALETTE,
} from '@/lib/pdf/pdf-shared'

export function drawQuantityReportBody(doc: jsPDF, context: QuantityReportContext, startY: number, reportMeta: PdfReportMeta): number {
  let y = startY

  if (!context.takeoff || (context.takeoff.architecturalFloors.length === 0 && context.takeoff.structuralFloors.length === 0)) {
    doc.setFontSize(10)
    doc.text('No quantity takeoff data found for this project yet.', 14, y)
    return y + 8
  }

  const archFloors = context.takeoff.architecturalFloors.map((item) => effectiveArchitecturalQuantities(item))
  const structFloors = context.takeoff.structuralFloors.map((item) => {
    const q = effectiveStructuralQuantities(item)
    return { q, vol: summarizeFloorVolumes(q) }
  })

  const totalWallAreaSqft = archFloors.reduce((sum, f) => sum + f.wallAreaSqft, 0)
  const totalFloorAreaSqft = archFloors.reduce((sum, f) => sum + f.floorAreaSqft, 0)
  const totalRccVolumeM3 = structFloors.reduce((sum, f) => sum + f.vol.totalRccVolumeM3, 0)

  y = drawSectionTitle(doc, 'Project Summary', y, reportMeta)
  y = drawStatCards(
    doc,
    [
      { label: 'Total Floor Area', value: `${formatQty(totalFloorAreaSqft)} sqft`, accent: PDF_CHART_PALETTE[0] },
      { label: 'Total Wall Area', value: `${formatQty(totalWallAreaSqft)} sqft`, accent: PDF_CHART_PALETTE[1] },
      { label: 'Total RCC Volume', value: `${formatQty(totalRccVolumeM3)} m³`, accent: PDF_CHART_PALETTE[2] },
    ],
    y,
    reportMeta
  )
  y += 2

  // ── Floor-wise RCC volume bar chart — শুধু ১টা floor থাকলে
  // চার্ট বাহুল্য (একটা bar-এর chart কিছু বোঝায় না), তাই ২+
  // floor থাকলেই আঁকা হয় ──
  if (structFloors.length > 1) {
    y = drawSectionTitle(doc, 'RCC Volume by Floor', y, reportMeta)
    const chartData = structFloors.map((f) => ({ label: f.q.floorLabel, value: f.vol.totalRccVolumeM3 }))
    const barDataUrl = renderBarChartImage(chartData, { valueFormatter: (v) => `${formatQty(v, 1)} m³` })
    y = addChartImage(doc, barDataUrl, y, { widthMm: 182 })
  }

  if (context.takeoff.architecturalFloors.length > 0) {
    doc.addPage()
    y = drawPdfHeader(doc, reportMeta)
    y = drawSectionTitle(doc, 'Architectural Quantities (per floor)', y, reportMeta)
    const archHead = [['Floor', 'Wall Length (ft)', 'Wall Area (sqft)', 'Floor Area (sqft)', 'Ceiling Area (sqft)', 'Paint Area (sqft)', 'Doors', 'Windows']]
    const archBody = archFloors.map((q) => [
      q.floorLabel,
      formatQty(q.wallLengthFt),
      formatQty(q.wallAreaSqft),
      formatQty(q.floorAreaSqft),
      formatQty(q.ceilingAreaSqft),
      formatQty(q.paintAreaSqft),
      String(q.doorQuantity),
      String(q.windowQuantity),
    ])
    y = drawPdfTable(doc, y, archHead, archBody)
  }

  if (context.takeoff.structuralFloors.length > 0) {
    doc.addPage()
    y = drawPdfHeader(doc, reportMeta)
    y = drawSectionTitle(doc, 'Structural Quantities (per floor, calculated volume)', y, reportMeta)
    const structHead = [['Floor', 'Footing (m³)', 'Column (m³)', 'Beam (m³)', 'Slab (m³)', 'Stairs (nos)', 'Reinforcement (kg)']]
    const structBody = structFloors.map(({ q, vol }) => [
      q.floorLabel,
      formatQty(vol.footingVolumeM3),
      formatQty(vol.columnVolumeM3),
      formatQty(vol.beamVolumeM3),
      formatQty(vol.slabVolumeM3),
      String(q.stairQuantity),
      formatQty(q.reinforcementQuantityKg),
    ])
    y = drawPdfTable(doc, y, structHead, structBody)
  }

  return y
}

export function generateQuantityReportPdf(
  context: QuantityReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle'>
): jsPDF {
  const doc = new jsPDF()
  const reportMeta = { ...meta, reportTitle: 'Quantity Report' }

  if (!context.takeoff || (context.takeoff.architecturalFloors.length === 0 && context.takeoff.structuralFloors.length === 0)) {
    const y = drawPdfHeader(doc, reportMeta)
    drawQuantityReportBody(doc, context, y, reportMeta)
    drawPdfFooter(doc)
    return doc
  }

  const archFloors = context.takeoff.architecturalFloors.map((item) => effectiveArchitecturalQuantities(item))
  const structFloors = context.takeoff.structuralFloors.map((item) => effectiveStructuralQuantities(item))
  const floorCount = new Set([...archFloors.map((f) => f.floorLabel), ...structFloors.map((f) => f.floorLabel)]).size
  drawCoverPage(doc, reportMeta, { subtitle: `${floorCount} floor${floorCount === 1 ? '' : 's'} covered` })

  doc.addPage()
  const y = drawPdfHeader(doc, reportMeta)
  drawQuantityReportBody(doc, context, y, reportMeta)

  drawPdfFooter(doc, { startPage: 2 })
  return doc
}

export function downloadQuantityReportPdf(
  context: QuantityReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle'>
): void {
  const doc = generateQuantityReportPdf(context, meta)
  downloadPdf(doc, buildReportFilename('Quantity_Report', meta.projectName, meta.generatedAt))
}
