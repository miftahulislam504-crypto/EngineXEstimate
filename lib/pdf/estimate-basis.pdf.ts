// lib/pdf/estimate-basis.pdf.ts
//
// Module 13 — Estimate Basis PDF export। ２０２৬-０８-２০ যোগ (audit gap:
// "Cover Sheet, Project Info, Measurement Rules, Schedule of Rates,
// Material/Labour/Equipment Rate source, Assumptions — কোনো
// narrative Estimate Basis পৃষ্ঠা নেই কোনো রিপোর্টে")।
//
// এই রিপোর্টে কোনো নতুন calculation নেই — reports.service.ts-এর
// buildEstimateBasisContext() ইতিমধ্যেই সিস্টেমে থাকা ডেটা
// (hub-native-sync.ts থেকে sync হওয়া buildingInfo/bnbcSettings/
// projectSettings, ও Material/Rate library-র count) একত্র করে,
// এখানে শুধু সেটা একটা narrative/presentational লে-আউটে বসানো
// হয়েছে।
//
// Measurement Rules ও Assumptions সেকশন-দুটো ফিক্সড টেক্সট (দেশীয়
// নির্মাণ শিল্পে প্রচলিত, BNBC-ভিত্তিক measurement convention) —
// প্রজেক্ট-নির্দিষ্ট কোনো ডেটা এই দুটোর উৎস না, কারণ Estimating
// app-এর কোনো module-এ এখনো এই ধরনের প্রজেক্ট-নির্দিষ্ট override
// সংরক্ষণের জায়গা নেই। ভবিষ্যতে Project Settings-এ একটা
// "Assumptions" free-text field যোগ হলে এখানে সরাসরি সেটা টেনে
// আনা যাবে — আপাতত standard practice-ভিত্তিক বয়ান।

import jsPDF from 'jspdf'
import { EstimateBasisContext } from '@/lib/services/reports.service'
import {
  drawSidebar,
  drawPdfFooter,
  drawCoverPage,
  drawSectionTitle,
  drawSummaryLine,
  drawCalloutBox,
  downloadPdf,
  buildReportFilename,
  PdfReportMeta,
} from '@/lib/pdf/pdf-shared'

// এই দুই array ইচ্ছাকৃতভাবে ইংরেজিতে — bn UI-তেও, কারণ pdf-shared.ts
// জুড়ে doc.setFont('helvetica', ...) ব্যবহৃত হয়, যেটা built-in
// jsPDF ফন্ট এবং শুধু Latin/ASCII glyph সাপোর্ট করে। এখানে আগে
// বাংলা টেক্সট ছিল, যা garbled bytes হয়ে রেন্ডার হচ্ছিল (দেখুন
// PDF-এর নিজস্ব "Known limitation" ব্যানার — pdf-shared.ts-এর সেই
// ব্যানার-টেক্সটই একমাত্র জায়গা যেখানে বাংলা রাখা নিরাপদ, কারণ
// সেটা PDF-এ না, শুধু ওয়েব UI-তে রেন্ডার হয়)। Bengali Unicode font
// (যেমন Noto Sans Bengali) doc.addFont() দিয়ে embed করার পরই এই
// দুই array বাংলায় ফেরানো উচিত — তার আগে না।
const MEASUREMENT_RULES = [
  'Concrete (RCC/PCC) — net volume (m³); no separate deduction is made for formwork.',
  'Brick Work — gross wall area minus door/window openings (over 0.1 m²), volume (m³) by thickness.',
  'Plaster/Paint/Tiles — surface area (m²); openings are deducted at the same wall-segment level as Masonry.',
  'Reinforcement — in kg, cutting length × unit weight × (1 + wastage%), as per BBS (Module 7).',
  'Earthwork — excavation volume split by backfill/disposal percentage (net measurement).',
]

const ASSUMPTIONS = [
  'All rates are 1st-party (own) survey/procurement based — no government Schedule of Rates (SOR) is directly referenced unless noted in the Material/Rate entry.',
  'Overhead and Profit percentages are as set in Project Settings (Hub), applied uniformly to every BOQ item rate.',
  'VAT/Tax is shown separately (outside the Cost Report) — the Total Project Cost shown is the pre-tax value.',
  'For BOQ items whose Rate Analysis is not yet complete, cost is taken as zero in this estimate (flagged separately in the Cost Report).',
]

export function drawEstimateBasisBody(doc: jsPDF, context: EstimateBasisContext, startY: number, reportMeta: PdfReportMeta): number {
  let y = startY
  const hub = context.hubImport

  // ── Project Info ──
  y = drawSectionTitle(doc, 'Project Information', y, reportMeta)
  if (hub) {
    y = drawSummaryLine(doc, 'Project Name', hub.projectName || '—', y, reportMeta)
    y = drawSummaryLine(doc, 'Project Code', hub.projectCode || '—', y, reportMeta)
    if (hub.buildingInfo) {
      const b = hub.buildingInfo
      y = drawSummaryLine(doc, 'Building Type', `${b.buildingType} (${b.usageType})`, y, reportMeta)
      y = drawSummaryLine(doc, 'Structural System', b.structureSystem, y, reportMeta)
      y = drawSummaryLine(doc, 'Number of Floors', `${b.numFloors}${b.basementCount > 0 ? ` (+${b.basementCount} basement)` : ''}`, y, reportMeta)
      y = drawSummaryLine(doc, 'Total Height', `${b.totalHeight} ft`, y, reportMeta)
      if (b.totalFloorArea) {
        y = drawSummaryLine(doc, 'Total Floor Area', `${b.totalFloorArea} sqft`, y, reportMeta)
      }
    }
    if (hub.bnbcSettings) {
      const s = hub.bnbcSettings
      y = drawSummaryLine(doc, 'Occupancy Type', s.occupancyType, y, reportMeta)
      y = drawSummaryLine(doc, 'Seismic Zone', s.seismicZone, y, reportMeta)
      y = drawSummaryLine(doc, 'Wind Zone', s.windZone, y, reportMeta)
      y = drawSummaryLine(doc, 'Live Load', `${s.liveLoadValue} kN/m² (${s.liveLoadType})`, y, reportMeta)
      y = drawSummaryLine(doc, 'Soil Type', s.soilType, y, reportMeta)
    }
    if (!hub.buildingInfo && !hub.bnbcSettings) {
      y = drawCalloutBox(doc, ['Building/BNBC information has not synced from Hub yet.'], y, 'warning', reportMeta)
    }
  } else {
    y = drawCalloutBox(
      doc,
      ['No data has synced from CivilOS Hub yet for this project — Project Info/BNBC section is empty until Hub sync completes.'],
      y,
      'warning',
      reportMeta
    )
  }
  y += 2

  // ── Schedule of Rates / Rate Source ──
  y = drawSectionTitle(doc, 'Schedule of Rates & Rate Source', y, reportMeta)
  y = drawSummaryLine(doc, 'Active Materials (Rate Library)', String(context.activeMaterialCount), y, reportMeta)
  y = drawSummaryLine(doc, 'Active Labour Rates', String(context.labourRateCount), y, reportMeta)
  y = drawSummaryLine(doc, 'Active Equipment Rates', String(context.equipmentRateCount), y, reportMeta)
  y = drawSummaryLine(doc, 'BOQ Line Items', String(context.boqItemCount), y, reportMeta)
  y = drawCalloutBox(
    doc,
    [
      'Rate source: project-specific market survey / procurement quotation entered manually in the Material & Rate Library (Module 5/6), not a government Schedule of Rates (SOR) unless otherwise noted against an individual item.',
    ],
    y,
    'info',
    reportMeta
  )
  y += 2

  if (hub?.projectSettings) {
    const ps = hub.projectSettings
    y = drawSectionTitle(doc, 'Overhead, Profit & Tax Basis', y, reportMeta)
    y = drawSummaryLine(doc, 'Currency', ps.currency, y, reportMeta)
    y = drawSummaryLine(doc, 'Overhead %', `${ps.overheadPercent}%`, y, reportMeta)
    y = drawSummaryLine(doc, 'Profit %', `${ps.profitPercent}%`, y, reportMeta)
    y = drawSummaryLine(doc, 'VAT %', `${ps.vatPercent}%`, y, reportMeta)
    y = drawSummaryLine(doc, 'Tax %', `${ps.taxPercent}%`, y, reportMeta)
    y = drawSummaryLine(doc, 'Contingency %', `${ps.contingencyPercent}%`, y, reportMeta)
    y += 2
  }

  // ── Measurement Rules ──
  doc.addPage()
  y = drawSidebar(doc, reportMeta, { sheetNumber: 'EB-2', sheetTitle: 'Measurement Rules & Assumptions' })
  y = drawSectionTitle(doc, 'Measurement Rules', y, reportMeta)
  MEASUREMENT_RULES.forEach((rule, i) => {
    y = drawCalloutBox(doc, [`${i + 1}. ${rule}`], y, 'info', reportMeta)
  })
  y += 2

  // ── Assumptions ──
  y = drawSectionTitle(doc, 'Assumptions', y, reportMeta)
  ASSUMPTIONS.forEach((assumption, i) => {
    y = drawCalloutBox(doc, [`${i + 1}. ${assumption}`], y, 'warning', reportMeta)
  })

  return y
}

export function generateEstimateBasisPdf(context: EstimateBasisContext, meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' })
  const reportMeta: PdfReportMeta = { ...meta, reportTitle: 'Estimate Basis', reportKind: 'Estimate_Basis_Report' }

  drawCoverPage(doc, reportMeta, {
    subtitle: context.hubImport ? `${context.hubImport.projectName}` : 'Estimate Basis & Assumptions',
  })

  doc.addPage()
  const y = drawSidebar(doc, reportMeta, { sheetNumber: 'EB-1', sheetTitle: reportMeta.reportTitle })
  drawEstimateBasisBody(doc, context, y, reportMeta)

  drawPdfFooter(doc, { startPage: 2, reportMeta })
  return doc
}

export function downloadEstimateBasisPdf(context: EstimateBasisContext, meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>): void {
  const doc = generateEstimateBasisPdf(context, meta)
  downloadPdf(doc, buildReportFilename('Estimate_Basis', meta.projectName, meta.generatedAt))
}
