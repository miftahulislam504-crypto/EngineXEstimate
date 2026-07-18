// lib/pdf/quantity-report.pdf.ts
//
// Module 13 — Quantity Report PDF। Module 2-এর active
// StoredQuantityTakeoff থেকে floor-ভিত্তিক Architectural ও
// Structural quantity একসাথে দেখানো হয়। effectiveArchitectural/
// StructuralQuantities() ব্যবহার করা হয়েছে (raw না) — override করা
// থাকলে সেই মান-ই সঠিক, ঠিক QuantityBreakdown.tsx UI যেভাবে দেখায়।

import jsPDF from 'jspdf'
import { QuantityReportContext, effectiveArchitecturalQuantities, effectiveStructuralQuantities, summarizeFloorVolumes } from '@/lib/services/reports.service'
import { drawPdfHeader, drawPdfFooter, drawPdfTable, drawSectionTitle, downloadPdf, PdfReportMeta } from '@/lib/pdf/pdf-shared'

export function generateQuantityReportPdf(
  context: QuantityReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle'>
): jsPDF {
  const doc = new jsPDF()
  let y = drawPdfHeader(doc, { ...meta, reportTitle: 'Quantity Report' })

  if (!context.takeoff || (context.takeoff.architecturalFloors.length === 0 && context.takeoff.structuralFloors.length === 0)) {
    doc.setFontSize(10)
    doc.text('No quantity takeoff data found for this project yet.', 14, y)
    drawPdfFooter(doc)
    return doc
  }

  if (context.takeoff.architecturalFloors.length > 0) {
    y = drawSectionTitle(doc, 'Architectural Quantities (per floor)', y)
    const archHead = [['Floor', 'Wall Length (ft)', 'Wall Area (sqft)', 'Floor Area (sqft)', 'Ceiling Area (sqft)', 'Paint Area (sqft)', 'Doors', 'Windows']]
    const archBody = context.takeoff.architecturalFloors.map((item) => {
      const q = effectiveArchitecturalQuantities(item)
      return [
        q.floorLabel,
        q.wallLengthFt.toLocaleString('en-US'),
        q.wallAreaSqft.toLocaleString('en-US'),
        q.floorAreaSqft.toLocaleString('en-US'),
        q.ceilingAreaSqft.toLocaleString('en-US'),
        q.paintAreaSqft.toLocaleString('en-US'),
        String(q.doorQuantity),
        String(q.windowQuantity),
      ]
    })
    y = drawPdfTable(doc, y, archHead, archBody)
  }

  if (context.takeoff.structuralFloors.length > 0) {
    y = drawSectionTitle(doc, 'Structural Quantities (per floor, calculated volume)', y)
    const structHead = [['Floor', 'Footing (m³)', 'Column (m³)', 'Beam (m³)', 'Slab (m³)', 'Stairs (nos)', 'Reinforcement (kg)']]
    const structBody = context.takeoff.structuralFloors.map((item) => {
      const q = effectiveStructuralQuantities(item)
      const vol = summarizeFloorVolumes(q)
      return [
        q.floorLabel,
        vol.footingVolumeM3.toFixed(2),
        vol.columnVolumeM3.toFixed(2),
        vol.beamVolumeM3.toFixed(2),
        vol.slabVolumeM3.toFixed(2),
        String(q.stairQuantity),
        q.reinforcementQuantityKg.toLocaleString('en-US'),
      ]
    })
    drawPdfTable(doc, y, structHead, structBody)
  }

  drawPdfFooter(doc)
  return doc
}

export function downloadQuantityReportPdf(
  context: QuantityReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle'>
): void {
  const doc = generateQuantityReportPdf(context, meta)
  downloadPdf(doc, `Quantity_Report_${meta.projectName.replace(/\s+/g, '_')}.pdf`)
}
