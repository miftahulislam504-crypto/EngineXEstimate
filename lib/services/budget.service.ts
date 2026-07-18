// lib/services/budget.service.ts

import { BudgetEntry, BudgetApproval } from '@/lib/types/budget.types'

export interface BudgetValidationResult {
  valid: boolean
  errors: string[]
}

export function validateBudgetEntry(input: { amount: number; reason?: string; type: 'planned' | 'revised' }): BudgetValidationResult {
  const errors: string[] = []
  if (input.amount <= 0) {
    errors.push('Amount শূন্যের বেশি হতে হবে।')
  }
  if (input.type === 'revised' && (!input.reason || input.reason.trim().length === 0)) {
    errors.push('Revised cost-এর জন্য কারণ (reason) দেওয়া বাধ্যতামূলক — নাহলে পরে বোঝা যাবে না কেন বাজেট বদলানো হয়েছিল।')
  }
  return { valid: errors.length === 0, errors }
}

/**
 * সবচেয়ে সাম্প্রতিক entry — কোনো Firestore call নেই, সম্পূর্ণ pure
 * function বলে budget.firestore.ts-এর বদলে এখানে থাকা উচিত ছিল
 * (Module 10 তৈরি করার সময় ভুল ফাইলে রাখা হয়েছিল, Module 11-এ
 * cost-tracking.service.ts থেকে এটা ব্যবহার করতে গিয়ে সেই ভুল
 * ধরা পড়ে এখানে সরানো হয়েছে)। budget.firestore.ts-এ এখন এই
 * ফাংশনের একটা re-export আছে backward-compatibility-র জন্য, যাতে
 * BudgetPanel.tsx-এর existing import ভাঙতে না হয়।
 */
export function getLatestBudgetEntry(entries: BudgetEntry[]): BudgetEntry | null {
  if (entries.length === 0) return null
  return [...entries].sort((a, b) => b.createdAt - a.createdAt)[0]
}

/**
 * Planned vs সবচেয়ে সাম্প্রতিক Approved-এর তুলনা — কত % পার্থক্য, এবং
 * approved amount planned-এর চেয়ে বেশি/কম কিনা।
 */
export interface BudgetComparison {
  plannedAmount: number | null
  latestApprovedAmount: number | null
  differenceAmount: number | null
  differencePercent: number | null
  isOverApproved: boolean // approved > planned
}

export function compareBudget(
  entries: BudgetEntry[],
  approvals: BudgetApproval[]
): BudgetComparison {
  // আগে এখানে সরাসরি sort+filter লেখা ছিল, getLatestBudgetEntry-এর
  // ভেতরের logic-এর সাথে duplicate — এখন সেই ফাংশনই পুনর্ব্যবহার
  // করা হচ্ছে single source of truth রাখার জন্য
  const plannedEntry = getLatestBudgetEntry(entries.filter((e) => e.type === 'planned'))
  const plannedAmount = plannedEntry?.amount ?? null

  const latestApprovedAmount = approvals.length > 0 ? approvals[0].approvedAmount : null

  if (plannedAmount === null || latestApprovedAmount === null) {
    return {
      plannedAmount,
      latestApprovedAmount,
      differenceAmount: null,
      differencePercent: null,
      isOverApproved: false,
    }
  }

  const differenceAmount = latestApprovedAmount - plannedAmount
  const differencePercent = plannedAmount > 0 ? (differenceAmount / plannedAmount) * 100 : 0

  return {
    plannedAmount,
    latestApprovedAmount,
    differenceAmount,
    differencePercent,
    isOverApproved: differenceAmount > 0,
  }
}
