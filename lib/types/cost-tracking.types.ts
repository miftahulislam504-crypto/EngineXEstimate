// lib/types/cost-tracking.types.ts
//
// Module 11 — Planned vs Actual Cost, Remaining Budget।
//
// ⚠️ Original doc বলেছিল "Actual Cost — Project Management App থেকে
// আসবে", কিন্তু সেই app এখনো তৈরি হয়নি (Module 1/2/7/8-এর একই
// কারণ)। তাই সম্পূর্ণ Actual Cost (labour, equipment rental সহ)
// এখনো ট্র্যাক করা সম্ভব না।
//
// কিন্তু সম্পূর্ণ blocked না: Module 9 (Vendor Management)-এর
// PurchaseRecord[]-এ প্রকৃত material ক্রয়ের রেকর্ড ইতিমধ্যেই আছে
// (কে, কী, কবে, কত টাকায়)। তাই এই Module "Actual Cost" হিসেবে
// Purchase Record-এর যোগফল ব্যবহার করে — এটা আংশিক (শুধু material
// spend, labour/equipment actual খরচ বাদ), কিন্তু real data-driven,
// কোনো অনুমান বা placeholder সংখ্যা না।

export interface CostTrackingSummary {
  plannedAmount: number | null // Module 10 থেকে
  approvedAmount: number | null // Module 10 থেকে
  actualMaterialCost: number // Module 9-এর PurchaseRecord থেকে যোগফল — এটাই বর্তমানে একমাত্র "actual" component
  remainingBudget: number | null // approvedAmount - actualMaterialCost (approvedAmount না থাকলে null)
  isOverBudget: boolean
}
