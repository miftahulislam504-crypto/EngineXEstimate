// lib/types/budget.types.ts
//
// Module 10 — Planned Cost, Approved Cost, Revised Cost। Phase 0-এ
// Firestore rules-এ আগেভাগে path নির্ধারণ করা হয়েছিল:
// projects/{projectId}/budgetApproval/{docId} — শুধু write
// admin-only (read সবার জন্য)।
//
// rules-এর path নাম "budgetApproval" (পুরো "budget" না) থেকে ডিজাইন
// intent স্পষ্ট: শুধু approval action-টা গেট করা, Planned/Revised
// Cost এন্ট্রি করা না। তাই এই schema-তে দুই ভাগ:
//
// - BudgetEntry (Planned/Revised) — projects/{projectId}/estimatingInput/budget-এ
//   থাকবে, generic wildcard rule দিয়ে কভার (যে কোনো signed-in user
//   লিখতে পারবে)
// - BudgetApproval — projects/{projectId}/budgetApproval/{docId}-এ,
//   admin-only write

export type BudgetCostType = 'planned' | 'revised'

/**
 * একটা Planned বা Revised cost entry। BOQ-এর মতো versioned রাখা
 * হয়নি — বরং প্রতিটা entry নিজেই একটা timestamped record, তাই
 * "history" মানে এই array-এর সব entry, নতুন entry পুরনোটা মুছে
 * দেয় না (revision track করার জন্যই এটা দরকার)।
 */
export interface BudgetEntry {
  id: string
  type: BudgetCostType
  amount: number
  reason?: string // Revised cost-এর ক্ষেত্রে কেন revise করা হলো (যেমন "material rate বৃদ্ধির কারণে")
  createdAt: number
  createdBy?: string // uid
}

/**
 * Approval — admin-only write path। একটা project-এ একাধিকবার
 * approve হতে পারে (যদি বাজেট revise হয়ে আবার approve করা লাগে),
 * তাই এটাও entry-ভিত্তিক, single "the approval" ধরে নেওয়া হয়নি।
 */
export interface BudgetApproval {
  id: string
  approvedAmount: number
  basedOnEntryId: string // কোন BudgetEntry (সাধারণত সবচেয়ে সাম্প্রতিক planned/revised)-এর ভিত্তিতে approve করা হলো
  approvedAt: number
  approvedBy?: string // uid — Firestore rules নিশ্চিত করে এই uid-এর estimatingRole 'admin', কিন্তু আমরা নিজেও রেখে দিচ্ছি রেফারেন্সের জন্য
  note?: string
}

export interface StoredBudget {
  projectId: string
  updatedAt: number
  entries: BudgetEntry[]
}

export interface StoredBudgetApprovals {
  projectId: string
  updatedAt: number
  approvals: BudgetApproval[]
}
