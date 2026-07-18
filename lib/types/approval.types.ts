// lib/types/approval.types.ts
//
// ⚠️ Hub-এর lib/types/approval.types.ts-এর হুবহু কপি (contract.types.ts-এর
// উপরের নোট দেখুন)।

import { ContractStatus } from './contract.types'
import { ModuleId } from './dependency.types'

export interface ApprovalActor {
  uid: string
  email: string | null
  displayName: string | null
}

export const SYSTEM_ACTOR: ApprovalActor = {
  uid: 'system',
  email: null,
  displayName: 'সিস্টেম (স্বয়ংক্রিয়)',
}

// `projects/{projectId}/approvals/{moduleId}` — বর্তমান অবস্থা।
export interface ApprovalRecord {
  moduleId: ModuleId
  status: ContractStatus
  approvedVersion: number
  actedBy: ApprovalActor
  actedAt: string // ISO
  note?: string
}

// `projects/{projectId}/approvals/{moduleId}/history/{historyId}`
export interface ApprovalHistoryEntry extends ApprovalRecord {
  id: string
}

export type { ContractStatus }
