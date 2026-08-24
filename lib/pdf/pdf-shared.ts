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
 * প্রতিটা report PDF-এর প্রথম পাতার উপরে বসানো standard header —
 * app name (vector logo mark সহ), report title, project name/code,
 * generated-at timestamp।
 * Returns the Y position where the caller should start drawing body content.
 */
export function drawPdfHeader(doc: jsPDF, meta: PdfReportMeta): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  drawLogoMark(doc, 14, 8, 9)

  doc.setFontSize(9)
  doc.setTextColor(...PDF_MUTED_COLOR)
  doc.text('EngineX Quanta', 26, 13)

  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.text(meta.reportTitle, 14, 25)
  doc.setFont('helvetica', 'normal')

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  const projectLine = meta.projectCode ? `${meta.projectName} (${meta.projectCode})` : meta.projectName
  doc.text(projectLine, 14, 32)

  doc.setFontSize(8)
  doc.setTextColor(...PDF_MUTED_COLOR)
  const generatedLabel = `Generated: ${new Date(meta.generatedAt).toLocaleString('en-US')}`
  doc.text(generatedLabel, pageWidth - 14, 12, { align: 'right' })

  doc.setDrawColor(...PDF_BRAND_COLOR)
  doc.setLineWidth(0.6)
  doc.line(14, 36, pageWidth - 14, 36)

  return 43
}

/**
 * প্রতিটা পাতার নিচে page number — multi-page report-এ (BOQ, BBS
 * বড় হতে পারে) কোন পাতা কততম তা বোঝার জন্য জরুরি। startPage দিয়ে
 * নির্দিষ্ট রেঞ্জ থেকে ফুটার বসানো যায় (যেমন cover page-এর পরের
 * পাতাগুলোতে, cover page নিজে বাদ দিয়ে)।
 */
export function drawPdfFooter(doc: jsPDF, options?: { startPage?: number }): void {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const startPage = options?.startPage ?? 1

  for (let i = startPage; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(225, 225, 225)
    doc.setLineWidth(0.2)
    doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13)
    doc.setFontSize(8)
    doc.setTextColor(...PDF_MUTED_COLOR)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
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
 * ব্যবহার ঐচ্ছিক: ছোট/simple রিপোর্টে (single-table) শুধু
 * drawPdfHeader ব্যবহার চালিয়ে যাওয়া যায়; cover page মূলত multi-
 * section রিপোর্ট (Cost, Tender, Master Report) ও দৃশ্যমান
 * professional presentation-এর জন্য।
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
    doc.text(options.subtitle, cx, subtitleY, { align: 'center' })
    afterTitleBlockY = subtitleY + 16
  }

  // ── Title-block — MICON-স্টাইল drawing-এর "Job Title/Consultant/
  // Client" তথ্য-ব্লকের ধারণা, কিন্তু রঙিন বর্ডার-ফ্রেম ছাড়া: একটা
  // হালকা-বর্ডার rounded box-এ label-uppercase + value দুই-কলাম গ্রিড।
  // clientName/location না থাকলে (Hub import-ভিত্তিক পুরনো caller)
  // সেই row বাদ পড়ে — খালি "—" দেখানো হয় না।
  const rows: { label: string; value: string }[] = [
    { label: 'PROJECT', value: meta.projectCode ? `${meta.projectName} (${meta.projectCode})` : meta.projectName },
  ]
  if (meta.clientName) rows.push({ label: 'CLIENT', value: meta.clientName })
  if (meta.location) rows.push({ label: 'LOCATION', value: meta.location })
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
 */
export function drawPdfTable(
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: RowInput[],
  options?: { columnStyles?: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }> }
): number {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'striped',
    headStyles: { fillColor: PDF_BRAND_COLOR, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: 30 },
    alternateRowStyles: { fillColor: [245, 247, 245] },
    margin: { left: 14, right: 14 },
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
 * পাতা যোগ করে (reportMeta দেওয়া থাকলে drawPdfHeader() দিয়ে সেই
 * নতুন পাতায় হেডারও বসায়) এবং content শুরুর নতুন Y রিটার্ন করে।
 * reportMeta না দিলে (ঐচ্ছিক, backward-compat কারণে) শুধু raw
 * doc.addPage() করে, কোনো header ছাড়া।
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
    return reportMeta ? drawPdfHeader(doc, reportMeta) : 20
  }
  return y
}

export function drawSectionTitle(doc: jsPDF, title: string, y: number, reportMeta?: PdfReportMeta): number {
  y = ensureSpace(doc, y, 10, reportMeta)
  doc.setFillColor(...PDF_BRAND_COLOR)
  doc.rect(14, y - 4, 1.2, 5.5, 'F')

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(title, 18, y)
  doc.setFont('helvetica', 'normal')
  return y + 6
}

/**
 * একটা key-value সারাংশ লাইন (যেমন "Total Project Cost: ৳12,34,500")
 * — table-এর বাইরে বড় summary number দেখানোর জন্য।
 */
export function drawSummaryLine(doc: jsPDF, label: string, value: string, y: number, reportMeta?: PdfReportMeta): number {
  y = ensureSpace(doc, y, 8, reportMeta)
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(label, 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(value, 90, y)
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
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const gap = 4
  const totalWidth = pageWidth - margin * 2
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
  const pageWidth = doc.internal.pageSize.getWidth()
  const boxWidth = pageWidth - 28
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
    doc.text(line, 18, lineY, { maxWidth: boxWidth - 8 })
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
