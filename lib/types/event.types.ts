// lib/types/event.types.ts
//
// ⚠️ Hub-এর lib/types/event.types.ts-এর হুবহু কপি (contract.types.ts-এর
// উপরের নোট দেখুন)।
//
// Estimating-এর দিক থেকে গুরুত্বপূর্ণ: 'QUANTITY_CALCULATED',
// 'BOQ_GENERATED', 'COST_CALCULATED', 'ESTIMATE_UPDATED',
// 'ESTIMATE_APPROVED' — এই ৫টা event টাইপ প্ল্যানে Estimating-এর
// জন্যই সংরক্ষিত ছিল (Hub-এর কোনো emitter নেই, কারণ Estimating
// app-ই এগুলো emit করার কথা)। lib/integration/hub-events.ts-এ এই
// এখন সত্যিই emit করা হচ্ছে Module 2/3/4/9-এর সঠিক পয়েন্টে।

import { SourceApp } from './contract.types'

export type HubEventType =
  // ── Hub internal ──
  | 'MODULE_VERSION_BUMPED'
  | 'MODULE_DEPENDENCY_LINKED'
  | 'MODULE_APPROVED'
  | 'MODULE_REJECTED'
  | 'MODULE_OUTDATED'
  | 'MODULE_STATUS_CHANGED'
  | 'WORKFLOW_STAGE_CHANGED'
  | 'REPORT_GENERATED'

  // ── Architectural ──
  | 'ARCH_MODEL_UPDATED'
  | 'ARCH_MODEL_VALIDATED'
  | 'ARCH_MODEL_APPROVED'

  // ── Structural ──
  | 'STRUCT_MODEL_CREATED'
  | 'ANALYSIS_COMPLETED'
  | 'DESIGN_COMPLETED'
  | 'FOUNDATION_COMPLETED'
  | 'STRUCT_DESIGN_APPROVED'

  // ── Estimating ──
  | 'QUANTITY_CALCULATED'
  | 'BOQ_GENERATED'
  | 'COST_CALCULATED'
  | 'ESTIMATE_UPDATED'
  | 'ESTIMATE_APPROVED'

  // ── Project Management ──
  | 'PROJECT_STARTED'
  | 'PROGRESS_UPDATED'
  | 'COST_UPDATED'
  | 'DELAY_DETECTED'
  | 'MILESTONE_COMPLETED'
  | 'PROJECT_COMPLETED'

// `projects/{projectId}/events/{eventId}`
export interface HubEvent {
  id: string
  projectId: string
  type: HubEventType
  sourceApp: SourceApp
  payload?: Record<string, unknown>
  createdAt: string // ISO
}

export const EVENT_LABELS_BN: Partial<Record<HubEventType, string>> = {
  MODULE_VERSION_BUMPED: 'সংস্করণ আপডেট হয়েছে',
  MODULE_DEPENDENCY_LINKED: 'নির্ভরতা লিংক করা হয়েছে',
  MODULE_APPROVED: 'অনুমোদিত হয়েছে',
  MODULE_REJECTED: 'প্রত্যাখ্যাত হয়েছে',
  MODULE_OUTDATED: 'পুরনো হয়ে গেছে (স্বয়ংক্রিয়)',
  MODULE_STATUS_CHANGED: 'অবস্থা পরিবর্তিত হয়েছে',
  WORKFLOW_STAGE_CHANGED: 'Workflow স্টেজ পরিবর্তিত হয়েছে',
  REPORT_GENERATED: 'রিপোর্ট তৈরি হয়েছে',
  QUANTITY_CALCULATED: 'Quantity গণনা হয়েছে',
  BOQ_GENERATED: 'BOQ তৈরি হয়েছে',
  COST_CALCULATED: 'Cost গণনা হয়েছে',
  ESTIMATE_UPDATED: 'Estimate আপডেট হয়েছে',
  ESTIMATE_APPROVED: 'Estimate অনুমোদিত হয়েছে',
}
