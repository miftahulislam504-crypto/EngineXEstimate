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
  calculateEarthworkVolumes,
  summarizeMasonryVolumes,
  convertFinishingToSqm,
  getStairVolumeM3,
} from '@/lib/services/quantity-takeoff.service'
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

  // ২০২৬-০৮-২০ যোগ — Earthwork ও Masonry-এর প্রজেক্ট-ওয়াইড টোটাল,
  // কিন্তু শুধু সেই ডেটা থাকলে (audit gap #2 সমাধানের অংশ হিসেবে
  // যোগ হওয়া optional field)। কোনো floor-এ earthwork/masonryWalls
  // না থাকলে (upstream app এখনো export করে না) এই দুই stat card
  // silently বাদ যায় — শূন্য দেখিয়ে বিভ্রান্ত করার বদলে।
  const totalExcavationM3 = structFloors.reduce(
    (sum, f) => sum + (f.q.earthwork ? calculateEarthworkVolumes(f.q.earthwork).excavationVolumeM3 : 0),
    0
  )
  const hasEarthworkData = structFloors.some((f) => f.q.earthwork !== undefined)

  const totalMasonryM3 = archFloors.reduce(
    (sum, f) => sum + (f.masonryWalls ? summarizeMasonryVolumes(f.masonryWalls).totalMasonryVolumeM3 : 0),
    0
  )
  const hasMasonryData = archFloors.some((f) => f.masonryWalls !== undefined)

  y = drawSectionTitle(doc, 'Project Summary', y, reportMeta)
  const statCards = [
    { label: 'Total Floor Area', value: `${formatQty(totalFloorAreaSqft)} sqft`, accent: PDF_CHART_PALETTE[0] },
    { label: 'Total Wall Area', value: `${formatQty(totalWallAreaSqft)} sqft`, accent: PDF_CHART_PALETTE[1] },
    { label: 'Total RCC Volume', value: `${formatQty(totalRccVolumeM3)} m³`, accent: PDF_CHART_PALETTE[2] },
  ]
  if (hasEarthworkData) {
    statCards.push({ label: 'Total Excavation', value: `${formatQty(totalExcavationM3)} m³`, accent: PDF_CHART_PALETTE[3] })
  }
  if (hasMasonryData) {
    statCards.push({ label: 'Total Masonry Volume', value: `${formatQty(totalMasonryM3)} m³`, accent: PDF_CHART_PALETTE[4] })
  }
  y = drawStatCards(doc, statCards, y, reportMeta)
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

    // ২০২৬-০৮-২০ যোগ — Masonry ও Finishing আলাদা টেবিল হিসেবে, কারণ
    // মূল archHead টেবিল ইতিমধ্যেই ৮ কলাম চওড়া — আরও ৬-৮ কলাম যোগ
    // করলে PDF-এ পড়া কঠিন হয়ে যেত। শুধু যেসব floor-এ ডেটা আছে
    // (masonryWalls/finishing undefined না) সেগুলোই রো হিসেবে
    // দেখানো হয়, বাকিরা টেবিল থেকে বাদ (শূন্য রো দিয়ে ভরাট না করে)।
    const masonryRows = archFloors
      .filter((q) => q.masonryWalls && q.masonryWalls.length > 0)
      .map((q) => {
        const vol = summarizeMasonryVolumes(q.masonryWalls!)
        return [q.floorLabel, formatQty(vol.externalWallVolumeM3), formatQty(vol.internalWallVolumeM3), formatQty(vol.parapetWallVolumeM3), formatQty(vol.totalMasonryVolumeM3)]
      })
    if (masonryRows.length > 0) {
      y = drawSectionTitle(doc, 'Masonry Volume (per floor)', y, reportMeta)
      y = drawPdfTable(doc, y, [['Floor', 'External (m³)', 'Internal (m³)', 'Parapet (m³)', 'Total (m³)']], masonryRows)
    }

    const finishingRows = archFloors
      .filter((q) => q.finishing !== undefined)
      .map((q) => {
        const sqm = convertFinishingToSqm(q.finishing!)
        return [
          q.floorLabel,
          formatQty(sqm.internalPlasterAreaSqm),
          formatQty(sqm.externalPlasterAreaSqm),
          formatQty(sqm.tilesAreaSqm),
          formatQty(sqm.paintAreaSqm),
          formatQty(sqm.ceilingAreaSqm),
          formatQty(sqm.waterproofingAreaSqm),
        ]
      })
    if (finishingRows.length > 0) {
      y = drawSectionTitle(doc, 'Finishing Area (per floor, m²)', y, reportMeta)
      y = drawPdfTable(doc, y, [['Floor', 'Plaster (Int)', 'Plaster (Ext)', 'Tiles', 'Paint', 'Ceiling', 'Waterproof']], finishingRows)
    }
  }

  if (context.takeoff.structuralFloors.length > 0) {
    doc.addPage()
    y = drawPdfHeader(doc, reportMeta)
    y = drawSectionTitle(doc, 'Structural Quantities (per floor, calculated volume)', y, reportMeta)
    // ২০২৬-০৮-২০ যোগ — Stair Volume (m³) কলাম, RCC volume-এর পাশে।
    // এটা totalRccVolumeM3-এ ধরা নেই (boq.service.ts-এ আলাদা "RCC
    // (Stair)" লাইন-আইটেম হিসেবে যোগ হয়, ডবল-কাউন্ট এড়াতে) — তাই
    // এই কলামটা informational, এই টেবিলের কোনো যোগফলে অংশ নেয় না।
    const structHead = [['Floor', 'Footing (m³)', 'Column (m³)', 'Beam (m³)', 'Slab (m³)', 'Stair Vol. (m³)', 'Stairs (nos)', 'Reinforcement (kg)']]
    const structBody = structFloors.map(({ q, vol }) => [
      q.floorLabel,
      formatQty(vol.footingVolumeM3),
      formatQty(vol.columnVolumeM3),
      formatQty(vol.beamVolumeM3),
      formatQty(vol.slabVolumeM3),
      formatQty(getStairVolumeM3(q.stairDimensions)),
      String(q.stairQuantity),
      formatQty(q.reinforcementQuantityKg),
    ])
    y = drawPdfTable(doc, y, structHead, structBody)

    // ২০২৬-০৮-২০ যোগ — Earthwork আলাদা টেবিল, শুধু যেসব floor-এ
    // earthwork ডেটা আছে (সাধারণত শুধু ground floor)।
    const earthworkRows = structFloors
      .filter(({ q }) => q.earthwork !== undefined)
      .map(({ q }) => {
        const vol = calculateEarthworkVolumes(q.earthwork!)
        return [q.floorLabel, formatQty(vol.excavationVolumeM3), formatQty(vol.backfillVolumeM3), formatQty(vol.disposalVolumeM3)]
      })
    if (earthworkRows.length > 0) {
      y = drawSectionTitle(doc, 'Earthwork Volume (per floor)', y, reportMeta)
      y = drawPdfTable(doc, y, [['Floor', 'Excavation (m³)', 'Backfill (m³)', 'Disposal (m³)']], earthworkRows)
    }
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
