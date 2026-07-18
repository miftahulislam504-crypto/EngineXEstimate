// lib/types/contract.types.ts
//
// ⚠️ এই ফাইল CivilOS Hub-এর lib/types/contract.types.ts-এর হুবহু কপি
// (2026-07-17-এ Hub-এর zip থেকে verify করা)। Hub-এর নিজস্ব
// PHASE9_NOTES.md-এ স্পষ্ট লেখা আছে: "যখন সেই App গুলো নিয়ে কাজ হবে,
// এই একই ফাইল সেখানে কপি করে বসানো যাবে।" এটাই সেই কাজ —
// Estimating app-এর নিজস্ব দিক থেকে Module 15 বাস্তবায়ন।
//
// ⚠️ এই ফাইল Hub-এর কপি না করে নিজে থেকে নতুন সংজ্ঞা লিখলে দুই App-এর
// `SourceApp`/`ContractStatus` vocabulary আলাদা হয়ে যেত — সেটা হলে
// একই string ('DRAFT', 'estimating' ইত্যাদি) দুই App-এ ভিন্ন অর্থ বহন
// করত, আর Hub-এর events/approvals collection পড়ার সময় type mismatch
// হতো। তাই হুবহু কপি, নিজের ব্যাখ্যা/মন্তব্য পরিবর্তন ছাড়া।
//
// ভবিষ্যতে Hub এই ফাইল আপডেট করলে (নতুন SourceApp/ContractStatus যোগ
// হলে), এই কপিও ম্যানুয়ালি sync করতে হবে — এই মুহূর্তে কোনো automated
// sync mechanism নেই (npm package হিসেবে publish করা হয়নি)।
// ═══════════════════════════════════════════════════════════════════════════

export const CONTRACT_SCHEMA_VERSION = '1.0' as const

export type SourceApp =
  | 'hub'
  | 'architectural'
  | 'structural'
  | 'estimating'
  | 'projectmgmt'
  | 'reports'

// ─── Envelope ──────────────────────────────────────────────────────────────
export interface ContractEnvelope<T> {
  schemaVersion: typeof CONTRACT_SCHEMA_VERSION
  sourceApp: SourceApp
  projectId: string
  moduleVersion: number
  generatedAt: string // ISO date
  data: T
}

export function wrapContract<T>(
  data: T,
  sourceApp: SourceApp,
  projectId: string,
  moduleVersion: number = 1
): ContractEnvelope<T> {
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    sourceApp,
    projectId,
    moduleVersion,
    generatedAt: new Date().toISOString(),
    data,
  }
}

// ─── Shared Entities ───────────────────────────────────────────────────────
export interface ProjectLevel {
  id: string
  name: string
  elevation: number
  height: number
}

export interface ProjectGrid {
  id: string
  axis: 'X' | 'Y'
  position: number
}

export interface GeometryData {
  [key: string]: unknown
}

export interface BuildingElementRef {
  id: string
  type: string
  levelId: string
  geometry?: GeometryData
  materialId?: string
}

// ─── Contract Status ───────────────────────────────────────────────────────
export type ContractStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'REVIEWED'
  | 'APPROVED'
  | 'OUTDATED'
  | 'REJECTED'
