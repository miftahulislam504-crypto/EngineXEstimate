// lib/pdf/material-report.pdf.ts
//
// Module 13 — Material Report PDF। Module 5-এর organization-wide
// Material list (project-scoped না) — currentRate ও last-updated
// দেখানো হয়, price history পুরোটা না (সেটা আলাদা, বড় হতে পারে;
// এই report শুধু বর্তমান অবস্থার snapshot)।
//
// ── Phase 4 আপগ্রেড ──────────────────────────────────────────────
// cover page, category-wise grouping (MaterialCategory একটা true
// bounded union — material.types.ts দ্রষ্টব্য — তাই এই grouping
// ডেটাতে সত্যিই বিদ্যমান, BOQ Report-এর মতো বানানো category না),
// প্রতিটা category-র জন্য আলাদা section+subtotal। Price-trend/
// history ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে — PriceHistoryEntry আলাদা
// per-material Firestore subcollection-এ থাকে
// (materials/{id}/priceHistory), সেটা এখানে টানতে গেলে প্রতিটা
// material-এর জন্য আলাদা query লাগত (N+1 fetch), যা বড় material
// list-এ ধীর হয়ে যেত — reports.service.ts-এর buildMaterialReportContext()
// এখনো সেটা fetch করে না, তাই এই ফাইলেও যোগ করা হয়নি।

import jsPDF from 'jspdf'
import { MaterialReportContext } from '@/lib/services/reports.service'
import { Material, MaterialCategory } from '@/lib/types/material.types'
import {
  drawPdfHeader,
  drawPdfFooter,
  drawCoverPage,
  drawPdfTable,
  drawSectionTitle,
  drawStatCards,
  downloadPdf,
  buildReportFilename,
  formatTaka,
  PdfReportMeta,
  PDF_CHART_PALETTE,
} from '@/lib/pdf/pdf-shared'

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

// UI-তে সাধারণত এই ক্রমেই material category দেখানো হয় (original
// doc-এর উদাহরণ তালিকা অনুসরণ করে) — group-ভিত্তিক রিপোর্টে এলোমেলো
// object-key-order-এর বদলে এই স্থির ক্রম ব্যবহার করা হচ্ছে।
const CATEGORY_ORDER: MaterialCategory[] = ['cement', 'sand', 'stone', 'rebar', 'brick', 'tiles', 'paint', 'other']

function drawMaterialsTable(doc: jsPDF, y: number, materials: Material[]): number {
  const head = [['Material', 'Brand', 'Unit', 'Current Rate', 'Last Updated']]
  const body = materials
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => [
      m.name,
      m.brand ?? '—',
      m.unit,
      formatTaka(m.currentRate),
      new Date(m.lastUpdatedAt).toLocaleDateString('en-US'),
    ])
  return drawPdfTable(doc, y, head, body, { columnStyles: { 0: { cellWidth: 60 } } })
}

export function drawMaterialReportBody(doc: jsPDF, context: MaterialReportContext, startY: number, reportMeta: PdfReportMeta): number {
  let y = startY

  if (context.materials.length === 0) {
    doc.setFontSize(10)
    doc.text('No active materials found in the Material Database yet.', 14, y)
    return y + 8
  }

  const byCategory = new Map<string, Material[]>()
  for (const m of context.materials) {
    const list = byCategory.get(m.category) ?? []
    list.push(m)
    byCategory.set(m.category, list)
  }
  const orderedCategories = CATEGORY_ORDER.filter((c) => byCategory.has(c))

  y = drawSectionTitle(doc, 'Category Overview', y, reportMeta)
  const overviewCards = orderedCategories.slice(0, 4).map((cat, i) => ({
    label: CATEGORY_LABELS[cat] ?? cat,
    value: String(byCategory.get(cat)!.length),
    accent: PDF_CHART_PALETTE[i % PDF_CHART_PALETTE.length],
  }))
  if (overviewCards.length > 0) {
    y = drawStatCards(doc, overviewCards, y, reportMeta)
  }
  if (orderedCategories.length > 4) {
    const restCards = orderedCategories.slice(4, 8).map((cat, i) => ({
      label: CATEGORY_LABELS[cat] ?? cat,
      value: String(byCategory.get(cat)!.length),
      accent: PDF_CHART_PALETTE[(i + 4) % PDF_CHART_PALETTE.length],
    }))
    y = drawStatCards(doc, restCards, y, reportMeta)
  }
  y += 2

  orderedCategories.forEach((cat, i) => {
    const items = byCategory.get(cat)!
    // প্রতিটা category section নতুন পাতায় শুরু (প্রথমটা বাদে,
    // যেটা overview-এর পরপরই একই পাতায় শুরু হবে যদি জায়গা থাকে)
    if (i > 0) {
      doc.addPage()
      y = drawPdfHeader(doc, reportMeta)
    }
    y = drawSectionTitle(doc, `${CATEGORY_LABELS[cat] ?? cat} (${items.length})`, y, reportMeta)
    y = drawMaterialsTable(doc, y, items)
  })

  return y
}

export function generateMaterialReportPdf(
  context: MaterialReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle'>
): jsPDF {
  const doc = new jsPDF()
  const reportMeta = { ...meta, reportTitle: 'Material Report' }

  if (context.materials.length === 0) {
    const y = drawPdfHeader(doc, reportMeta)
    drawMaterialReportBody(doc, context, y, reportMeta)
    drawPdfFooter(doc)
    return doc
  }

  const categoryCount = new Set(context.materials.map((m) => m.category)).size
  drawCoverPage(doc, reportMeta, {
    subtitle: `${context.materials.length} active materials across ${categoryCount} categories`,
  })

  doc.addPage()
  const y = drawPdfHeader(doc, reportMeta)
  drawMaterialReportBody(doc, context, y, reportMeta)

  drawPdfFooter(doc, { startPage: 2 })
  return doc
}

export function downloadMaterialReportPdf(
  context: MaterialReportContext,
  meta: Omit<PdfReportMeta, 'reportTitle'>
): void {
  const doc = generateMaterialReportPdf(context, meta)
  downloadPdf(doc, buildReportFilename('Material_Report', meta.projectName, meta.generatedAt))
}
