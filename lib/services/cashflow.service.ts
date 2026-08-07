// lib/services/cashflow.service.ts
//
// Hub-এর EstimatingModuleData.cashFlow-এর জন্য — সময়ের সাথে ছড়ানো
// খরচের schedule। Estimate app-এ কোনো planned-cashflow UI নেই (এবং আজ
// বানানো হচ্ছে না, ব্যবহারকারীর সিদ্ধান্ত অনুযায়ী), তাই এই মুহূর্তে
// শুধু **actual** cash flow — vendor.types.ts-এর PurchaseRecord[]
// (Module 9)-এর প্রতিটা এন্ট্রির purchasedAt+totalAmount থেকে
// মাস-ভিত্তিক গ্রুপ করে যোগফল বের করা।
//
// নতুন কোনো data-entry UI লাগে না (procurement.service.ts-এর একই
// নীতি — existing module output থেকে aggregate), কারণ PurchaseRecord
// ইতিমধ্যে Module 9 (Vendor Management)-এ তৈরি হয়।
//
// ⚠️ সীমাবদ্ধতা স্পষ্ট রাখা হলো: এটা শুধু material purchase spend
// (cost-tracking.types.ts-এর CostTrackingSummary-ও একই সীমাবদ্ধতা
// বহন করে) — labour/equipment-এর actual খরচ এখানে নেই, কারণ Module 9
// শুধু material purchase ট্র্যাক করে। "সম্পূর্ণ actual cash flow" না,
// "material spend cash flow" — নাম বিভ্রান্তিকর না করার জন্য নিচের
// টাইপে এটা স্পষ্ট করে বলা আছে।

import { PurchaseRecord } from '@/lib/types/vendor.types'

export interface CashFlowMonthEntry {
  month: string // 'YYYY-MM' ফরম্যাট, sort-friendly
  actualMaterialSpend: number
  purchaseCount: number
}

export interface CashFlowSummary {
  months: CashFlowMonthEntry[]
  totalActualMaterialSpend: number
  /** ⚠️ শুধু material purchase spend — labour/equipment actual খরচ
   * এখানে নেই (cost-tracking.types.ts-এর CostTrackingSummary-এর একই
   * সীমাবদ্ধতা, উপরের ফাইল-নোট দ্রষ্টব্য)। এই flag রাখা হয়েছে যাতে
   * downstream consumer (PM app) ভুলবশত এটাকে "সম্পূর্ণ cash flow"
   * হিসেবে না ধরে। */
  isPartial: true
}

/**
 * PurchaseRecord[]-কে purchasedAt-এর মাস অনুযায়ী গ্রুপ করে, প্রতি
 * মাসের totalAmount যোগফল বের করে। মাস-key sort-friendly ('YYYY-MM')
 * রাখা হয়েছে যাতে caller string sort দিয়েই chronological order পায়,
 * আলাদা date-parsing ছাড়া।
 */
export function calculateCashFlow(purchases: PurchaseRecord[]): CashFlowSummary {
  const byMonth: Record<string, CashFlowMonthEntry> = {}

  for (const p of purchases) {
    const d = new Date(p.purchasedAt)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    if (!byMonth[month]) {
      byMonth[month] = { month, actualMaterialSpend: 0, purchaseCount: 0 }
    }
    byMonth[month].actualMaterialSpend += p.totalAmount
    byMonth[month].purchaseCount += 1
  }

  const months = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))
  const totalActualMaterialSpend = months.reduce((sum, m) => sum + m.actualMaterialSpend, 0)

  return { months, totalActualMaterialSpend, isPartial: true }
}
