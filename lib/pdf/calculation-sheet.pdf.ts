// lib/pdf/calculation-sheet.pdf.ts
//
// নতুন রিপোর্ট — "Detailed Calculation Sheet"। Rate Analysis
// (Module 4)-এর ডেটা থেকেই বানানো: প্রতিটা BOQ item-এর জন্য
// Material/Labour/Equipment-এর প্রতিটা লাইন (নাম, per-unit
// consumption, বর্তমান live rate, line cost), তারপর Subtotal →
// Overhead% → Profit% → Final Rate/unit → BOQ quantity দিয়ে গুণ করে
// Item Total — এই পুরো chain-টা visible রাখাই "detailed calculation
// sheet"-এর মূল উদ্দেশ্য (Cost Report-এর মতো শুধু grand-total না,
// প্রতিটা ধাপ কীভাবে বের হলো সেটাও)।
//
// calculateRateFromLoadedRates() পুনর্ব্যবহার করা হয়েছে (Rate
// Analysis service) — যাতে RateAnalysisPanel UI-তে যে finalRate
// দেখা যায় এবং Cost Report-এ যে grand total যোগ হয়, এই sheet-এর
// প্রতিটা item-এর finalRate ঠিক সেই একই সংখ্যা হয় (আলাদা hisab
// duplicate করা হয়নি)।

import jsPDF from 'jspdf'
import { CalculationSheetReportContext } from '@/lib/services/reports.service'
import {
  drawSidebar,
  drawPdfFooter,
  drawCoverPage,
  drawPdfTable,
  drawSectionTitle,
  drawStatCards,
  drawCalloutBox,
  downloadPdf,
  buildReportFilename,
  formatTaka,
  formatQty,
  sidebarRightMargin,
  PdfReportMeta,
  PDF_MUTED_COLOR,
} from '@/lib/pdf/pdf-shared'
import { BOQ_UNIT_LABELS } from '@/lib/types/boq.types'

export function drawCalculationSheetBody(
  doc: jsPDF,
  context: CalculationSheetReportContext,
  startY: number,
  reportMeta: PdfReportMeta
): number {
  let y = startY

  if (context.items.length === 0) {
    doc.setFontSize(10)
    doc.text(
      'No rate analysis data available yet — complete BOQ (Module 3) and Rate Analysis (Module 4) first.',
      14,
      y
    )
    return y + 8
  }

  // ── প্রজেক্ট-ওয়াইড সারাংশ (Cost Report-এর stat-card প্যাটার্ন
  // পুনর্ব্যবহার) — কতগুলো item, মোট প্রজেক্ট cost ──
  const grandTotal = context.items.reduce((sum, it) => sum + it.itemTotal, 0)
  y = drawSectionTitle(doc, 'Summary', y, reportMeta)
  y = drawStatCards(
    doc,
    [
      { label: 'BOQ Items Costed', value: String(context.items.length) },
      { label: 'Grand Total (all items)', value: formatTaka(grandTotal) },
    ],
    y,
    reportMeta
  )

  if (context.itemsWithoutRateAnalysis.length > 0) {
    y = drawCalloutBox(
      doc,
      [
        'Note: the following BOQ items have no Rate Analysis yet and are NOT included in this sheet:',
        ...context.itemsWithoutRateAnalysis.map((name) => `-  ${name}`),
      ],
      y,
      'warning',
      reportMeta
    )
  }

  // ── প্রতিটা item-এর জন্য নিজস্ব detailed breakdown — নতুন পাতা
  // থেকে শুরু (একটার calculation আরেকটার সাথে মিশে না যায়) ──
  context.items.forEach((item, index) => {
    doc.addPage()
    y = drawSidebar(doc, reportMeta, { sheetNumber: `CS-${index + 1}`, sheetTitle: item.boqItemName })

    y = drawSectionTitle(doc, `${index + 1}. ${item.boqItemName}`, y, reportMeta)

    doc.setFontSize(9)
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.text(
      `Unit: ${BOQ_UNIT_LABELS[item.unit] ?? item.unit}   |   BOQ Quantity: ${formatQty(item.quantity, 3)}`,
      14,
      y
    )
    y += 8

    if (item.materials.length > 0) {
      y = drawSectionTitle(doc, 'Material', y, reportMeta)
      y = drawPdfTable(
        doc,
        y,
        [['Material', 'Qty / unit', 'Rate (live)', 'Line Cost']],
        item.materials.map((m) => [
          m.name,
          `${formatQty(m.quantityPerUnit, 3)} ${m.unit}`,
          formatTaka(m.rate),
          formatTaka(m.lineCost),
        ]),
        { columnStyles: { 0: { cellWidth: 70 } }, rightMargin: sidebarRightMargin(doc) }
      )
    }

    if (item.labour.length > 0) {
      y = drawSectionTitle(doc, 'Labour', y, reportMeta)
      y = drawPdfTable(
        doc,
        y,
        [['Labour', 'Qty / unit', 'Rate (live)', 'Line Cost']],
        item.labour.map((l) => [
          l.name,
          `${formatQty(l.quantityPerUnit, 3)} ${l.unit}`,
          formatTaka(l.rate),
          formatTaka(l.lineCost),
        ]),
        { columnStyles: { 0: { cellWidth: 70 } }, rightMargin: sidebarRightMargin(doc) }
      )
    }

    if (item.equipment.length > 0) {
      y = drawSectionTitle(doc, 'Equipment', y, reportMeta)
      y = drawPdfTable(
        doc,
        y,
        [['Equipment', 'Qty / unit', 'Rate (live)', 'Line Cost']],
        item.equipment.map((e) => [
          e.name,
          `${formatQty(e.quantityPerUnit, 3)} ${e.unit}`,
          formatTaka(e.rate),
          formatTaka(e.lineCost),
        ]),
        { columnStyles: { 0: { cellWidth: 70 } }, rightMargin: sidebarRightMargin(doc) }
      )
    }

    // ── চূড়ান্ত ধাপে-ধাপে হিসাব — Subtotal → Overhead → Profit →
    // Final Rate/unit → × Quantity = Item Total। এই chain-টাই মূল
    // "calculation sheet" — Cost Report-এ শুধু grand summary card
    // দেখা যায়, এখানে প্রতিটা ধাপ আলাদা লাইনে ──
    y = drawSectionTitle(doc, 'Rate Build-up', y, reportMeta)
    y = drawStatCards(
      doc,
      [
        { label: 'Material', value: formatTaka(item.breakdown.materialCost) },
        { label: 'Labour', value: formatTaka(item.breakdown.labourCost) },
        { label: 'Equipment', value: formatTaka(item.breakdown.equipmentCost) },
      ],
      y,
      reportMeta
    )
    y = drawStatCards(
      doc,
      [
        { label: 'Subtotal', value: formatTaka(item.breakdown.subtotal) },
        { label: `Overhead (${item.overheadPercent}%)`, value: formatTaka(item.breakdown.overheadAmount) },
        { label: `Profit (${item.profitPercent}%)`, value: formatTaka(item.breakdown.profitAmount) },
      ],
      y,
      reportMeta
    )
    y = drawStatCards(
      doc,
      [
        { label: `Final Rate / ${BOQ_UNIT_LABELS[item.unit] ?? item.unit}`, value: formatTaka(item.breakdown.finalRate) },
        { label: 'BOQ Quantity', value: formatQty(item.quantity, 3) },
        { label: 'Item Total', value: formatTaka(item.itemTotal) },
      ],
      y,
      reportMeta
    )

    if (item.warnings.length > 0) {
      y = drawCalloutBox(doc, item.warnings, y, 'warning', reportMeta)
    }
  })

  return y
}

export function generateCalculationSheetPdf(
  context: CalculationSheetReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' })
  const reportMeta: PdfReportMeta = { ...meta, reportTitle: 'Detailed Calculation Sheet', reportKind: 'Calculation_Sheet' }

  if (context.items.length === 0) {
    const y = drawSidebar(doc, reportMeta, { sheetNumber: 'CS-1', sheetTitle: reportMeta.reportTitle })
    drawCalculationSheetBody(doc, context, y, reportMeta)
    drawPdfFooter(doc, { reportMeta })
    return doc
  }

  drawCoverPage(doc, reportMeta, { subtitle: `${context.items.length} BOQ items — itemwise rate build-up` })

  doc.addPage()
  const y = drawSidebar(doc, reportMeta, { sheetNumber: 'CS-1', sheetTitle: reportMeta.reportTitle })
  drawCalculationSheetBody(doc, context, y, reportMeta)

  drawPdfFooter(doc, { startPage: 2, reportMeta })
  return doc
}

export function downloadCalculationSheetPdf(
  context: CalculationSheetReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>
): void {
  const doc = generateCalculationSheetPdf(context, meta)
  downloadPdf(doc, buildReportFilename('Calculation_Sheet', meta.projectName, meta.generatedAt))
}
