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

const MEASUREMENT_RULES = [
  'কংক্রিট (RCC/PCC) — নেট volume (m³), formwork-এর জন্য আলাদা কোনো deduction করা হয় না।',
  'Brick Work — gross wall area থেকে door/window opening (0.1 m² এর বেশি) deduct করে, thickness অনুযায়ী volume (m³)।',
  'Plaster/Paint/Tiles — সারফেস area (m²), opening deduct করা থাকলে তা Masonry-এর মতোই wall segment-level এ ধরা।',
  'Reinforcement — kg এককে, cutting length × unit weight × (1 + wastage%), BBS (Module 7) অনুযায়ী।',
  'Earthwork — excavation volume থেকে backfill/disposal percentage-ভিত্তিক ভাগ (নেট measurement)।',
]

const ASSUMPTIONS = [
  'সব rate 1st-party (নিজস্ব) survey/procurement অনুযায়ী — কোনো সরকারি Schedule of Rates (SOR) সরাসরি reference করা হয়নি, যদি না Material/Rate entry-র নোটে উল্লেখ থাকে।',
  'Overhead ও Profit percentage Project Settings (Hub)-এ নির্ধারিত মান অনুযায়ী, প্রতিটা BOQ item-এর rate-এ সমানভাবে প্রযোজ্য।',
  'VAT/Tax আলাদা reporting-এ দেখানো হয় (Cost Report-এর বাইরে), Total Project Cost-এ pre-tax মান দেখানো হয়েছে।',
  'যেসব BOQ item-এর Rate Analysis এখনো সম্পূর্ণ হয়নি, সেগুলোর cost এই estimate-এ শূন্য ধরা হয়েছে (Cost Report-এ আলাদাভাবে চিহ্নিত)।',
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
