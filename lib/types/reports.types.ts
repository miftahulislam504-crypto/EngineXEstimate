// lib/types/reports.types.ts
//
// Module 13 — এক-ক্লিক export। Original doc-এ ৬টা report (BOQ,
// Quantity, Cost, Material, BBS, Tender) ও ৩টা format (PDF/Excel/Word)
// চাওয়া হয়েছিল। এই প্রথম ধাপে শুধু PDF; Excel/Word পরের ধাপে যোগ হবে
// একই ReportKind/ReportContext কাঠামোর উপর ভিত্তি করে (নতুন করে
// data-aggregation লেখার দরকার হবে না, শুধু নতুন renderer)।
//
// ⚠️ আলাদা CivilOS Reports & Export app (jsPDF, React-PDF, SheetJS,
// Handlebars template engine, ecosystem automation bridge) ইতিমধ্যেই
// আছে। এই Module সেই app না — এটা Estimating app-এর নিজস্ব, হালকা
// ওজনের in-app export (jsPDF সরাসরি ব্যবহার করে, কোনো cross-app
// bridge/template-engine reuse ছাড়া)। কারণ: Reports & Export app
// আলাদা deploy/ecosystem-automation-bridge-নির্ভর একটা প্রজেক্ট,
// আর Estimating app এখনো single-user/standalone অবস্থায় আছে —
// সেই bridge-এর উপর নির্ভরতা তৈরি করলে Estimating app নিজে থেকে PDF
// বানাতে পারত না যদি bridge/network উপলব্ধ না থাকে। ভবিষ্যতে Module
// 15 (Integration Hub) যখন প্রকৃতপক্ষে wire হবে, তখন এই in-app export
// আর Reports & Export app-এর template engine-এর মধ্যে reuse/consolidation
// বিবেচনা করা যেতে পারে — কিন্তু এখনই সেই নির্ভরতা তৈরি করা হয়নি।

export type ReportKind = 'boq' | 'quantity' | 'cost' | 'material' | 'bbs' | 'tender' | 'master'

export type ReportFormat = 'pdf' | 'excel' | 'word'

export interface ReportAvailability {
  kind: ReportKind
  // ডেটা একেবারেই নেই (যেমন কোনো active BOQ version নেই) — বাটন
  // disabled থাকবে, silently empty PDF বানানো হবে না।
  available: boolean
  reasonUnavailable?: string
}

/**
 * প্রতিটা report-এর header-এ সাধারণ তথ্য — project name/code,
 * generate করার তারিখ, ইত্যাদি। সব report builder-এ পুনর্ব্যবহার
 * করা হয় (dashboard.service.ts-এর aggregation প্যাটার্নের মতোই,
 * এখানে ডেটা টাকার বদলে document metadata)।
 */
export interface ReportHeaderInfo {
  projectName: string
  projectCode?: string
  generatedAt: number
  lang: 'en' | 'bn'
}
