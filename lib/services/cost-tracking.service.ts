// lib/services/cost-tracking.service.ts
//
// dashboard.service.ts ও procurement.service.ts-এর একই
// aggregation-pattern — নতুন hisab নেই, শুধু Module 9/10-এর
// existing data জোড়া লাগানো।

import { BudgetEntry, BudgetApproval } from '@/lib/types/budget.types'
import { PurchaseRecord } from '@/lib/types/vendor.types'
import { CostTrackingSummary } from '@/lib/types/cost-tracking.types'
import { getLatestBudgetEntry } from '@/lib/services/budget.service'

export function calculateCostTrackingSummary(
  budgetEntries: BudgetEntry[],
  budgetApprovals: BudgetApproval[],
  purchases: PurchaseRecord[]
): CostTrackingSummary {
  const plannedEntry = getLatestBudgetEntry(budgetEntries.filter((e) => e.type === 'planned'))
  const plannedAmount = plannedEntry?.amount ?? null

  const approvedAmount = budgetApprovals.length > 0 ? budgetApprovals[0].approvedAmount : null

  const actualMaterialCost = purchases.reduce((sum, p) => sum + p.totalAmount, 0)

  const remainingBudget = approvedAmount !== null ? approvedAmount - actualMaterialCost : null
  const isOverBudget = remainingBudget !== null && remainingBudget < 0

  return {
    plannedAmount,
    approvedAmount,
    actualMaterialCost,
    remainingBudget,
    isOverBudget,
  }
}
