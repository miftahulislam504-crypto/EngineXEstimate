// lib/types/vendor.types.ts
//
// Module 9 — Supplier List, Quotation Collection, Price Comparison,
// Purchase History।
//
// ⚠️ গুরুত্বপূর্ণ: Supplier interface এখানে নতুন করে define করা হয়নি —
// এটা ইতিমধ্যেই lib/types/material.types.ts-এ আছে (Module 5-এ,
// Material.defaultSupplierId রেফারেন্স করার জন্য আগেভাগে বানানো
// হয়েছিল)। এখানে সেটাই re-export করা হচ্ছে, duplicate টাইপ বানানো
// হয়নি — নাহলে Material.defaultSupplierId কোন Supplier shape point
// করছে তা অস্পষ্ট হয়ে যেত।

export type { Supplier } from '@/lib/types/material.types'

/**
 * একটা material/service-এর জন্য supplier-এর দেওয়া quotation। একই
 * supplier একাধিক material-এর জন্য আলাদা quote দিতে পারে, তাই
 * materialId+supplierId combination-ভিত্তিক entry, single value না।
 */
export interface Quotation {
  id: string
  supplierId: string
  materialId: string
  materialName: string // snapshot — rate-analysis.types.ts-এর একই প্যাটার্ন, material পরে rename হলেও পুরনো quotation পড়া যাবে
  quotedRate: number
  quotedAt: number
  validUntil?: number
  notes?: string
}

/**
 * একটা সম্পন্ন ক্রয়ের রেকর্ড — Purchase History-এর জন্য। Quotation
 * থেকে আলাদা কারণ Quotation মানে "প্রস্তাবিত দাম", Purchase মানে
 * "প্রকৃতপক্ষে কেনা হয়েছে"।
 */
export interface PurchaseRecord {
  id: string
  supplierId: string
  materialId: string
  materialName: string
  quantity: number
  unitRate: number
  totalAmount: number
  purchasedAt: number
  invoiceReference?: string
}

/**
 * quotation ও purchase — project-scoped (Module 8/10/12-এর একই
 * প্যাটার্ন), কারণ Purchase Record অবশ্যই একটা নির্দিষ্ট
 * প্রজেক্টের জন্য কেনা, আর Quotation বাস্তবে প্রায়ই project-নির্দিষ্ট
 * bulk-order দামে দেওয়া হয়। শুধু Supplier নিজে organization-wide
 * (Module 5-এর materials collection-এর মতোই, Phase 0-এ rules-এ
 * আগে থেকেই "suppliers" নামে top-level collection রিজার্ভ করা)।
 */
export interface StoredVendorData {
  projectId: string
  updatedAt: number
  quotations: Quotation[]
  purchases: PurchaseRecord[]
}

/**
 * একটা material-এর জন্য সব supplier-এর quotation পাশাপাশি —
 * Price Comparison ফিচারের মূল ভিত্তি।
 */
export interface PriceComparisonRow {
  supplierId: string
  supplierName: string
  quotedRate: number
  quotedAt: number
  isLowest: boolean
}
