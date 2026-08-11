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
import { drawBOQReportBody } from '@/lib/pdf/boq-report.pdf'
import { drawQuantityReportBody } from '@/lib/pdf/quantity-report.pdf'
import { drawCostReportBody } from '@/lib/pdf/cost-report.pdf'
import { drawMaterialReportBody } from '@/lib/pdf/material-report.pdf'
import { drawBBSReportBody } from '@/lib/pdf/bbs-report.pdf'
import { drawTenderReportBody } from '@/lib/pdf/tender-report.pdf'
import { drawCalculationSheetBody } from '@/lib/pdf/calculation-sheet.pdf'
import {
  drawPdfHeader,
  drawPdfFooter,
  drawCoverPage,
  drawTableOfContents,
  downloadPdf,
  buildReportFilename,
  PdfReportMeta,
} from '@/lib/pdf/pdf-shared'

export interface MasterReportContext {
  availability: ReportsAvailability
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
}

// REPORT_KINDS-এর (ReportsPanel.tsx) একই ক্রম অনুসরণ করা হয়েছে,
// যাতে TOC-এর section-অর্ডার আর প্যানেলের বাটন-অর্ডার সামঞ্জস্যপূর্ণ
// থাকে।
const SECTION_DEFS: SectionDef[] = [
  { key: 'boq', label: 'Bill of Quantities (BOQ)' },
  { key: 'quantity', label: 'Quantity Report' },
  { key: 'cost', label: 'Cost Report' },
  { key: 'material', label: 'Material Report' },
  { key: 'bbs', label: 'Bar Bending Schedule (BBS)' },
  { key: 'tender', label: 'Tender Report' },
  { key: 'calculationSheet', label: 'Detailed Calculation Sheet' },
]

export function generateMasterReportPdf(context: MasterReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): jsPDF {
  const reportMeta = { ...meta, reportTitle: 'Full Project Report' }
  const availableSections = SECTION_DEFS.filter((s) => context.availability[s.key])

  const doc = new jsPDF()

  if (availableSections.length === 0) {
    drawCoverPage(doc, reportMeta, { subtitle: 'No data available yet in any module' })
    doc.addPage()
    const y = drawPdfHeader(doc, reportMeta)
    doc.setFontSize(10)
    doc.text('No report sections have data yet — complete at least one module (BOQ, Quantity Takeoff, etc.) first.', 14, y, {
      maxWidth: doc.internal.pageSize.getWidth() - 28,
    })
    drawPdfFooter(doc)
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

  availableSections.forEach((section) => {
    // প্রতিটা section-এর orientation স্পষ্টভাবে বলে দেওয়া হচ্ছে —
    // jsPDF-এ doc.addPage() argument ছাড়া কল করলে আগের পাতার
    // orientation inherit করে, portrait-এ auto-reset হয় না। তাই
    // BBS (landscape) section-এর ঠিক পরের section ভুলভাবে landscape
    // হয়ে যাওয়া এড়াতে প্রতিটা addPage()-এ explicit 'a4'+orientation
    // দেওয়া হচ্ছে, কোনো implicit inheritance-এর উপর নির্ভর না করে।
    const orientation = section.key === 'bbs' ? 'landscape' : 'portrait'
    doc.addPage('a4', orientation)
    sectionStartPages[section.key] = doc.getNumberOfPages()
    const y = drawPdfHeader(doc, { ...reportMeta, reportTitle: section.label })

    switch (section.key) {
      case 'boq':
        drawBOQReportBody(doc, context.boq, y, { ...reportMeta, reportTitle: section.label })
        break
      case 'quantity':
        drawQuantityReportBody(doc, context.quantity, y, { ...reportMeta, reportTitle: section.label })
        break
      case 'cost':
        drawCostReportBody(doc, context.cost, y, { ...reportMeta, reportTitle: section.label })
        break
      case 'material':
        drawMaterialReportBody(doc, context.material, y, { ...reportMeta, reportTitle: section.label })
        break
      case 'bbs':
        drawBBSReportBody(doc, context.bbs, y, { ...reportMeta, reportTitle: section.label })
        break
      case 'tender':
        drawTenderReportBody(doc, context.tender, y, { ...reportMeta, reportTitle: section.label })
        break
      case 'calculationSheet':
        drawCalculationSheetBody(doc, context.calculationSheet, y, { ...reportMeta, reportTitle: section.label })
        break
    }
  })

  // ── TOC পাতায় ফিরে গিয়ে entries বসানো ──
  doc.setPage(tocPageNumber)
  drawTableOfContents(
    doc,
    availableSections.map((s) => ({ label: s.label, pageNumber: sectionStartPages[s.key] }))
  )

  drawPdfFooter(doc, { startPage: 2 })
  return doc
}

export function downloadMasterReportPdf(context: MasterReportContext, meta: Omit<PdfReportMeta, 'reportTitle'>): void {
  const doc = generateMasterReportPdf(context, meta)
  downloadPdf(doc, buildReportFilename('Full_Project_Report', meta.projectName, meta.generatedAt))
}
