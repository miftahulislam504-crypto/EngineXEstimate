// lib/services/hub-module-export.ts
//
// hub-module-import.ts (Architectural/Structural থেকে **পড়ার** দিক)-এর
// বিপরীত দিক — এই ফাইল Estimate app নিজের ডেটা **Hub-এ পাঠানোর**
// জন্য একত্র করে (Estimate → Hub → PM, একমুখী; PM → Estimate কোনো
// প্রবাহ নেই — ব্যবহারকারীর স্পষ্ট নির্দেশ)।
//
// Hub-এর EstimatingModuleData (lib/types/module-data.types.ts)-এ ১৯টা
// ফিল্ড আছে। এই ফাইল তার মধ্যে ১৭টা পূরণ করে existing module data
// থেকে (নতুন কোনো data-entry UI ছাড়া) — বাকি ২টা (activityWiseCost,
// paymentStatus) ইচ্ছাকৃতভাবে undefined থাকে, কারণ:
//   - activityWiseCost: Estimate app-এ কোনো "activity/task" concept
//     নেই (এটা schedule/WBS-ভিত্তিক ধারণা), ভবিষ্যতের জন্য ফেলে রাখা
//     হয়েছে (ব্যবহারকারীর সিদ্ধান্ত)।
//   - paymentStatus: ইনভয়েস/পেমেন্ট ট্র্যাকিং সম্পূর্ণ নতুন module,
//     আজকের স্কোপের বাইরে (ব্যবহারকারীর সিদ্ধান্ত)।
//
// ⚠️ finalBoq ও approvedQuantities দুটোই getActiveBOQVersion()-এর
// একই ডেটা থেকে আসে (Estimate app-এ আলাদা "approved" ফ্ল্যাগ নেই,
// active version = approved ধরে নেওয়া হয়েছে — boq.firestore.ts-এর
// setActiveBOQVersion()-এর ডিজাইন অনুযায়ী)। Hub-এর schema-তে এই দুটো
// আলাদা field হিসেবে চাওয়া হয়েছে বলে দুই জায়গাতেই বসানো হচ্ছে,
// ডুপ্লিকেট মনে হলেও এটা Hub-এর contract মেনে চলার জন্য প্রয়োজনীয়।
// একইভাবে materialDemand = materialRequirement, procurementPlan =
// procurementList (Hub-এর schema-তে "requirement" ও "demand"/"plan"
// আলাদা নামে থাকলেও Estimate app-এ এই মুহূর্তে একই উৎস)।

import { getActiveBOQVersion } from '@/lib/firestore/boq.firestore'
import { getRateAnalysis } from '@/lib/firestore/rate-analysis.firestore'
import { listMaterials } from '@/lib/firestore/material.firestore'
import { listResourceRates } from '@/lib/firestore/resource-rate.firestore'
import { getBBS } from '@/lib/firestore/reinforcement.firestore'
import { getBudget, getBudgetApprovalHistory, getLatestApproval } from '@/lib/firestore/budget.firestore'
import { getLatestBudgetEntry } from '@/lib/services/budget.service'
import { getVendorData } from '@/lib/firestore/vendor.firestore'
import { getProcurementSchedule } from '@/lib/firestore/procurement.firestore'
import {
  calculateMaterialProcurementNeeds,
  calculateLabourProcurementNeeds,
  calculateEquipmentProcurementNeeds,
  calculateReinforcementProcurementNeeds,
} from '@/lib/services/procurement.service'
import { calculateCashFlow } from '@/lib/services/cashflow.service'
import { bumpOwnModuleVersion, saveOwnModuleData } from '@/lib/integration/hub-sdk-client'
import type { EstimatingModuleData } from '@/lib/types/module-data.types'

export interface HubModuleExportResult {
  data: EstimatingModuleData
  /** কোন Hub-field আজ ডেটার অভাবে খালি রয়ে গেছে (BOQ/Rate Analysis/
   * Budget কিছুই এখনো তৈরি না হলে স্বাভাবিক) — নাম সরাসরি
   * EstimatingModuleData-এর key। UI-তে caller এই তালিকা দেখিয়ে
   * ব্যবহারকারীকে জানাতে পারবে কেন কিছু field ফাঁকা। */
  emptyFields: (keyof EstimatingModuleData)[]
  /** emptyFields-এর চেয়ে বেশি প্রেক্ষাপট দরকার এমন নোট (যেমন আংশিক
   * ডেটা — সম্পূর্ণ খালি না কিন্তু কিছু অংশ মিসিং) — field নাম না,
   * মানুষ-পঠনযোগ্য বাক্য। */
  warnings: string[]
}

/**
 * Estimate app-এর সব module থেকে ডেটা fetch করে, প্রয়োজনীয়
 * aggregation চালিয়ে (procurement.service.ts/cashflow.service.ts),
 * Hub-এর EstimatingModuleData shape-এ সাজিয়ে দেয়। এটা নিজে
 * saveOwnModuleData() কল করে না — ঠিক hub-module-import.ts-এর
 * prepareHubImport()-এর মতোই prepare/push আলাদা রাখা হয়েছে, যাতে
 * caller (push করার আগে) preview দেখাতে পারে UI-তে।
 */
export async function prepareHubExport(projectId: string): Promise<HubModuleExportResult> {
  const emptyFields: (keyof EstimatingModuleData)[] = []
  const warnings: string[] = []

  const [boqVersion, storedRateAnalysis, materials, labourRates, equipmentRates, storedBBS, storedBudget, budgetApprovals, storedVendorData, storedProcurementSchedule] =
    await Promise.all([
      getActiveBOQVersion(projectId),
      getRateAnalysis(projectId),
      listMaterials(),
      listResourceRates('labour'),
      listResourceRates('equipment'),
      getBBS(projectId),
      getBudget(projectId),
      getBudgetApprovalHistory(projectId),
      getVendorData(projectId),
      getProcurementSchedule(projectId),
    ])

  const boqItems = boqVersion?.items ?? []
  const rateAnalysisEntries = storedRateAnalysis?.entries ?? []
  const bbsRows = storedBBS?.rows ?? []
  const budgetEntries = storedBudget?.entries ?? []
  const purchases = storedVendorData?.purchases ?? []

  if (!boqVersion) emptyFields.push('boq', 'finalBoq', 'approvedQuantities')
  if (rateAnalysisEntries.length === 0) emptyFields.push('rateAnalysis')
  if (budgetEntries.length === 0) emptyFields.push('budget')
  if (budgetApprovals.length === 0) emptyFields.push('costBaseline')
  if (!storedVendorData || (storedVendorData.quotations.length === 0 && purchases.length === 0)) emptyFields.push('vendorInformation')
  if (!storedProcurementSchedule || storedProcurementSchedule.entries.length === 0) emptyFields.push('procurementList', 'procurementPlan')
  if (purchases.length === 0) emptyFields.push('cashFlow')

  const materialRequirement = calculateMaterialProcurementNeeds(boqItems, rateAnalysisEntries, materials)
  const labourRequirement = calculateLabourProcurementNeeds(boqItems, rateAnalysisEntries, labourRates)
  const equipmentRequirement = calculateEquipmentProcurementNeeds(boqItems, rateAnalysisEntries, equipmentRates)
  // reinforcement (rebar) BBS module (Module 7) থেকে আলাদাভাবে হিসাব
  // হয় (materialRequirement RateAnalysisEntry.materials-ভিত্তিক, যেখানে
  // rebar material হিসেবে নাও থাকতে পারে যদি BOQ-তে RCC আলাদা item
  // হিসেবে থাকে এবং তার rebar breakdown BBS-এ হয়, RateAnalysis-এ না)।
  // Hub-এর EstimatingModuleData-তে "reinforcement" নামে আলাদা কোনো
  // ফিল্ড নেই — তাই materialRequirement-এর সাথেই যোগ করে পাঠানো হচ্ছে
  // (diameter-কে materialId হিসেবে ব্যবহার করে, যাতে PM app-এর দিক
  // থেকে material নামের একটাই তালিকায় সব রড-সহ পূর্ণাঙ্গ material
  // চাহিদা দেখা যায়)।
  const reinforcementNeeds = calculateReinforcementProcurementNeeds(bbsRows)
  const fullMaterialRequirement = [
    ...materialRequirement,
    ...reinforcementNeeds.map((r) => ({
      materialId: `rebar-${r.diameterMm}mm`,
      materialName: `Reinforcement Bar — ${r.diameterMm}mm dia`,
      unit: 'kg',
      totalQuantityNeeded: r.totalWeightKg,
    })),
  ]
  if (bbsRows.length === 0) warnings.push('materialRequirement/materialDemand-এ শুধু material.types.ts-ভিত্তিক অংশ আছে — BBS (reinforcement) এখনো খালি, তাই rebar quantity যোগ হয়নি।')

  const latestApproval = getLatestApproval(budgetApprovals)
  const latestRevisedEntry = getLatestBudgetEntry(budgetEntries.filter((e) => e.type === 'revised'))

  const cashFlow = calculateCashFlow(purchases)

  const data: EstimatingModuleData = {
    boq: boqVersion ?? undefined,
    activityWiseCost: undefined, // ইচ্ছাকৃতভাবে খালি — ফাইল-শীর্ষ নোট দ্রষ্টব্য
    materialRequirement: fullMaterialRequirement,
    labourRequirement,
    equipmentRequirement,
    procurementList: storedProcurementSchedule?.entries ?? undefined,
    budget: storedBudget ?? undefined,
    cashFlow,
    rateAnalysis: storedRateAnalysis ?? undefined,
    vendorInformation: storedVendorData ?? undefined,

    finalBoq: boqVersion ?? undefined, // ফাইল-শীর্ষ নোট — boq-এর same source
    approvedQuantities: boqVersion ?? undefined, // ফাইল-শীর্ষ নোট — boq-এর same source
    materialDemand: fullMaterialRequirement, // ফাইল-শীর্ষ নোট — materialRequirement-এর same source
    labourDemand: labourRequirement,
    equipmentDemand: equipmentRequirement,
    procurementPlan: storedProcurementSchedule?.entries ?? undefined, // ফাইল-শীর্ষ নোট — procurementList-এর same source
    costBaseline: latestApproval?.approvedAmount ?? undefined,
    costForecast: latestRevisedEntry?.amount ?? undefined, // সবচেয়ে সাম্প্রতিক 'revised' budget entry-কে forecast হিসেবে ধরা হয়েছে — dedicated forecasting logic নেই, এটাই সবচেয়ে কাছাকাছি existing signal
    paymentStatus: undefined, // ইচ্ছাকৃতভাবে খালি — ফাইল-শীর্ষ নোট দ্রষ্টব্য
  }

  return { data, emptyFields, warnings }
}

/**
 * prepareHubExport()-এর ফলাফল Hub-এ প্রকাশ করে — version bump
 * (bumpOwnModuleVersion, যা নিজেই MODULE_VERSION_BUMPED event emit
 * করে) তারপর saveOwnModuleData()। hub-module-import.ts-এর
 * prepareHubImport()/save-আলাদা-রাখার একই নীতিতে, prepareHubExport()
 * নিজে push করে না — এই ফাংশন UI-এর "Hub-এ পাঠান" বাটনে কল হবে,
 * prepare-এর ফলাফল আগে preview হিসেবে দেখানোর পর।
 */
export async function pushHubExport(projectId: string, data: EstimatingModuleData): Promise<number> {
  const newVersion = await bumpOwnModuleVersion(projectId)
  await saveOwnModuleData(projectId, data as Record<string, unknown>, newVersion)
  return newVersion
}
