// lib/pdf/pdf-shared.ts
//
// প্রতিটা report builder (boq/quantity/cost/material/bbs/tender)
// একই header/footer/table-style ব্যবহার করে, যাতে ৬টা PDF দেখতে
// একই পরিবারের document মনে হয় — আলাদা আলাদা component ৬ বার
// একই layout code লেখার বদলে এই একটা shared module।
//
// jsPDF + jspdf-autotable ব্যবহার করা হয়েছে (Reports & Export app-এ
// যা ব্যবহৃত হয়েছিল তার সাথে সামঞ্জস্যপূর্ণ পছন্দ), কারণ এটা pure
// client-side (কোনো server/Cloud Function লাগে না) এবং React-এর
// বাইরে থেকেও (এই ফাইলের মতো plain .ts module) ব্যবহারযোগ্য।
//
// ⚠️ বাংলা টেক্সট সীমাবদ্ধতা: jsPDF-এর built-in font-এ বাংলা
// ইউনিকোড glyph নেই (Latin-only)। ফলে UI যদি বাংলা mode-এ থাকে,
// তাহলেও এই মুহূর্তে PDF-এর লেবেল/হেডার ইংরেজিতেই থাকছে — bn label
// pass করলে glyph-না-থাকা box/প্রশ্নবোধক চিহ্ন হয়ে যেত, যেটা খালি
// বাক্সের চেয়েও খারাপ (fake output)। data value (নাম, নোট) যদি
// ব্যবহারকারী বাংলায় লেখেন সেগুলোও একই কারণে ঠিকভাবে render হবে না।
// এই সীমাবদ্ধতা প্রতিটা report-এর ভেতরে/UI-তে স্পষ্ট করে জানানো
// আছে (দেখুন ReportsPanel.tsx-এর bengaliPdfLimitationNote)। ভবিষ্যতে
// bn PDF দরকার হলে একটা বাংলা Unicode font (যেমন Noto Sans Bengali)
// jsPDF-এ addFont() দিয়ে embed করতে হবে — এই মুহূর্তে সেই font ফাইল
// bundle-এ নেই বলে করা হয়নি।
//
// ── Phase 1 (Professional report upgrade) ───────────────────────────
// এই ফাইলে যোগ হয়েছে: cover page, vector logo mark (Logo.tsx-এর
// SVG path-এর jsPDF সংস্করণ — কোনো raster PNG asset ছাড়াই, তাই
// Logo.tsx যে সমস্যা (public/logo.png প্রজেক্টে ছিলই না) এড়ানো
// যায়), watermark (DRAFT/FINAL), table-of-contents helper, এবং
// canvas-ভিত্তিক bar/pie chart helper (কোনো নতুন npm dependency
// ছাড়াই — Chart.js বা অন্য লাইব্রেরি যোগ করলে GitHub→Vercel push
// এর আগে npm লাগত, যা এই ecosystem-এর মোবাইল-first ওয়ার্কফ্লোর
// সাথে সাংঘর্ষিক; তাই plain <canvas> দিয়ে চার্ট এঁকে doc.addImage()
// দিয়ে বসানো হচ্ছে)। বাকি সব পুরনো helper (drawPdfHeader ইত্যাদি)
// অপরিবর্তিত আছে — builder ফাইলগুলো ভাঙবে না।

import jsPDF from 'jspdf'
import autoTable, { RowInput } from 'jspdf-autotable'

// jspdf-autotable v3 প্লাগইন runtime-এ doc.lastAutoTable attach করে,
// কিন্তু এই package-এর নিজস্ব .d.ts টাইপে সেটা declare করা নেই।
// তাই এখানে module augmentation দিয়ে jsPDF টাইপকে extend করা হচ্ছে,
// যাতে নিচের drawPdfTable ফাংশনে doc.lastAutoTable.finalY টাইপ-সেফভাবে
// ব্যবহার করা যায়।
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number
    }
  }
}

export const PDF_BRAND_COLOR: [number, number, number] = [67, 56, 202] // EngineX Quanta brand-700 ইন্ডিগো, globals.css টোকেনের সাথে সামঞ্জস্যপূর্ণ
export const PDF_BRAND_COLOR_LIGHT: [number, number, number] = [14, 165, 233] // brand gradient-এর cyan প্রান্ত (Logo.tsx-এর exq-grad stop)
export const PDF_MUTED_COLOR: [number, number, number] = [107, 114, 128]
export const PDF_WARN_COLOR: [number, number, number] = [180, 60, 20]
export const PDF_SUCCESS_COLOR: [number, number, number] = [22, 130, 90]

// একাধিক chart-এ ধারাবাহিকভাবে ব্যবহারের জন্য একটা ছোট categorical
// palette — brand color দিয়ে শুরু, তারপর দৃশ্যমানভাবে আলাদা করা
// যায় এমন রঙ (accessible bar/pie chart-এর জন্য যথেষ্ট contrast)।
export const PDF_CHART_PALETTE: [number, number, number][] = [
  [67, 56, 202], // indigo (brand)
  [14, 165, 233], // sky
  [22, 163, 74], // green
  [217, 119, 6], // amber
  [220, 38, 38], // red
  [147, 51, 234], // purple
  [8, 145, 178], // cyan-dark
  [107, 114, 128], // grey (fallback/other)
]

export interface PdfReportMeta {
  reportTitle: string // ইংরেজিতেই থাকবে, উপরের নোট দেখুন
  projectName: string
  projectCode?: string
  generatedAt: number
  // ── Cover page title-block (ঐচ্ছিক) ──────────────────────────────
  // Project.clientName/location থেকে আসে (project.types.ts)। আগে
  // কোনো report meta-তে এই দুটো ছিল না, শুধু projectName/projectCode
  // Hub import থেকে পাস হতো। ঐচ্ছিক রাখা হয়েছে যাতে পুরনো caller
  // (যারা এখনো শুধু projectName/projectCode/generatedAt পাস করে)
  // ভেঙে না যায় — না থাকলে cover page-এর title-block row-টা বাদ পড়ে।
  clientName?: string
  location?: string
  // ── Unified sheet-design sidebar (2026-08-26) ────────────────────
  // Project.status আছে (project.types.ts), কিন্তু কোনো বর্তমান caller
  // (ReportsPanel.tsx) এখনো এই মান pass করে না — pass করতে হলে
  // ReportsPanel-এর প্রপস-চেইন প্যারেন্ট পেজ পর্যন্ত থ্রেড করা লাগবে,
  // যেটা এই sidebar-unification কাজের সুযোগের বাইরে। তাই ঐচ্ছিক
  // রাখা হলো — না থাকলে STATUS ব্লকে honest "—" দেখাবে, invented
  // মান বসানো হবে না।
  status?: string
  // ── Sidebar sheet-numbering (2026-08-26) ─────────────────────────
  // buildReportFilename()-এর সাথে ব্যবহৃত reportKind-এর মতোই মান
  // (যেমন "BOQ_Report") — drawSidebar()-এর REPORT TYPE লেবেল এবং
  // continuation-page sheet-numbering (ensureSpace) দুটোতেই লাগে।
  reportKind: string
}

/**
 * Logo.tsx-এর SVG মার্কের jsPDF vector সংস্করণ — rounded-rect
 * ব্যাকগ্রাউন্ড (gradient-এর কাছাকাছি solid brand color, jsPDF-এর
 * vector API-তে true SVG gradient টানা যায় না বলে) + সাদা "Q" রিং
 * + টেইল + দুইটা bar-chart টিক। কোনো external image asset লাগে না,
 * তাই স্কেল করলেও ঝাপসা হয় না এবং bundle-এ কোনো ফাইল bundle করতে
 * হয় না।
 */
export function drawLogoMark(doc: jsPDF, x: number, y: number, size: number): void {
  const r = size * 0.28

  doc.setFillColor(...PDF_BRAND_COLOR)
  doc.roundedRect(x, y, size, size, r, r, 'F')

  const cx = x + size / 2
  const cy = y + size / 2
  const radius = size * 0.22

  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(size * 0.075)
  // "Q" রিং — প্রায়-সম্পূর্ণ বৃত্ত, ছোট ছোট line segment দিয়ে আঁকা
  // (jsPDF-এ arc-stroke সরাসরি নেই বলে lines() দিয়ে approximate)
  const startAngle = -40
  const endAngle = 270
  const steps = 24
  const points: number[] = []
  for (let i = 0; i <= steps; i++) {
    const angle = ((startAngle + ((endAngle - startAngle) * i) / steps) * Math.PI) / 180
    points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
  }
  for (let i = 0; i < points.length - 2; i += 2) {
    doc.line(points[i], points[i + 1], points[i + 2], points[i + 3])
  }
  // Q-এর টেইল
  const tailStart = {
    x: cx + radius * Math.cos((-15 * Math.PI) / 180),
    y: cy + radius * Math.sin((-15 * Math.PI) / 180),
  }
  doc.line(tailStart.x - size * 0.02, tailStart.y - size * 0.02, x + size * 0.78, y + size * 0.82)

  // ভেতরের bar-chart টিক
  doc.setFillColor(255, 255, 255)
  doc.rect(x + size * 0.39, y + size * 0.52, size * 0.06, size * 0.16, 'F')
  doc.rect(x + size * 0.5, y + size * 0.42, size * 0.06, size * 0.26, 'F')
}

/**
 * প্রতিটা report PDF-এর প্রতিটা পাতায় ডান পাশে বসানো MICON-স্টাইল
 * vertical sidebar (SHEET-DESIGN-SPEC.md অনুযায়ী, EngineXDraw/
 * EngineX-Structural-এর মতোই ~35% page width, ২০-ব্লক সিকোয়েন্স)।
 *
 * ── ল্যান্ডস্কেপে রূপান্তর (2026-08-26) ──────────────────────────
 * এই app-এর রিপোর্টগুলো মূলত লম্বা multi-column টেবিল (BOQ, Cost,
 * Quantity) — portrait A4-তে ডানে ৩৫% sidebar বসালে টেবিল-কলাম
 * অসম্ভব সংকীর্ণ হয়ে যেত। তাই সব রিপোর্ট এখন landscape A4-এ
 * (generateXxxReportPdf() গুলোতে `new jsPDF({ orientation:
 * 'landscape' })`), যেখানে sidebar আর table content-column দুটোই
 * আরামে বসে। drawPdfTable()-এর margin.right sidebar width-এর সাথে
 * মিলিয়ে বাড়ানো হয়েছে (নিচে দেখুন) যাতে টেবিল sidebar-এর নিচে গিয়ে
 * না ঢোকে।
 *
 * ── আগের drawPdfHeader() থেকে পার্থক্য ───────────────────────────
 * আগে প্রতিটা পাতার উপরে একটা horizontal strip header ছিল (logo +
 * title + project line + generated-at, তারপর একটা brand-color
 * underline)। এখন সেটার বদলে পুরো পাতা-height জুড়ে ডান পাশে একটা
 * bordered vertical strip — MICON রেফারেন্সের ঠিক যে কাঠামো
 * EngineXDraw/EngineX-Structural-এ implement হয়েছে। প্রতিটা page-এ
 * পুনরায় আঁকতে হয় (jsPDF-এ react-pdf-এর `fixed` prop-এর সমতুল্য কিছু
 * নেই), তাই caller-রা প্রতিটা doc.addPage()-এর পরে drawSidebar() আবার
 * কল করবে — ঠিক আগে drawPdfHeader() যেভাবে কল হতো।
 *
 * Returns the X position where the caller's body content should end
 * (i.e. the left edge of the sidebar) — callers use this as the
 * right-margin boundary for text/table width calculations instead of
 * assuming the full page width is available.
 */
// ── Sidebar width fix (2026-09-03) ────────────────────────────────
// আগে এটা 0.35 ছিল ("spec section 1 — same ratio as EngineXDraw/
// EngineX-Structural" ধরে নিয়ে), কিন্তু আসল MICON-স্টাইল reference
// sheet (A101 architectural drawing, landscape A3) মেপে দেখা গেছে
// sidebar আসলে page width-এর মাত্র ~16-18% (measured: title-block
// left edge ~980.8pt / page width ~1190.6pt = 17.6%; বর্ডার-বক্স
// বাদ দিয়ে block content ~15.7%)। 0.35 সেই অনুপাতের দ্বিগুণেরও বেশি
// ছিল — landscape A4-এ (297mm) এর মানে ~104mm sidebar, যা table
// content area-কে অস্বাভাবিকভাবে সংকুচিত করছিল। এখন 0.18 (A4-এ
// ~53mm) — reference-এর সাথে সঙ্গতিপূর্ণ এবং content area-র জন্য
// অনেক বেশি জায়গা ছেড়ে দেয়। contentRightBound()/sidebarRightMargin()
// দুটোই এই constant থেকে derive করে, তাই সব caller (table/section
// title/stat card/callout, ৮টা report type জুড়ে) স্বয়ংক্রিয়ভাবে
// বাড়তি width পায় — কোনো per-file পরিবর্তন লাগে না।
const SIDEBAR_WIDTH_PERCENT = 0.18

const PDF_REPORT_KIND_LABEL: Record<string, string> = {
  BOQ_Report: 'BOQ REPORT',
  Quantity_Report: 'QUANTITY REPORT',
  Cost_Report: 'COST REPORT',
  Material_Report: 'MATERIAL REPORT',
  BBS_Report: 'BBS REPORT',
  Calculation_Sheet: 'CALCULATION SHEET',
  Tender_Report: 'TENDER REPORT',
  Estimate_Basis_Report: 'ESTIMATE BASIS REPORT',
  Master_Report: 'MASTER REPORT',
}

export interface SidebarOptions {
  /** যেমন "S-01", "CS-03" — EngineXDraw/EngineX-Structural-এর SHEET NO কনভেনশনের সাথে মিলিয়ে; এই app-এ কোনো পূর্ব-বিদ্যমান sheet-numbering না থাকায় নতুন করে বানানো, প্রতিটা caller নিজের রিপোর্ট-কোড ঠিক করে দেয়। */
  sheetNumber: string
  /** এই নির্দিষ্ট পাতা/সেকশনের শিরোনাম — একাধিক পাতার রিপোর্টে ভিন্ন হতে পারে (যেমন Master Report-এ প্রতিটা section আলাদা)। */
  sheetTitle: string
}

/**
 * sidebarBoxLabelValue()-এর block height ঠিক যেভাবে হিসাব করে, সেই
 * একই ফর্মুলা এখানে বের করে আনা হলো — যাতে drawSidebar()-এর budget
 * pre-pass (নিচে দেখুন) আর draw-pass দুটোই একই সংখ্যা ব্যবহার করে।
 * আগে এই দুটো আলাদা জায়গায় প্রায়-মিলে-যাওয়া দুইটা ফর্মুলা ছিল
 * (একটা এখানে, একটা drawSidebar()-এর অনুমানে) — সেই দুই ফর্মুলা
 * বাস্তবে মেলেনি (measured actual y প্রায় ৪৩mm বেশি ছিল অনুমানের
 * চেয়ে), ফলে budget check ভুল সিদ্ধান্ত নিচ্ছিল এবং copyright তবু
 * clip হচ্ছিল। এখন single source of truth — draw ফাংশন নিজেই এই
 * হেল্পার কল করে, estimate-ও তাই করে, দুটো কখনো out-of-sync হতে
 * পারবে না।
 */
function sidebarBlockHeight(doc: jsPDF, width: number, value: string, valueFontSize: number, minHeight?: number): number {
  const padX = 3
  const padTop = 4
  const labelHeight = 3
  const gap = 0.8
  doc.setFontSize(valueFontSize)
  const valueLines = doc.splitTextToSize(value || '—', width - padX * 2) as string[]
  const cappedLines = Math.min(valueLines.length, 2)
  const lineHeight = valueFontSize * 0.42
  const contentHeight = padTop + labelHeight + gap + cappedLines * lineHeight + 2
  return Math.max(contentHeight, minHeight ?? 0)
}

function sidebarBoxLabelValue(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  options?: { valueFontSize?: number; bold?: boolean; minHeight?: number; compact?: boolean }
): number {
  const valueFontSize = options?.valueFontSize ?? 9
  const bold = options?.bold ?? false
  // ── compact mode (2026-09-03) ── sign-off রো (Detail/Design/
  // Checked/Approved By)-এর জন্য: এগুলো প্রায় সবসময়ই খালি "—" থাকবে
  // (blank পর্যন্ত future manual sign-off-এর জন্য), তাই পূর্ণ
  // label+value দুই-স্তরের block-এর বদলে label ও value পাশাপাশি এক
  // লাইনে বসিয়ে একটা পাতলা strip — reference sheet-এর নিচের সারির
  // ছোট title-block রো-গুলোর মতোই। normal ব্লকের প্রায় অর্ধেক height।
  if (options?.compact) {
    const padX = 3
    const rowH = 4.6
    doc.setFontSize(5.5)
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.setFont('helvetica', 'normal')
    doc.text(label, x + padX, y + rowH / 2 + 1.1)
    doc.setFontSize(6.5)
    doc.setTextColor(20, 20, 20)
    doc.text(value || '—', x + width - padX, y + rowH / 2 + 1.1, { align: 'right' })
    doc.setDrawColor(60, 60, 60)
    doc.setLineWidth(0.15)
    doc.line(x, y + rowH, x + width, y + rowH)
    return y + rowH
  }

  const padX = 3
  const padTop = 4
  const labelHeight = 3
  const gap = 0.8

  doc.setFontSize(6)
  doc.setTextColor(...PDF_MUTED_COLOR)
  doc.setFont('helvetica', 'normal')
  doc.text(label, x + padX, y + padTop)

  doc.setFontSize(valueFontSize)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  const valueLines = doc.splitTextToSize(value || '—', width - padX * 2) as string[]
  const cappedLines = valueLines.slice(0, 2) // spec-এর maxHeight:2-line cap-এর jsPDF সমতুল্য — খুব লম্বা মান sidebar থেকে উপচে পড়া ঠেকাতে
  const lineHeight = valueFontSize * 0.42
  cappedLines.forEach((line, i) => {
    doc.text(line, x + padX, y + padTop + labelHeight + gap + i * lineHeight)
  })
  doc.setFont('helvetica', 'normal')

  const blockHeight = sidebarBlockHeight(doc, width, value, valueFontSize, options?.minHeight)

  doc.setDrawColor(60, 60, 60)
  doc.setLineWidth(0.15)
  doc.line(x, y + blockHeight, x + width, y + blockHeight)

  return y + blockHeight
}

/**
 * Full-height vertical sidebar — spec-এর ২০-ব্লক সিকোয়েন্স অনুসরণ
 * করে (company header → drawing/report type → status → job no →
 * project/client/location → revision table → title → date → sheet no
 * → sign-off ব্লক → copyright)। Building Name/No. বাদ (EngineXEstimate-এর
 * Project টাইপে কোনো building concept নেই — verified against
 * project.types.ts, SHEET-DESIGN-SPEC.md section 4.3 দেখুন), Scale
 * ব্লক বাদ (কোনো spatial drawing না, সব রিপোর্ট/টেবিল)।
 *
 * Returns the Y-coordinate where the caller should start drawing body
 * content (top margin + a small gap) — NOT the sidebar's X-position.
 * Callers don't need the sidebar's X themselves: drawSectionTitle/
 * drawStatCards/drawCalloutBox/drawPdfTable (via sidebarRightMargin())
 * all compute the content area's right boundary internally.
 */
export function drawSidebar(doc: jsPDF, meta: PdfReportMeta, options: SidebarOptions): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 8
  const sidebarWidth = pageWidth * SIDEBAR_WIDTH_PERCENT
  const x = pageWidth - margin - sidebarWidth
  const topY = margin

  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(0.3)
  doc.rect(x, topY, sidebarWidth, pageHeight - margin * 2, 'S')

  // ── Budget-aware sizing (2026-09-03) ──────────────────────────────
  // আগে প্রতিটা label/value ব্লক নিজে নিজে 1 বা 2 লাইনে wrap করত,
  // কোনো global height-budget awareness ছাড়াই। সাধারণ ডেটাতে এটা
  // ঠিকই কাজ করত, কিন্তু একসাথে একাধিক লম্বা ফিল্ড (লম্বা Project
  // Name + লম্বা Client + লম্বা Location + 2-line Report Title, সবগুলো
  // একই পাতায়) পড়লে মোট height page-এর নিচে গিয়ে ঠেকত এবং copyright
  // ব্লক clip/truncate হয়ে যেত (rasterize করে ধরা পড়েছিল)।
  //
  // এখন draw করার আগে sidebarBlockHeight() (উপরে, sidebarBoxLabelValue-
  // এর নিজস্ব height formula থেকে বের করে আনা helper) দিয়ে একটা
  // dry-run measurement pass চালানো হয় — draw-pass আর measure-pass
  // দুটোই ঠিক একই ফর্মুলা ব্যবহার করে বলে (আগে দুটো আলাদা/ভিন্ন
  // অনুমান ছিল, যেটাই আসল bug ছিল) projectedTotal এখন actual draw
  // height-এর সাথে হুবহু মেলে। বাজেট ছাড়িয়ে গেলে ভ্যারিয়েবল ব্লকগুলো
  // (Project Name/Client/Location/Report Type/Report Title) ছোট font
  // size-এ যায় — বাকি সব ব্লক অপরিবর্তিত।
  const fixedBlocksHeight =
    (8 + 6) + // company header (logoSize + 6)
    sidebarBlockHeight(doc, sidebarWidth, meta.status ?? '—', 9) + // status
    sidebarBlockHeight(doc, sidebarWidth, meta.projectCode ?? '—', 9) + // job no
    10 + // revision table (fixed)
    sidebarBlockHeight(doc, sidebarWidth, new Date(meta.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), 9) + // date
    sidebarBlockHeight(doc, sidebarWidth, options.sheetNumber, 13) + // sheet no
    4.6 * 4 + // 4 compact sign-off rows
    11 // copyright reserve (2-3 lines at 5.5pt + padding + safety cushion)
  const reportTypeValue = PDF_REPORT_KIND_LABEL[meta.reportKind] ?? meta.reportKind.replace(/_/g, ' ').toUpperCase()
  const variableBlocksHeightNormal =
    sidebarBlockHeight(doc, sidebarWidth, reportTypeValue, 9.5) +
    sidebarBlockHeight(doc, sidebarWidth, meta.projectName, 9) +
    sidebarBlockHeight(doc, sidebarWidth, meta.clientName ?? '—', 10) +
    sidebarBlockHeight(doc, sidebarWidth, meta.location ?? '—', 9) +
    sidebarBlockHeight(doc, sidebarWidth, options.sheetTitle, 9.5)
  const projectedTotal = fixedBlocksHeight + variableBlocksHeightNormal
  const availableHeight = pageHeight - margin * 2
  const useCompressedVariant = projectedTotal > availableHeight

  let y = topY

  // Block 1 — Company header (logo mark + app name)
  const logoSize = 8
  drawLogoMark(doc, x + 3, y + 3, logoSize)
  doc.setFontSize(9)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.text('EngineX Quanta', x + logoSize + 6, y + 6.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...PDF_MUTED_COLOR)
  doc.text('Construction Estimating & Cost Management', x + logoSize + 6, y + 10.5, { maxWidth: sidebarWidth - logoSize - 9 })
  const companyBlockHeight = logoSize + 6
  doc.setDrawColor(60, 60, 60)
  doc.setLineWidth(0.15)
  doc.line(x, y + companyBlockHeight, x + sidebarWidth, y + companyBlockHeight)
  y += companyBlockHeight

  // Block 2 — Report Type (this app produces reports, not drawings — spec section 4.3)
  // ── Font re-tune (2026-09-03) ── sidebar এখন ~53mm (আগে ~104mm
  // ছিল), তাই আগের 11pt bold value কিছু লম্বা label-এ (যেমন
  // "MEASUREMENT RULES & ASSUMPTIONS") 2-line cap-এ wrap করে খুব
  // টাইট হয়ে যাচ্ছিল। 9.5pt-এ নামানো হয়েছে — reference A101 sheet-এর
  // DRAWING TYPE ব্লকের আনুপাতিক আকারের কাছাকাছি, এবং সব caller-এর
  // সবচেয়ে লম্বা প্রকৃত মান (PDF_REPORT_KIND_LABEL-এর মান, "MASTER
  // REPORT" ইত্যাদি) narrower width-এও এক লাইনে ধরে।
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'REPORT TYPE :', reportTypeValue, {
    valueFontSize: useCompressedVariant ? 8 : 9.5,
    bold: true,
  })

  // Block 3 — Status
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'STATUS :', meta.status ?? '—')

  // Block 4 — Job No. (this app has no separate job-number concept from projectCode — reusing it here rather than inventing a new field)
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'JOB NO :', meta.projectCode ?? '—')

  // Block 5 — Project Name
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'PROJECT NAME :', meta.projectName, {
    valueFontSize: useCompressedVariant ? 7.5 : 9,
  })

  // Blocks 6/7 — Building Name/No. omitted — verified no Building concept in this app's Project type (SHEET-DESIGN-SPEC.md section 4.3)

  // Block 8 — Client
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'CLIENT :', meta.clientName ?? '—', {
    valueFontSize: useCompressedVariant ? 8.5 : 10,
    bold: true,
  })

  // Block 9 — Location
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'LOCATION :', meta.location ?? '—', {
    valueFontSize: useCompressedVariant ? 7.5 : 9,
  })

  // Block 10 — Revision table (this app has no revision-history concept yet — single always-current row, matching the reference sheet's own blank-rows-under-header shape)
  doc.setFontSize(6)
  doc.setTextColor(...PDF_MUTED_COLOR)
  doc.text('REVISION', x + 3, y + 4.5)
  const revColWidths = [sidebarWidth * 0.34, sidebarWidth * 0.33, sidebarWidth * 0.33]
  const revHeaderY = y + 6.5
  doc.setDrawColor(60, 60, 60)
  doc.setLineWidth(0.15)
  doc.line(x, revHeaderY, x + sidebarWidth, revHeaderY)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.text('REV.', x + 1.5, revHeaderY + 3.2)
  doc.text('SIGNATURE', x + revColWidths[0] + 1.5, revHeaderY + 3.2)
  doc.text('DATE', x + revColWidths[0] + revColWidths[1] + 1.5, revHeaderY + 3.2)
  doc.setFont('helvetica', 'normal')
  doc.line(x + revColWidths[0], y, x + revColWidths[0], revHeaderY + 10)
  doc.line(x + revColWidths[0] + revColWidths[1], y, x + revColWidths[0] + revColWidths[1], revHeaderY + 10)
  doc.setFontSize(7.5)
  doc.setTextColor(20, 20, 20)
  doc.text('0', x + 1.5, revHeaderY + 8)
  doc.text(new Date(meta.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), x + revColWidths[0] + revColWidths[1] + 1.5, revHeaderY + 8)
  y = revHeaderY + 10
  doc.line(x, y, x + sidebarWidth, y)

  // Block 11 — Report Title (this sheet/section's own title, not the report-kind label from block 2)
  // ── Font re-tune (2026-09-03), see Block 2 note ── এই ব্লকেই সবচেয়ে
  // লম্বা মান আসে (যেমন "Measurement Rules & Assumptions") — 9.5pt-এ
  // 2-line cap-এর ভেতর আরামে ধরে, 11pt-এ সরু sidebar-এ আরও tight হতো।
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'REPORT TITLE :', options.sheetTitle, {
    valueFontSize: useCompressedVariant ? 8 : 9.5,
    bold: true,
  })

  // Block 12 — Option: omitted, this app has no design-option/variant concept (spec allows omitting rather than showing empty "—")

  // Block 13 — Date
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'DATE :', new Date(meta.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }))

  // Block 14 — Scale: omitted, no spatial drawing (spec section 4.3)

  // Block 15 — Sheet No.
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'SHEET NO :', options.sheetNumber, { valueFontSize: 13, bold: true })

  // Blocks 16-19 — Detail By / Design By / Checked By / Approved By
  // ── Restored (2026-09-03) ── আগে এই চারটা ব্লক পুরোপুরি বাদ ছিল
  // ("no sign-off/engineer-of-record data model" যুক্তিতে)। কিন্তু
  // reference title block (A101 architectural sheet)-এ এই সারিগুলো
  // সবসময় থাকে — এমনকি ফাঁকা থাকলেও — কারণ sign-off আসলে পরে হাতে/
  // ডিজিটালি যোগ হওয়া তথ্য, PDF জেনারেশনের সময় থাকতেই হবে এমন না।
  // sidebar-কে প্রায়-খালি রাখার বদলে honest empty "—" row হিসেবে
  // দেখানো হচ্ছে (invented নাম না বসিয়ে), reference sheet-এর কাঠামোর
  // সাথে মিলিয়ে। কোনো নতুন data model লাগেনি — শুধু চারটা label-only
  // row, ঠিক blocks 3/4/9-এর মতো meta.status/projectCode/location
  // না-থাকলে যেভাবে "—" দেখায়।
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'DETAIL BY :', '—', { compact: true })
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'DESIGN BY :', '—', { compact: true })
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'CHECKED BY :', '—', { compact: true })
  y = sidebarBoxLabelValue(doc, x, y, sidebarWidth, 'APPROVED BY :', '—', { compact: true })

  // Block 20 — Copyright notice
  // ── Overflow fix (2026-09-03) ── আগে এই ব্লক fixed y+4 থেকে শুরু
  // করে page bottom border পর্যন্ত জায়গা আছে ধরে নিত। কিন্তু REPORT
  // TITLE-এর মতো ব্লক (যেমন "Measurement Rules & Assumptions") 2
  // লাইনে wrap করলে সব নিচের ব্লক (sign-off রো + copyright) নিচের
  // দিকে ঠেলে যেত, এবং copyright-এর শেষ লাইন sidebar-এর বর্ডারের
  // বাইরে ক্লিপ হয়ে যাচ্ছিল (rasterize করে ধরা পড়েছে, page 3-এ
  // "tender submission." কাটা যাচ্ছিল)। এখন available space যা আছে
  // তার মধ্যেই বসে কিনা যাচাই করে actual bottom boundary অনুযায়ী —
  // জায়গা কম পড়লে font আরও ছোট করে (6pt থেকে 5.2pt পর্যন্ত), যাতে
  // content কখনো sidebar-এর বর্ডার-বক্সের বাইরে না যায়।
  // ── Overflow fix v2 (2026-09-03) ── আগের auto-shrink (6pt→5.2pt)
  // যথেষ্ট ছিল না — REPORT TITLE 2-লাইনে wrap করলে মাত্র ~7mm অবশিষ্ট
  // থাকে, কিন্তু 3-লাইন copyright এমনকি 5.2pt-এও ~12mm লাগে। root
  // cause ঠিক করা হলো এখানে সরাসরি: copyright আসলে ছোট auto-wrap
  // paragraph হিসেবে বসানো, ফিক্সড ৩-লাইন assumption না করে —
  // splitTextToSize দিয়ে actual available width-এ যতটুকু লাগে ততটুকু
  // লাইন বানায় (২ লাইনেই ধরে যায়: label ছোট sidebar width-এও)। Sheet
  // এর bottom border-এর ভেতরেই থাকা নিশ্চিত করতে clip করা হচ্ছে —
  // available space সত্যিই না থাকলে (অস্বাভাবিক লম্বা multi-line
  // sheetTitle-এর edge case) শেষ লাইন বাদ পড়বে, বর্ডার ভেঙে বাইরে
  // যাবে না।
  const pageBottom = pageHeight - margin
  doc.setFontSize(5.5)
  doc.setTextColor(...PDF_MUTED_COLOR)
  const copyrightText = 'Auto-generated report — EngineX Quanta. For internal estimating use; verify figures before tender submission.'
  const copyLines = doc.splitTextToSize(copyrightText, sidebarWidth - 6) as string[]
  const copyLineHeight = 2.6
  // ── Overflow fix v3 (2026-09-03) ── আগে Math.max(1, ...) দিয়ে
  // "অন্তত ১ লাইন" জোর করা হতো, কিন্তু ১ লাইনের জন্যও যথেষ্ট জায়গা
  // (< 1 লাইন সমান, ~2.6mm+প্যাডিং) না থাকলে সেই এক লাইনও border-এর
  // ঠিক ওপর দিয়ে/বাইরে চলে যেত (measured: 4.6mm অবশিষ্ট থাকলে ১
  // লাইনের প্রয়োজন ৪+২.৬=৬.৬mm — তবু জোর করে আঁকা হতো)। এখন সত্যিই
  // যতটুকু লাইন নিরাপদে ধরে ততটুকুই আঁকা হয় — চরম edge case-এ ০ লাইনও
  // (copyright পুরো বাদ) সম্ভব, কিন্তু sidebar-এর বর্ডার কখনো ভাঙবে না।
  const maxCopyLines = Math.max(0, Math.floor((pageBottom - y - 4) / copyLineHeight))
  let copyY = y + 4
  copyLines.slice(0, maxCopyLines).forEach((line) => {
    doc.text(line, x + 3, copyY, { maxWidth: sidebarWidth - 6 })
    copyY += copyLineHeight
  })

  // ⚠️ FIXED (2026-08-26): এই ফাংশন আগে `x` (sidebar-এর বাম প্রান্তের
  // X-coordinate) রিটার্ন করত, কিন্তু প্রতিটা caller ফাইলে
  // `const y = drawSidebar(...)` লিখে সেটাকে content-শুরুর Y-position
  // হিসেবে ব্যবহার করা হয়েছিল — landscape A4-এ sidebar-এর X (~180mm)
  // page height-এর (~210mm) কাছাকাছি হওয়ায় drawSectionTitle-এর
  // ensureSpace() সাথে সাথেই "পাতায় জায়গা নেই" ধরে নতুন (খালি) পাতা
  // যোগ করে দিত — render+rasterize করে ধরা পড়েছে (BOQ report-এর
  // পাতা ২ সম্পূর্ণ খালি ছিল, content পাতা ৩-এ চলে গিয়েছিল)। এখন
  // content-শুরুর Y রিটার্ন করা হচ্ছে (topY-এর ঠিক নিচে, margin
  // বাদে) — sidebar-এর X caller-দের আর দরকার নেই, কারণ
  // drawSectionTitle/drawStatCards/ইত্যাদি নিজেরাই contentRightBound()
  // দিয়ে sidebar-এর জায়গা হিসাব করে নেয়।
  return topY + 2
}

/**
 * প্রতিটা পাতার নিচে page number — multi-page report-এ (BOQ, BBS
 * বড় হতে পারে) কোন পাতা কততম তা বোঝার জন্য জরুরি। startPage দিয়ে
 * নির্দিষ্ট রেঞ্জ থেকে ফুটার বসানো যায় (যেমন cover page-এর পরের
 * পাতাগুলোতে, cover page নিজে বাদ দিয়ে)।
 */
/**
 * প্রতিটা পাতার নিচে page-number/attribution লাইন। sidebar-যুক্ত
 * পাতায় (reportMeta দেওয়া থাকলে) এই লাইন sidebar-এর বাম প্রান্ত
 * পর্যন্তই টানা হয় — sidebar-এর বর্ডার বক্সের ভেতর দিয়ে চলে গিয়ে
 * সেটাকে দৃশ্যত ভাঙা দেখানো এড়াতে।
 */
export function drawPdfFooter(doc: jsPDF, options?: { startPage?: number; reportMeta?: PdfReportMeta }): void {
  const pageCount = doc.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()
  const startPage = options?.startPage ?? 1
  const rightBound = contentRightBound(doc, !!options?.reportMeta)

  for (let i = startPage; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(225, 225, 225)
    doc.setLineWidth(0.2)
    doc.line(14, pageHeight - 13, rightBound, pageHeight - 13)
    doc.setFontSize(8)
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.text(`Page ${i} of ${pageCount}`, rightBound, pageHeight - 8, { align: 'right' })
    doc.text('EngineX Quanta — Auto-generated report', 14, pageHeight - 8)
  }
}

/**
 * একটা পূর্ণ cover/title page — top brand band-এ logo+app name,
 * বড় report title/subtitle, এবং নিচে একটা title-block info grid
 * (Project / Client / Location / Generated — MICON-স্টাইল drawing
 * title-block-এর ধারণা থেকে অনুপ্রাণিত, কিন্তু রঙিন বর্ডার-ফ্রেম
 * ছাড়া — এই ecosystem-এর ব্র্যান্ড কালারে ক্লিন/প্রফেশনাল লুক)।
 * এর পরে caller নতুন doc.addPage() করে বডি কন্টেন্ট শুরু করবে বলে
 * ধরে নেওয়া হয়েছে — তাই এই ফাংশন pageCount বা Y-position রিটার্ন
 * করে না।
 *
 * ইচ্ছাকৃতভাবে sidebar নেই এই পাতায় (SHEET-DESIGN-SPEC.md section 5,
 * EngineX-Structural-এর SectionA_Cover.tsx-এর একই সিদ্ধান্তের সাথে
 * সঙ্গতিপূর্ণ) — MICON রেফারেন্স সেটেও Content Sheet-এর আগে একটা
 * full-page, sidebar-ছাড়া cover থাকে। drawSidebar() যুক্ত body
 * পাতাগুলো এই cover-এর পরে doc.addPage() দিয়ে শুরু হয়।
 *
 * ব্যবহার ঐচ্ছিক: ছোট/simple রিপোর্টে (single-table) শুধু প্রথম body
 * পাতায় সরাসরি drawSidebar() ব্যবহার চালিয়ে যাওয়া যায়; cover page
 * মূলত multi-section রিপোর্ট (Cost, Tender, Master Report) ও
 * দৃশ্যমান professional presentation-এর জন্য।
 */
export function drawCoverPage(
  doc: jsPDF,
  meta: PdfReportMeta,
  options?: { subtitle?: string; watermark?: 'DRAFT' | 'FINAL' }
): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const cx = pageWidth / 2
  const margin = 20

  // ── উপরের brand band — ভরাট ব্লক না, একটা পাতলা top bar (drawing
  // sheet-এর মতো ভারী রঙিন ফ্রেমের বদলে হালকা, ক্লিন উপস্থিতি) ──
  doc.setFillColor(...PDF_BRAND_COLOR)
  doc.rect(0, 0, pageWidth, 3, 'F')

  // ── লোগো + app name, উপরে বাম ঘেঁষে (কেন্দ্রীভূত না রেখে একটা
  // document masthead-এর মতো অনুভূতি) ──
  const logoSize = 12
  drawLogoMark(doc, margin, 20, logoSize)
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.text('EngineX Quanta', margin + logoSize + 5, 26)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...PDF_MUTED_COLOR)
  doc.text('Construction Estimating & Cost Management', margin + logoSize + 5, 31.5)

  doc.setDrawColor(225, 225, 225)
  doc.setLineWidth(0.3)
  doc.line(margin, 42, pageWidth - margin, 42)

  // ── মূল শিরোনাম ব্লক ──
  // titleLines-এর প্রকৃত সংখ্যা মেপে underline/subtitle/title-block
  // সব নিচে শিফট করা হচ্ছে — আগে এগুলো ফিক্সড y (86/96/112) ধরেই
  // বসানো হতো, ধরে নিয়ে reportTitle সবসময় এক লাইনে ধরবে। একটা লম্বা
  // custom section title (যেমন কোনো ভবিষ্যৎ কলার দীর্ঘ নাম পাস করলে)
  // দুই লাইনে wrap করত এবং সেই দ্বিতীয় লাইনটা সরাসরি underline/
  // subtitle-এর ওপর দিয়ে ওভারল্যাপ করত। এখন wrapped line সংখ্যা
  // অনুযায়ী নিচের সবকিছু ডাইনামিকভাবে সরে যায়।
  doc.setFontSize(26)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  const titleLines = doc.splitTextToSize(meta.reportTitle, pageWidth - margin * 2) as string[]
  const titleLineHeight = 10
  const titleTopY = 78
  doc.text(titleLines, cx, titleTopY, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  const titleBottomY = titleTopY + (titleLines.length - 1) * titleLineHeight

  const underlineY = titleBottomY + 8
  doc.setDrawColor(...PDF_BRAND_COLOR)
  doc.setLineWidth(0.8)
  doc.line(cx - 16, underlineY, cx + 16, underlineY)

  let afterTitleBlockY = underlineY + 26 // matches the original 112 - 86 gap when title is a single line
  if (options?.subtitle) {
    const subtitleY = underlineY + 10
    doc.setFontSize(11)
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.text(stripUnrenderableBengali(options.subtitle), cx, subtitleY, { align: 'center' })
    afterTitleBlockY = subtitleY + 16
  }

  // ── Title-block — MICON-স্টাইল drawing-এর "Job Title/Consultant/
  // Client" তথ্য-ব্লকের ধারণা, কিন্তু রঙিন বর্ডার-ফ্রেম ছাড়া: একটা
  // হালকা-বর্ডার rounded box-এ label-uppercase + value দুই-কলাম গ্রিড।
  // clientName/location না থাকলে (Hub import-ভিত্তিক পুরনো caller)
  // সেই row বাদ পড়ে — খালি "—" দেখানো হয় না।
  //
  // projectName/clientName/location — এই তিনটেই Hub app-এ ইউজার
  // যা টাইপ করেছে তার raw pass-through (EngineXEstimate-এর কোনো
  // hard-coded টেক্সট না) — buildingType-এর মতোই বাংলা থাকতে পারে,
  // তাই একই sanitizer এখানেও।
  const rows: { label: string; value: string }[] = [
    {
      label: 'PROJECT',
      value: stripUnrenderableBengali(meta.projectCode ? `${meta.projectName} (${meta.projectCode})` : meta.projectName),
    },
  ]
  if (meta.clientName) rows.push({ label: 'CLIENT', value: stripUnrenderableBengali(meta.clientName) })
  if (meta.location) rows.push({ label: 'LOCATION', value: stripUnrenderableBengali(meta.location) })
  rows.push({ label: 'GENERATED', value: new Date(meta.generatedAt).toLocaleString('en-US') })

  const blockWidth = pageWidth - margin * 2 - 20
  const blockX = cx - blockWidth / 2
  const rowHeight = 13
  const blockY = Math.max(112, afterTitleBlockY) // never above the original position, only pushed lower if the title wrapped
  const blockHeight = rows.length * rowHeight

  doc.setDrawColor(220, 220, 224)
  doc.setLineWidth(0.4)
  doc.roundedRect(blockX, blockY, blockWidth, blockHeight, 2, 2, 'S')

  // বাম পাশে brand-color accent bar — পুরো title-block জুড়ে
  doc.setFillColor(...PDF_BRAND_COLOR)
  doc.roundedRect(blockX, blockY, 2, blockHeight, 1, 1, 'F')

  rows.forEach((row, i) => {
    const rowY = blockY + i * rowHeight
    if (i > 0) {
      doc.setDrawColor(235, 235, 238)
      doc.setLineWidth(0.2)
      doc.line(blockX + 6, rowY, blockX + blockWidth, rowY)
    }
    doc.setFontSize(7.5)
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.setFont('helvetica', 'bold')
    doc.text(row.label, blockX + 10, rowY + 8.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(20, 20, 20)
    doc.text(row.value, blockX + 50, rowY + 8.5, { maxWidth: blockWidth - 58 })
  })

  // Watermark (diagonal, হালকা) — চাইলে DRAFT/FINAL স্ট্যাম্প
  if (options?.watermark) {
    doc.setFontSize(60)
    doc.setTextColor(235, 235, 238)
    doc.setFont('helvetica', 'bold')
    doc.text(options.watermark, cx, pageHeight / 2 + 60, {
      align: 'center',
      angle: 35,
    })
    doc.setFont('helvetica', 'normal')
  }

  // ── নিচে পাতলা brand line + tagline (উপরের masthead-এর সাথে
  // সামঞ্জস্যপূর্ণ, ভারী রঙিন ব্যান্ড না) ──
  doc.setDrawColor(...PDF_BRAND_COLOR)
  doc.setLineWidth(0.6)
  doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18)
  doc.setFontSize(8)
  doc.setTextColor(...PDF_MUTED_COLOR)
  doc.text('Auto-generated report — EngineX Quanta', cx, pageHeight - 12, { align: 'center' })
}

/**
 * Table-of-contents পাতা — multi-section রিপোর্টে (Cost, Tender,
 * ভবিষ্যতে Master Report) কোন section কোন পাতায় আছে তা দেখানোর
 * জন্য। entries-এ pageNumber ফাঁকা রাখা যায় যদি builder আগে থেকে
 * জানে না (caller draw করার পরে numbering বসাতে চাইলে পরে
 * doc.setPage() দিয়ে ফিরে গিয়ে টেক্সট বসিয়ে দিতে পারে) — কিন্তু
 * সরল ব্যবহারে entries পুরোপুরি প্রি-কম্পিউটেড থাকবে বলে ধরা হয়েছে।
 */
/**
 * IMPORTANT constraint this function must respect: its one caller
 * (master-report.pdf.ts) reserves EXACTLY ONE page for the Contents
 * list up front (`doc.addPage()` then remembers that page number as
 * `tocPageNumber`), draws every section afterward, and only then comes
 * back with `doc.setPage(tocPageNumber)` to fill this page in — every
 * section's recorded `sectionStartPages` number is already fixed by
 * that point. So unlike every other overflow fix in this file, this
 * function must NOT call doc.addPage() to handle overflow — inserting
 * a page here would shift every already-recorded section page number
 * out from under itself, making the Contents list point at the wrong
 * pages throughout the rest of the document (worse than the original
 * cut-off bug, and silently wrong rather than visibly wrong).
 *
 * The safe fix that respects the one-reserved-page constraint: shrink
 * row height (and, if that's still not enough, font size) to fit
 * however many entries there are into the one page that's actually
 * available — same "scale down rather than overflow" approach used for
 * EngineXDraw's sidebar. A practical project's report section count
 * (SECTION_DEFS in master-report.pdf.ts currently lists 8) is small
 * enough that this never needs to shrink far; the scaling exists so a
 * future longer section list degrades gracefully instead of clipping.
 */
export function drawTableOfContents(
  doc: jsPDF,
  entries: { label: string; pageNumber: number }[]
): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const bottomMargin = 18

  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.text('Contents', margin, 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...PDF_MUTED_COLOR)
  doc.text('Sections included in this report', margin, 30)

  doc.setDrawColor(...PDF_BRAND_COLOR)
  doc.setLineWidth(0.8)
  doc.line(margin, 35, margin + 22, 35)

  const listTop = 50
  const availableHeight = pageHeight - bottomMargin - listTop
  const naturalRowHeight = 12
  const naturalHeight = entries.length * naturalRowHeight
  // Only shrink if needed, and never below 60% (past that the chip
  // number/label become hard to read, at which point a real fix is
  // splitting into sub-sections rather than shrinking further).
  const scale = naturalHeight > availableHeight && naturalHeight > 0
    ? Math.max(0.6, availableHeight / naturalHeight)
    : 1
  const rowHeight = naturalRowHeight * scale
  const chipSize = 6.5 * scale

  let y = listTop

  entries.forEach((entry, i) => {
    // হালকা alternate row shading — MICON-স্টাইল SL.No টেবিলের ধারণা,
    // কিন্তু বর্ডার-গ্রিড ছাড়া, শুধু ব্যাকগ্রাউন্ড ব্যান্ড
    if (i % 2 === 1) {
      doc.setFillColor(248, 249, 248)
      doc.rect(margin - 4, y - 8 * scale, pageWidth - (margin - 4) * 2, rowHeight, 'F')
    }

    // নম্বর chip — brand-color আউটলাইনড বৃত্ত, SL.No-এর মতো
    doc.setDrawColor(...PDF_BRAND_COLOR)
    doc.setLineWidth(0.4)
    doc.circle(margin + chipSize / 2, y - 2.2 * scale, chipSize / 2, 'S')
    doc.setFontSize(Math.max(5, 7.5 * scale))
    doc.setTextColor(...PDF_BRAND_COLOR)
    doc.setFont('helvetica', 'bold')
    doc.text(String(i + 1), margin + chipSize / 2, y - 0.3 * scale, { align: 'center' })

    // লেবেল
    doc.setFontSize(Math.max(6, 10.5 * scale))
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    const labelX = margin + chipSize + 6
    doc.text(entry.label, labelX, y)

    // dotted leader line
    const labelWidth = doc.getTextWidth(entry.label)
    const dotsStartX = labelX + labelWidth + 3
    const dotsEndX = pageWidth - margin - 10
    if (dotsEndX > dotsStartX) {
      doc.setLineDashPattern([0.6, 1.4], 0)
      doc.setDrawColor(200, 200, 203)
      doc.line(dotsStartX, y - 1, dotsEndX, y - 1)
      doc.setLineDashPattern([], 0)
    }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.text(String(entry.pageNumber), pageWidth - margin, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    y += rowHeight
  })
}

/**
 * autoTable-এর জন্য common styling — head brand color, alternate
 * row shading, ছোট font (BOQ/BBS-এর মতো column-ভারী table-এ
 * readability-র জন্য জরুরি)।
 *
 * rightMargin ঐচ্ছিক (ডিফল্ট 14mm, আগের আচরণ অপরিবর্তিত) — sidebar
 * থাকা পাতায় caller sidebar-এর প্রস্থ + একটু gap pass করে টেবিলকে
 * sidebar-এর নিচে ঢুকে যাওয়া থেকে আটকায় (দেখুন drawSidebar-এর
 * রিটার্ন ভ্যালু, যেটা সরাসরি এখানে rightMargin হিসেবে derive করা
 * যায়: pageWidth - sidebarLeftX)।
 */
/** table cell-এর মান string/number/অন্য কিছু হতে পারে (RowInput-এর টাইপ অনুযায়ী) — শুধু string cell-এই Bengali স্ট্রিপ করা দরকার, বাকিগুলো অপরিবর্তিত। */
function sanitizeTableCell(cell: unknown): unknown {
  return typeof cell === 'string' ? stripUnrenderableBengali(cell) : cell
}

/** RowInput array-form (CellInput[]) অথবা object-form ({ [col]: CellInput }) দুটোই হতে পারে — দুই shape-ই টাইপ বজায় রেখে handle করা, sanitizeTableCell-এর রিটার্ন unknown হওয়ায় সরাসরি .map() করলে RowInput ইউনিয়ন ভেঙে যায়। */
function sanitizeTableRow(row: RowInput): RowInput {
  if (Array.isArray(row)) {
    return row.map(sanitizeTableCell) as RowInput
  }
  const safeRow: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    safeRow[key] = sanitizeTableCell((row as Record<string, unknown>)[key])
  }
  return safeRow as RowInput
}

export function drawPdfTable(
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: RowInput[],
  options?: { columnStyles?: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }>; rightMargin?: number }
): number {
  // BOQ/Quantity/Material ইত্যাদি row-এ item name/description ইউজার
  // বাংলায় লিখতে পারে (UI বাংলায় চলে) — drawSummaryLine-এর মতো এখানেও
  // helvetica-তে garbled bytes এড়াতে প্রতিটা string cell sanitize করা
  // হচ্ছে। head-এ সাধারণত এটা লাগে না (কলাম-হেডার সব ইংরেজি), কিন্তু
  // ভবিষ্যতে কোনো bilingual header এলেও নিরাপদ থাকতে একই ট্রিটমেন্ট।
  const safeHead = head.map((row) => row.map((cell) => stripUnrenderableBengali(cell)))
  const safeBody = body.map(sanitizeTableRow)
  autoTable(doc, {
    startY,
    head: safeHead,
    body: safeBody,
    theme: 'striped',
    headStyles: { fillColor: PDF_BRAND_COLOR, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: 30 },
    alternateRowStyles: { fillColor: [245, 247, 245] },
    margin: { left: 14, right: options?.rightMargin ?? 14 },
    columnStyles: options?.columnStyles,
  })
  // jspdf-autotable প্লাগইন doc-এ lastAutoTable attach করে (টাইপ
  // declaration-এ augment করা আছে) — পরবর্তী table/content কোথা
  // থেকে শুরু হবে সেই Y-position এখান থেকে বের করা।
  return (doc.lastAutoTable?.finalY ?? startY) + 8
}

/**
 * একটা section sub-heading (যেমন "Material Cost", "Comparative
 * Statement") — table-এর আগে দাগ কেটে দেওয়ার জন্য। একটা ছোট বাম-
 * পাশের brand-color accent bar সহ, যাতে section boundary চোখে
 * সহজে পড়ে (plain bold text-এর চেয়ে বেশি "printed report" অনুভূতি)।
 */

/**
 * পাতার নিচের দিকে যথেষ্ট জায়গা আছে কিনা যাচাই করে — না থাকলে নতুন
 * পাতা যোগ করে (reportMeta দেওয়া থাকলে drawSidebar() দিয়ে সেই নতুন
 * পাতায় sidebar-ও বসায়) এবং content শুরুর নতুন Y রিটার্ন করে।
 * reportMeta না দিলে (ঐচ্ছিক, backward-compat কারণে) শুধু raw
 * doc.addPage() করে, কোনো sidebar ছাড়া।
 *
 * নতুন পাতার sheetNumber/sheetTitle নির্দিষ্ট section-context ছাড়াই
 * derive করা হয় (page-count-ভিত্তিক কোড + reportTitle) — একটা
 * continuation page-এর জন্য যথেষ্ট প্রাসঙ্গিক, প্রতিটা caller
 * (drawSectionTitle ইত্যাদির মাধ্যমে) নিজে থেকে sheet-context থ্রেড
 * করতে বাধ্য করা এড়াতে। কলার যদি নিজে থেকে বেশি নির্দিষ্ট sheetTitle
 * চায় (যেমন Master Report-এর section-aware continuation), সরাসরি
 * drawSidebar() কল করে নিজের options দিতে পারে — ensureSpace শুধু
 * ডিফল্ট আচরণ কভার করে।
 *
 * ── Phase 6 (Polish) ────────────────────────────────────────────
 * jspdf-autotable নিজে থেকেই table-এর page-break handle করে (row
 * মাঝপথে কাটে না, এটা library-এর default আচরণ) — কিন্তু
 * drawSectionTitle/drawSummaryLine/drawStatCards/drawCalloutBox এই
 * ফাংশনগুলো raw Y-কো-অর্ডিনেটে সরাসরি আঁকত, পাতার নিচে জায়গা আছে
 * কিনা না দেখেই। ফলে কোনো table-এর ঠিক পরেই যদি warning callout box
 * বা summary line আসত এবং সেটা পাতার একদম শেষে পড়ে যেত, তাহলে সেই
 * অংশ কেটে পাতার বাইরে চলে যেত (invisible)। এখন এই helper সেই
 * ফাংশনগুলোর শুরুতে বসিয়ে না-থাকা জায়গা আগেই ধরা হচ্ছে।
 */
function ensureSpace(doc: jsPDF, y: number, neededHeight: number, reportMeta?: PdfReportMeta): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  const bottomMargin = 18 // drawPdfFooter()-এর জায়গা রাখার জন্য
  if (y + neededHeight > pageHeight - bottomMargin) {
    doc.addPage()
    if (!reportMeta) return 20
    const pageNum = doc.getNumberOfPages()
    return drawSidebar(doc, reportMeta, {
      sheetNumber: `${reportKindPrefix(reportMeta.reportKind)}-${pageNum}`,
      sheetTitle: reportMeta.reportTitle,
    })
  }
  return y
}

/** reportKind (যেমন "BOQ_Report") থেকে একটা ছোট sheet-number prefix বের করে (যেমন "BOQ") — প্রথম শব্দাংশ নেওয়া, বাকি "_Report" ইত্যাদি বাদ। */
function reportKindPrefix(reportKind: string): string {
  const firstSegment = reportKind.split('_')[0]
  return firstSegment.toUpperCase()
}

/** sidebar থাকলে effective content-area-এর ডান সীমা — sidebar-এর বাম প্রান্ত (একটু gap সহ), না থাকলে স্বাভাবিক page margin। Absolute X-coordinate রিটার্ন করে। */
function contentRightBound(doc: jsPDF, hasSidebar: boolean): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  if (!hasSidebar) return pageWidth - 14
  return pageWidth - 8 - pageWidth * SIDEBAR_WIDTH_PERCENT - 6
}

/**
 * drawPdfTable()-এর rightMargin অপশনের জন্য — jspdf-autotable-এর
 * margin.right সবসময় "page-এর ডান প্রান্ত থেকে দূরত্ব" হিসেবে কাজ
 * করে (contentRightBound()-এর মতো absolute X-coordinate না), তাই এই
 * wrapper সেই conversion করে দেয়। সব caller ফাইল এই একটাই ফাংশন
 * ব্যবহার করবে sidebar-যুক্ত পাতায় টেবিলের জন্য rightMargin ঠিক
 * রাখতে — pageWidth/sidebar-width গণনা প্রতিটা caller নিজে না করে।
 */
export function sidebarRightMargin(doc: jsPDF): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  return pageWidth - contentRightBound(doc, true)
}

export function drawSectionTitle(doc: jsPDF, title: string, y: number, reportMeta?: PdfReportMeta): number {
  y = ensureSpace(doc, y, 10, reportMeta)
  doc.setFillColor(...PDF_BRAND_COLOR)
  doc.rect(14, y - 4, 1.2, 5.5, 'F')

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(title, 18, y, { maxWidth: contentRightBound(doc, !!reportMeta) - 18 })
  doc.setFont('helvetica', 'normal')
  return y + 6
}

/**
 * একটা key-value সারাংশ লাইন (যেমন "Total Project Cost: ৳12,34,500")
 * — table-এর বাইরে বড় summary number দেখানোর জন্য।
 */
// Hub app থেকে sync হওয়া কিছু field (যেমন buildingType, usageType)
// ইউজার Hub-এ বাংলায় লিখে/সিলেক্ট করে থাকতে পারে — সেই raw স্ট্রিং
// এখানে সরাসরি pass হয়ে আসে, PDF জেনারেটর কোডে hard-code করা কোনো
// টেক্সট না (তুলনা করুন lib/pdf/estimate-basis.pdf.ts-এর
// MEASUREMENT_RULES/ASSUMPTIONS-এর সাথে, যেগুলো এই ফাইলেরই
// hard-coded ছিল এবং সরাসরি ইংরেজি করে ফিক্স করা হয়েছে — Hub-sync
// ডেটার জন্য সেই পথ কাজ করে না, কারণ মান আসে database থেকে,
// কোডে না)। শুধু Bengali script রেঞ্জ (\u0980–\u09FF) স্ট্রিপ করা
// হচ্ছে — m², m³, ×-এর মতো Latin-1 supplement চিহ্ন অক্ষত থাকা
// দরকার, সেগুলো helvetica-তে ঠিকভাবেই render হয়।
function stripUnrenderableBengali(value: string): string {
  if (!/[\u0980-\u09FF]/.test(value)) return value
  const cleaned = value.replace(/[\u0980-\u09FF]+/g, '').replace(/\s{2,}/g, ' ').replace(/[()\s]+$/, '').trim()
  return cleaned || '(Bengali text — not shown; PDF font has no Bengali glyphs)'
}

export function drawSummaryLine(doc: jsPDF, label: string, value: string, y: number, reportMeta?: PdfReportMeta): number {
  y = ensureSpace(doc, y, 8, reportMeta)
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(label, 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(stripUnrenderableBengali(value), 90, y, { maxWidth: contentRightBound(doc, !!reportMeta) - 90 })
  doc.setFont('helvetica', 'normal')
  return y + 6
}

/**
 * Dashboard-স্টাইল "stat card" গ্রিড — একাধিক key metric পাশাপাশি
 * বক্সে দেখানোর জন্য (যেমন Cost Report-এ Material/Labour/Equipment/
 * Total একসাথে চারটা বক্সে)। boxes.length অনুযায়ী সমান-প্রস্থে
 * ভাগ হয়ে যায়। Phase 2+ (Cost/Tender) থেকে ব্যবহার হবে।
 */
export function drawStatCards(
  doc: jsPDF,
  boxes: { label: string; value: string; accent?: [number, number, number] }[],
  y: number,
  reportMeta?: PdfReportMeta
): number {
  const boxHeight = 22
  y = ensureSpace(doc, y, boxHeight, reportMeta)
  const margin = 14
  const gap = 4
  const totalWidth = contentRightBound(doc, !!reportMeta) - margin
  const boxWidth = (totalWidth - gap * (boxes.length - 1)) / boxes.length

  boxes.forEach((box, i) => {
    const x = margin + i * (boxWidth + gap)
    const accent = box.accent ?? PDF_BRAND_COLOR

    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'S')

    doc.setFillColor(...accent)
    doc.roundedRect(x, y, 1.5, boxHeight, 0.75, 0.75, 'F')

    doc.setFontSize(7.5)
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.text(box.label.toUpperCase(), x + 5, y + 8, { maxWidth: boxWidth - 8 })

    doc.setFontSize(11.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 20, 20)
    doc.text(box.value, x + 5, y + 17, { maxWidth: boxWidth - 8 })
    doc.setFont('helvetica', 'normal')
  })

  return y + boxHeight + 8
}

/**
 * একটা styled callout/note box — info (নীল), warning (কমলা), বা
 * success (সবুজ) — warnings/notes-কে plain রঙিন টেক্সটের বদলে একটা
 * bordered box-এ দেখানোর জন্য (BBS warnings, Cost-এর
 * itemsWithoutRateAnalysis, ইত্যাদির জন্য Phase 2+ এ ব্যবহার হবে)।
 * lines[] প্রতিটা আলাদা bullet/লাইন হিসেবে বসে। রিটার্ন করে পরের
 * কন্টেন্টের Y-position।
 */
export function drawCalloutBox(
  doc: jsPDF,
  lines: string[],
  y: number,
  variant: 'info' | 'warning' | 'success' = 'info',
  reportMeta?: PdfReportMeta
): number {
  const palette: Record<typeof variant, { border: [number, number, number]; bg: [number, number, number]; text: [number, number, number] }> = {
    info: { border: [199, 210, 254], bg: [238, 242, 255], text: [55, 48, 163] },
    warning: { border: [253, 224, 171], bg: [255, 247, 237], text: PDF_WARN_COLOR },
    success: { border: [187, 247, 208], bg: [240, 253, 244], text: PDF_SUCCESS_COLOR },
  }
  const c = palette[variant]
  const boxWidth = contentRightBound(doc, !!reportMeta) - 14
  const lineHeight = 4.6
  const padding = 4
  const boxHeight = padding * 2 + lines.length * lineHeight

  y = ensureSpace(doc, y, boxHeight, reportMeta)

  doc.setFillColor(...c.bg)
  doc.setDrawColor(...c.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(14, y, boxWidth, boxHeight, 2, 2, 'FD')

  doc.setFontSize(8.5)
  doc.setTextColor(...c.text)
  let lineY = y + padding + 3.2
  lines.forEach((line) => {
    doc.text(stripUnrenderableBengali(line), 18, lineY, { maxWidth: boxWidth - 8 })
    lineY += lineHeight
  })

  return y + boxHeight + 6
}

export function formatTaka(amount: number): string {
  // jsPDF-এর built-in font-এ ৳ glyph নেই বলে "Tk" ব্যবহার করা হচ্ছে,
  // ৳ প্রতীক দিলে সেই জায়গায় খালি বক্স/বিকৃত glyph দেখাবে। min ও max
  // fraction digits একই (2) রাখা হয়েছে — নাহলে কোনো টাকা "Tk 1500"
  // আর কোনো টাকা "Tk 1500.5" দেখাত (inconsistent decimal count),
  // financial figure-এ যেটা অপেশাদার দেখায়।
  return `Tk ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * quantity/measurement সংখ্যা (BOQ quantity, area, volume ইত্যাদি)
 * ফরম্যাট করার জন্য একটা কেন্দ্রীয় helper — Phase 6 (Polish)-এর
 * আগে একই BOQItem.quantity ফিল্ড কোথাও 3-decimal-limit সহ
 * (boq-report.pdf.ts) আর কোথাও কোনো limit ছাড়া (cost-report.pdf.ts)
 * ফরম্যাট হতো, একই ডেটা দুই রিপোর্টে দুই রকম দেখাত। এখন সব জায়গায়
 * এই একটা ফাংশন — decimals প্যারামিটার দিয়ে প্রয়োজনমতো precision
 * (যেমন weight-এর জন্য 1-2, দৈর্ঘ্যের জন্য 2-3) কনফিগারযোগ্য, কিন্তু
 * min===max রাখা হয় সবসময় (trailing-zero consistency বজায় রাখতে)।
 */
export function formatQty(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ── Chart helpers (Phase 1 — canvas-ভিত্তিক, কোনো নতুন npm dependency ছাড়াই) ──
//
// Chart.js/recharts ইত্যাদি যোগ করলে নতুন npm dependency লাগত, যা
// এই ecosystem-এর "মোবাইল থেকে GitHub commit → Vercel build, লোকাল
// npm install নেই" ওয়ার্কফ্লোর সাথে ঘর্ষণ তৈরি করত (নতুন প্যাকেজ
// commit করার পর প্রথম build না হওয়া পর্যন্ত ভাঙা থাকার ঝুঁকি)।
// তাই এখানে plain browser <canvas> 2D API দিয়ে bar/pie চার্ট আঁকা
// হচ্ছে, তারপর canvas.toDataURL() থেকে doc.addImage() — এই দুটো
// ফাংশন client-side-only (document/canvas লাগে), তাই শুধু PDF
// generate করার সময় (browser-এ, download button click-এ) কল করা
// উচিত, কখনো SSR/server context থেকে না।

export interface ChartDatum {
  label: string
  value: number
  color?: [number, number, number]
}

/**
 * একটা simple vertical bar chart canvas-এ আঁকে ও PNG data-URL
 * রিটার্ন করে। PDF_CHART_PALETTE থেকে ধারাবাহিকভাবে রঙ বরাদ্দ হয়
 * যদি datum.color না দেওয়া থাকে। widthPx/heightPx হাই-DPI রেন্ডার
 * এর জন্য pdf-এর mm-size-এর চেয়ে বড় রাখা উচিত (২-৩x), তারপর
 * addChartImage()-এ ছোট mm-size-এ বসানো হয় — এতে PDF-এ চার্ট ঝাপসা
 * দেখায় না।
 */
export function renderBarChartImage(
  data: ChartDatum[],
  options?: { widthPx?: number; heightPx?: number; valueFormatter?: (v: number) => string }
): string {
  const widthPx = options?.widthPx ?? 900
  const heightPx = options?.heightPx ?? 500
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, widthPx, heightPx)

  const padding = { top: 30, right: 30, bottom: 70, left: 70 }
  const chartW = widthPx - padding.left - padding.right
  const chartH = heightPx - padding.top - padding.bottom
  const maxVal = Math.max(...data.map((d) => d.value), 1)

  // gridlines + y-axis labels
  ctx.strokeStyle = '#e5e7eb'
  ctx.fillStyle = '#6b7280'
  ctx.font = '20px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'right'
  const gridSteps = 4
  for (let i = 0; i <= gridSteps; i++) {
    const gy = padding.top + chartH - (chartH * i) / gridSteps
    ctx.beginPath()
    ctx.moveTo(padding.left, gy)
    ctx.lineTo(padding.left + chartW, gy)
    ctx.stroke()
    const val = (maxVal * i) / gridSteps
    const label = options?.valueFormatter ? options.valueFormatter(val) : Math.round(val).toLocaleString('en-US')
    ctx.fillText(label, padding.left - 10, gy + 6)
  }

  // bars
  const barGap = chartW / data.length
  const barWidth = barGap * 0.55
  data.forEach((d, i) => {
    const barH = (d.value / maxVal) * chartH
    const x = padding.left + i * barGap + (barGap - barWidth) / 2
    const y = padding.top + chartH - barH
    const [r, g, b] = d.color ?? PDF_CHART_PALETTE[i % PDF_CHART_PALETTE.length]
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(x, y, barWidth, barH)

    // value label on top of bar
    ctx.fillStyle = '#1f2937'
    ctx.textAlign = 'center'
    ctx.font = 'bold 18px Helvetica, Arial, sans-serif'
    const valLabel = options?.valueFormatter ? options.valueFormatter(d.value) : d.value.toLocaleString('en-US')
    ctx.fillText(valLabel, x + barWidth / 2, y - 8)

    // x-axis label (wrapped if long)
    ctx.fillStyle = '#374151'
    ctx.font = '18px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    const label = d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label
    ctx.fillText(label, x + barWidth / 2, padding.top + chartH + 26)
  })

  // axis lines
  ctx.strokeStyle = '#9ca3af'
  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top)
  ctx.lineTo(padding.left, padding.top + chartH)
  ctx.lineTo(padding.left + chartW, padding.top + chartH)
  ctx.stroke()

  return canvas.toDataURL('image/png')
}

/**
 * একটা pie/donut chart canvas-এ আঁকে (donut, কারণ কেন্দ্রে total
 * value দেখানো যায় — cost split-এর মতো জায়গায় দরকারি) এবং পাশে
 * একটা legend সহ PNG data-URL রিটার্ন করে।
 */
export function renderPieChartImage(
  data: ChartDatum[],
  options?: { widthPx?: number; heightPx?: number; valueFormatter?: (v: number) => string; centerLabel?: string }
): string {
  const widthPx = options?.widthPx ?? 900
  const heightPx = options?.heightPx ?? 500
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, widthPx, heightPx)

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1
  const cx = heightPx / 2
  const cy = heightPx / 2
  const outerR = heightPx * 0.38
  const innerR = outerR * 0.55

  let startAngle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2
    const color = d.color ?? PDF_CHART_PALETTE[i % PDF_CHART_PALETTE.length]
    const slice = { ...d, startAngle, endAngle: startAngle + angle, color }
    startAngle += angle
    return slice
  })

  slices.forEach((s) => {
    const [r, g, b] = s.color
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, outerR, s.startAngle, s.endAngle)
    ctx.closePath()
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fill()
  })

  // donut hole
  ctx.beginPath()
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  if (options?.centerLabel) {
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 24px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(options.centerLabel, cx, cy + 8)
  }

  // legend (ডান পাশে)
  const legendX = heightPx + 20
  let legendY = cy - (data.length * 34) / 2 + 10
  ctx.textAlign = 'left'
  slices.forEach((s) => {
    const [r, g, b] = s.color
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(legendX, legendY - 14, 18, 18)

    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Helvetica, Arial, sans-serif'
    ctx.fillText(s.label, legendX + 26, legendY)

    const pct = ((s.value / total) * 100).toFixed(1)
    const valLabel = options?.valueFormatter ? options.valueFormatter(s.value) : s.value.toLocaleString('en-US')
    ctx.fillStyle = '#6b7280'
    ctx.font = '16px Helvetica, Arial, sans-serif'
    ctx.fillText(`${valLabel} (${pct}%)`, legendX + 26, legendY + 20)

    legendY += 46
  })

  return canvas.toDataURL('image/png')
}

/**
 * renderBarChartImage/renderPieChartImage থেকে পাওয়া PNG data-URL
 * PDF-এ বসায়, page-width-এর সাথে সঙ্গতিপূর্ণ mm-size বজায় রেখে
 * (aspect ratio widthPx/heightPx থেকে ধরে রাখা হয়)। রিটার্ন করে
 * পরের কন্টেন্টের Y-position।
 */
export function addChartImage(
  doc: jsPDF,
  dataUrl: string,
  y: number,
  options?: { widthMm?: number; aspectRatio?: number }
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const widthMm = options?.widthMm ?? pageWidth - 28
  const aspect = options?.aspectRatio ?? 900 / 500
  const heightMm = widthMm / aspect

  doc.addImage(dataUrl, 'PNG', 14, y, widthMm, heightMm, undefined, 'FAST')
  return y + heightMm + 8
}

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename)
}

/**
 * সব report-এর filename একই নিয়মে বানানোর জন্য কেন্দ্রীয় helper।
 *
 * ── Phase 6 (Polish) ────────────────────────────────────────────
 * আগে প্রতিটা downloadXxxReportPdf() নিজে নিজে filename বানাত —
 * দুটো সমস্যা ছিল: (১) কোনো তারিখ/সময় ছিল না, তাই একই প্রজেক্টে
 * দ্বিতীয়বার একই রিপোর্ট ডাউনলোড করলে browser নিজে থেকে ফাইলনামের
 * শেষে "(1)" যোগ করত, কোনটা latest বোঝা কঠিন হতো; (২) projectName
 * বাংলায় হলে (এই ecosystem-এ খুবই সাধারণ) সেই ইউনিকোড অক্ষর
 * filename-এ অপরিবর্তিত থেকে যেত, শুধু whitespace sanitize হতো।
 * এই helper দুটোই ঠিক করে: প্রজেক্ট-নাম থেকে non-ASCII/স্পেশাল
 * ক্যারেক্টার সরিয়ে safe slug বানায় (বাংলা নাম হলে খালি slug হতে
 * পারে, সেক্ষেত্রে "Project" fallback), এবং শেষে YYYYMMDD-HHmm
 * টাইমস্ট্যাম্প জোড়ে।
 */
export function buildReportFilename(reportKind: string, projectName: string, generatedAt: number): string {
  const asciiSlug = projectName
    .replace(/[^\x20-\x7E]/g, '') // non-ASCII (বাংলা সহ) বাদ, filename-safe রাখতে
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
  const projectSlug = asciiSlug.length > 0 ? asciiSlug : 'Project'

  const d = new Date(generatedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`

  return `${reportKind}_${projectSlug}_${timestamp}.pdf`
}
