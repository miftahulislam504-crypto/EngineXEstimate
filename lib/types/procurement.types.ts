// lib/types/procurement.types.ts
//
// Module 8 — BOQ থেকে material quantity বের করা (কত Cement, কত Rod
// লাগবে), procurement schedule।
//
// ⚠️ কীভাবে material-quantity বের হয়: BOQ item-এ (Module 3) শুধু
// item-level quantity আছে (যেমন "RCC: 45.2 m³") — raw material
// quantity না। কিন্তু Module 4 (Rate Analysis)-এ প্রতিটা BOQ
// item-এর RateAnalysisEntry.materials-এ materialId ও
// quantityPerUnit ইতিমধ্যে আছে ("RCC-এর প্রতি m³-এ কত ব্যাগ
// সিমেন্ট")। তাই এই ফাইলে নতুন কোনো data-entry UI লাগেনি — শুধু
// existing BOQ + Rate Analysis data থেকে aggregate করা, ঠিক Module 1
// (Dashboard)-এর dashboard.service.ts যেভাবে টাকার total বের করেছিল,
// এখানে material-quantity বের করা হচ্ছে একই পদ্ধতিতে।

export interface MaterialProcurementNeed {
  materialId: string
  materialName: string
  unit: string
  totalQuantityNeeded: number
}

export interface ReinforcementProcurementNeed {
  diameterMm: number
  totalWeightKg: number
}

/**
 * "কখন লাগবে" — Project Management App-এর schedule/phase data লাগবে
 * (original doc নিজেই এটা বলেছিল), যেটা এখনো তৈরি হয়নি। তাই এই
 * টাইপটা এখন forward-declared রাখা হলো, কোনো data source এখনো নেই।
 */
export interface ProcurementTimelineEntry {
  materialId: string
  neededByDate: number // epoch ms
  phaseLabel?: string
}

/**
 * একটা manual procurement schedule entry — যেহেতু Project
 * Management app এখনো নেই, timeline manually ট্র্যাক করার সুযোগ
 * রাখা হলো (Module 2/7-এর মতোই manual-fallback প্যাটার্ন)।
 */
export interface ProcurementScheduleEntry {
  id: string
  materialId: string
  materialName: string
  targetQuantity: number
  neededByDate?: number
  status: 'pending' | 'ordered' | 'received'
  notes?: string
  createdAt: number
}

export interface StoredProcurementSchedule {
  projectId: string
  updatedAt: number
  entries: ProcurementScheduleEntry[]
}
