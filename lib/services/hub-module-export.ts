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
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase'
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

// ─── Auto-push (কোনো বাটন ছাড়া) ──────────────────────────────────────
//
// import দিকের subscribeToHubQuantityAutoSync()-এর ঠিক বিপরীত দিক।
// Estimate app নিজের ৫টা estimatingInput doc-এ (activeBoqVersion,
// budget, procurementSchedule, rateAnalysis, vendorData — সব
// boq.firestore.ts/budget.firestore.ts/procurement.firestore.ts/
// rate-analysis.firestore.ts/vendor.firestore.ts-এর নিজস্ব path
// কমেন্ট থেকে নেওয়া) onSnapshot listener বসায়। যেকোনো একটা বদলালে
// (ব্যবহারকারী BOQ save করলে, Budget approve করলে, ইত্যাদি) debounce
// করে prepareHubExport()+pushHubExport() চালায় — কোনো নির্দিষ্ট save
// ফাংশনে হুক বসাতে হয় না, তাই ভবিষ্যতে নতুন কোনো estimatingInput doc
// যোগ হলেও (যতক্ষণ নিচের ESTIMATING_INPUT_DOCS তালিকায় যোগ করা হয়)
// auto-push নিজে থেকেই কভার করবে।
//
// debounce কেন দরকার: একটার পর একটা কয়েকটা field দ্রুত বদলালে
// (যেমন BOQ item add করার পর সাথে সাথে Rate Analysis-ও আপডেট) প্রতি
// ছোট পরিবর্তনে আলাদা push+version-bump না করে, শেষ পরিবর্তনের কিছুক্ষণ
// পর একবারই push করা — bumpOwnModuleVersion() প্রতিবার downstream
// (PM app) সব "OUTDATED" মার্ক করে দেয় (Hub-এর dependency cascade,
// dependency.firestore.ts), তাই ঘন ঘন bump না করাই ভালো UX।

const ESTIMATING_INPUT_DOCS = ['activeBoqVersion', 'budget', 'procurementSchedule', 'rateAnalysis', 'vendorData'] as const
const AUTO_PUSH_DEBOUNCE_MS = 4000

export type ExportAutoSyncStatus =
  | { state: 'idle' } // এখনো কোনো পরিবর্তন ধরা পড়েনি এই সেশনে
  | { state: 'pending' } // পরিবর্তন ধরা পড়েছে, debounce টাইমার চলছে
  | { state: 'pushing' } // Hub-এ পাঠানো হচ্ছে
  | { state: 'pushed'; version: number; emptyFields: (keyof EstimatingModuleData)[] }
  | { state: 'error'; message: string }

/**
 * component-mount হওয়া মাত্র estimatingInput-এর ৫টা doc শোনা শুরু
 * করে। কোনোটা বদলালে debounce করে prepareHubExport()+pushHubExport()
 * চালায়, কোনো ব্যবহারকারী-action ছাড়াই। ফলাফল onStatusChange-এ যায়
 * — caller (React hook) শুধু UI-তে স্ট্যাটাস দেখাবে।
 *
 * @returns unsubscribe — সব listener বন্ধ করে + pending debounce
 * timer বাতিল করে।
 */
export function subscribeToHubExportAutoSync(projectId: string, onStatusChange: (status: ExportAutoSyncStatus) => void): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pushing = false
  let pendingWhilePushing = false

  function scheduleAutoPush() {
    onStatusChange({ state: 'pending' })
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(runAutoPush, AUTO_PUSH_DEBOUNCE_MS)
  }

  async function runAutoPush() {
    if (pushing) {
      // ইতিমধ্যে একটা push চলছে — এই মুহূর্তে আরেকটা শুরু না করে, চলমানটা
      // শেষ হলে আবার একবার চালানোর জন্য চিহ্নিত করে রাখা (যাতে সেই
      // মধ্যবর্তী পরিবর্তনটা miss না হয়)
      pendingWhilePushing = true
      return
    }
    pushing = true
    onStatusChange({ state: 'pushing' })
    try {
      const { data, emptyFields } = await prepareHubExport(projectId)
      const newVersion = await pushHubExport(projectId, data)
      onStatusChange({ state: 'pushed', version: newVersion, emptyFields })
    } catch (e) {
      onStatusChange({ state: 'error', message: e instanceof Error ? e.message : 'Hub-এ পাঠাতে ব্যর্থ — অজানা ত্রুটি।' })
    } finally {
      pushing = false
      if (pendingWhilePushing) {
        pendingWhilePushing = false
        scheduleAutoPush()
      }
    }
  }

  const unsubscribers: Unsubscribe[] = ESTIMATING_INPUT_DOCS.map((docName) => {
    let isFirstSnapshot = true // onSnapshot attach হওয়ার সাথে সাথেই একবার fire করে (Firestore-এর নিজস্ব আচরণ) — সেই প্রথম snapshot আসলে "পরিবর্তন" না, শুধু বর্তমান অবস্থা। প্রতিবার page load-এ অকারণে push এড়াতে এটা স্কিপ করা হয়, শুধু *পরবর্তী* snapshot থেকেই push trigger হয়।
    return onSnapshot(
      doc(db, 'projects', projectId, 'estimatingInput', docName),
      () => {
        if (isFirstSnapshot) {
          isFirstSnapshot = false
          return
        }
        scheduleAutoPush()
      },
      () => {
        /* permission/network error — non-critical, পরের সফল snapshot-এ ঠিক হয়ে যাবে (hub-sdk-client.ts-এর কনভেনশন) */
      }
    )
  })

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    unsubscribers.forEach((unsub) => unsub())
  }
}
