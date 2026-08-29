// lib/pdf/master-report.pdf.ts
//
// Module 13 — Master ("Full Project Report") PDF export। প্রতিটা
// আলাদা report (BOQ/Quantity/Cost/Material/BBS/Tender)-এর
// drawXxxReportBody() reuse করে একটা single PDF-এ সব section একসাথে
// বসানো হয় — cover page + table-of-contents + section-wise page
// break সহ। কোনো section-এর ডেটা না থাকলে (checkReportsAvailability
// অনুযায়ী) সেটা এই Master Report থেকে বাদ পড়ে, "no data" প্লেসহোল্ডার
// পাতা যোগ করা হয় না — শুধু available section-গুলো নিয়ে একটা
// পরিষ্কার document তৈরি হয়।
//
// ⚠️ Orientation: BBS section landscape (column-ভারী table), বাকি
// সব section portrait। jsPDF প্রতিটা doc.addPage(format, orientation)
// কলে আলাদা orientation নিতে পারে (পুরো doc-এর orientation একটাই
// থাকতে হয় না), তাই এই ফাইল BBS section-এ ঢোকার সময়/বের হওয়ার সময়
// সুস্পষ্টভাবে orientation switch করে।
//
// Material Report project-scoped না (organization-wide), কিন্তু এই
// Master Report project-context থেকে জেনারেট হয় বলে সেটাও একটা
// section হিসেবে অন্তর্ভুক্ত — একই সীমাবদ্ধতা material-report.pdf.ts-এও
// আছে (সব প্রজেক্টে একই material list দেখাবে)।

import jsPDF from 'jspdf'
import {
  EstimateBasisContext,
  BOQReportContext,
  QuantityReportContext,
  CostReportContext,
  MaterialReportContext,
  BBSReportContext,
  TenderReportContext,
  CalculationSheetReportContext,
  ReportsAvailability,
} from '@/lib/services/reports.service'
import { calculateBBSRows } from '@/lib/services/reinforcement.service'
import { drawEstimateBasisBody } from '@/lib/pdf/estimate-basis.pdf'
import { drawBOQReportBody } from '@/lib/pdf/boq-report.pdf'
import { drawQuantityReportBody } from '@/lib/pdf/quantity-report.pdf'
import { drawCostReportBody } from '@/lib/pdf/cost-report.pdf'
import { drawMaterialReportBody } from '@/lib/pdf/material-report.pdf'
import { drawBBSReportBody } from '@/lib/pdf/bbs-report.pdf'
import { drawTenderReportBody } from '@/lib/pdf/tender-report.pdf'
import { drawCalculationSheetBody } from '@/lib/pdf/calculation-sheet.pdf'
import {
  drawSidebar,
  drawPdfFooter,
  drawCoverPage,
  drawTableOfContents,
  downloadPdf,
  buildReportFilename,
  PdfReportMeta,
} from '@/lib/pdf/pdf-shared'

export interface MasterReportContext {
  availability: ReportsAvailability
  estimateBasis: EstimateBasisContext
  boq: BOQReportContext
  quantity: QuantityReportContext
  cost: CostReportContext
  material: MaterialReportContext
  bbs: BBSReportContext
  tender: TenderReportContext
  calculationSheet: CalculationSheetReportContext
}

interface SectionDef {
  key: keyof ReportsAvailability
  label: string
  /** sidebar-এর REPORT TYPE ব্লকে সঠিক লেবেল বসাতে — প্রতিটা section আসলে যে standalone report-এর অংশ, তারই reportKind (PDF_REPORT_KIND_LABEL, pdf-shared.ts)। */
  reportKind: string
}

// REPORT_KINDS-এর (ReportsPanel.tsx) একই ক্রম অনুসরণ করা হয়েছে,
// যাতে TOC-এর section-অর্ডার আর প্যানেলের বাটন-অর্ডার সামঞ্জস্যপূর্ণ
// থাকে। estimateBasis সবচেয়ে আগে — cover sheet-এর ঠিক পরে narrative
// context আসাই স্বাভাবিক document flow (BOQ/Quantity/Cost-এর আগে,
// কারণ এই সেকশনগুলো estimateBasis-এ বর্ণিত rate/assumption-এর
// ভিত্তিতে তৈরি)।
const SECTION_DEFS: SectionDef[] = [
  { key: 'estimateBasis', label: 'Estimate Basis', reportKind: 'Estimate_Basis_Report' },
  { key: 'boq', label: 'Bill of Quantities (BOQ)', reportKind: 'BOQ_Report' },
  { key: 'quantity', label: 'Quantity Report', reportKind: 'Quantity_Report' },
  { key: 'cost', label: 'Cost Report', reportKind: 'Cost_Report' },
  { key: 'material', label: 'Material Report', reportKind: 'Material_Report' },
  { key: 'bbs', label: 'Bar Bending Schedule (BBS)', reportKind: 'BBS_Report' },
  { key: 'tender', label: 'Tender Report', reportKind: 'Tender_Report' },
  { key: 'calculationSheet', label: 'Detailed Calculation Sheet', reportKind: 'Calculation_Sheet' },
]

export function generateMasterReportPdf(context: MasterReportContext, meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>): jsPDF {
  const reportMeta: PdfReportMeta = { ...meta, reportTitle: 'Full Project Report', reportKind: 'Master_Report' }
  const availableSections = SECTION_DEFS.filter((s) => context.availability[s.key])

  const doc = new jsPDF()

  if (availableSections.length === 0) {
    drawCoverPage(doc, reportMeta, { subtitle: 'No data available yet in any module' })
    doc.addPage()
    const y = drawSidebar(doc, reportMeta, { sheetNumber: 'MST-1', sheetTitle: reportMeta.reportTitle })
    doc.setFontSize(10)
    doc.text('No report sections have data yet — complete at least one module (BOQ, Quantity Takeoff, etc.) first.', 14, y, {
      maxWidth: doc.internal.pageSize.getWidth() - 28,
    })
    drawPdfFooter(doc, { reportMeta })
    return doc
  }

  // ── Cover page ──
  drawCoverPage(doc, reportMeta, {
    subtitle: `${availableSections.length} of ${SECTION_DEFS.length} sections included`,
  })

  // ── Table of contents — page numbers প্রি-কম্পিউট করা হচ্ছে না
  // (প্রতিটা section কত পাতা লাগবে তা content-নির্ভর, আগে থেকে
  // জানা যায় না); বরং প্রতিটা section শুরুর আগে doc.getNumberOfPages()+1
  // দিয়ে actual page number রেকর্ড করে TOC পাতায় ফিরে গিয়ে বসানো
  // হচ্ছে (jsPDF-এ doc.setPage() দিয়ে আগের পাতায় ফিরে টেক্সট বসানো
  // সম্ভব, তারপর আবার শেষ পাতায় ফিরে content চালিয়ে যাওয়া যায়) ──
  doc.addPage()
  const tocPageNumber = doc.getNumberOfPages()
  // TOC-এর পাতা এখন খালি রাখা হচ্ছে; নিচে সব section আঁকা শেষ হলে
  // page-number জানার পর এই পাতায় ফিরে এসে বসানো হবে।

  const sectionStartPages: Record<string, number> = {}

  availableSections.forEach((section, index) => {
    // প্রতিটা section-এর orientation স্পষ্টভাবে বলে দেওয়া হচ্ছে —
    // jsPDF-এ doc.addPage() argument ছাড়া কল করলে আগের পাতার
    // orientation inherit করে, portrait-এ auto-reset হয় না। তাই
    // BBS (landscape) section-এর ঠিক পরের section ভুলভাবে landscape
    // হয়ে যাওয়া এড়াতে প্রতিটা addPage()-এ explicit 'a4'+orientation
    // দেওয়া হচ্ছে, কোনো implicit inheritance-এর উপর নির্ভর না করে।
    //
    // ── Sidebar landscape guard (2026-08-26) ──────────────────────
    // drawSidebar()-এর ২০-ব্লক sidebar A4 landscape-এ পুরো height
    // জুড়ে বসতে পারে না (ReportPage.tsx-এর guard-এর একই কারণ,
    // EngineX-Structural-এ verified) — কিন্তু এখানে BBS section
    // ইচ্ছাকৃতভাবে landscape (column-ভারী table)। তাই BBS section-এর
    // জন্য 'a4' এর বদলে বড় page size ('a3') ব্যবহার করা হচ্ছে
    // landscape-এ যথেষ্ট height রাখতে — standalone bbs-report.pdf.ts
    // অবশ্য এখনো নিজে A4 landscape-ই ব্যবহার করে (এই একই ঝুঁকি সেখানেও
    // আছে, কিন্তু সেটা এই sidebar-unification কাজের একটা আলাদা,
    // পরবর্তী ফলো-আপ হিসেবে নোট করা হলো — bbs-report.pdf.ts-এর
    // নিজস্ব A4 landscape+sidebar কম্বিনেশন এখনো render-verify করা
    // হয়নি, শুধু typecheck হয়েছে)।
    const orientation = section.key === 'bbs' ? 'landscape' : 'portrait'
    const pageSize = section.key === 'bbs' ? 'a3' : 'a4'
    doc.addPage(pageSize, orientation)
    sectionStartPages[section.key] = doc.getNumberOfPages()
    const sectionMeta: PdfReportMeta = { ...reportMeta, reportTitle: section.label, reportKind: section.reportKind }
    const y = drawSidebar(doc, sectionMeta, { sheetNumber: `MST-${index + 1}`, sheetTitle: section.label })

    switch (section.key) {
      case 'estimateBasis':
        drawEstimateBasisBody(doc, context.estimateBasis, y, sectionMeta)
        break
      case 'boq':
        drawBOQReportBody(doc, context.boq, y, sectionMeta)
        break
      case 'quantity':
        drawQuantityReportBody(doc, context.quantity, y, sectionMeta)
        break
      case 'cost':
        drawCostReportBody(doc, context.cost, y, sectionMeta)
        break
      case 'material':
        drawMaterialReportBody(doc, context.material, y, sectionMeta)
        break
      case 'bbs':
        drawBBSReportBody(doc, context.bbs, y, sectionMeta)
        break
      case 'tender':
        drawTenderReportBody(doc, context.tender, y, sectionMeta)
        break
      case 'calculationSheet':
        drawCalculationSheetBody(doc, context.calculationSheet, y, sectionMeta)
        break
    }
  })

  // ── TOC পাতায় ফিরে গিয়ে entries বসানো ──
  doc.setPage(tocPageNumber)
  drawTableOfContents(
    doc,
    availableSections.map((s) => ({ label: s.label, pageNumber: sectionStartPages[s.key] }))
  )

  drawPdfFooter(doc, { startPage: 2, reportMeta })
  return doc
}

export function downloadMasterReportPdf(context: MasterReportContext, meta: Omit<PdfReportMeta, 'reportTitle' | 'reportKind'>): void {
  const doc = generateMasterReportPdf(context, meta)
  downloadPdf(doc, buildReportFilename('Full_Project_Report', meta.projectName, meta.generatedAt))
}
