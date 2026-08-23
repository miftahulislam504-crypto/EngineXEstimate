// lib/services/dashboard.service.ts
//
// Module 1 (Dashboard)-এর মূল কাজ: এখন পর্যন্ত বানানো Module
// (2-7)-এর data aggregate করে project-level summary দেখানো। এই
// ফাইলে নিজে থেকে কোনো নতুন hisab নেই, শুধু existing Module-এর
// output জোড়া লাগানো — একটা গুরুত্বপূর্ণ ব্যতিক্রম বাদে, নিচে।
//
// ⚠️ ধরা পড়া gap: RateAnalysisCostBreakdown.finalRate একটা BOQ
// item-এর **প্রতি-unit** rate (যেমন প্রতি m³ RCC-এর দাম)।
// Dashboard-এর "Total Project Cost" দরকার quantity দিয়ে গুণ করা
// **মোট** cost — এই গুণটা Module 4 (Rate Analysis)-এ কোথাও করা হয়নি,
// কারণ সেই Module-এর কাজ ছিল শুধু rate নির্ধারণ, project total না।
// এই ফাইলেই প্রথমবার সেই গুণ করা হচ্ছে।

import { RateAnalysisEntry } from '@/lib/types/rate-analysis.types'
import { BOQItem, BOQItemSource } from '@/lib/types/boq.types'
import { Material } from '@/lib/types/material.types'
import { ResourceRate } from '@/lib/types/resource-rate.types'
import { calculateRateFromLoadedRates } from '@/lib/services/rate-analysis.service'

export interface ProjectCostSummary {
  totalMaterialCost: number
  totalLabourCost: number
  totalEquipmentCost: number
  totalOverheadAmount: number
  totalProfitAmount: number
  totalProjectCost: number // সবকিছুর যোগফল — এটাই Dashboard-এর "Total Project Cost"
  itemsWithoutRateAnalysis: string[] // যে BOQ item-এর কোনো Rate Analysis entry নেই, তাদের নাম — Dashboard-এ এই cost বাদ পড়েছে সেটা জানানোর জন্য
}

/**
 * একটা BOQ item-এর project-level cost contribution (rate ×
 * quantity, প্রতিটা component আলাদা) — নেই RateAnalysisEntry থাকলে
 * undefined। calculateProjectCostSummary()/summarizeCostByTrade()/
 * summarizeCostByFloor() — তিনটাই এই একই per-item হিসাব পুনর্ব্যবহার
 * করে, যাতে rate×quantity গুণের যুক্তি একটাই জায়গায় থাকে (আগে শুধু
 * calculateProjectCostSummary()-এর ভেতরে ইনলাইন ছিল, ২০২৬-০৮-২০-এ
 * trade/floor breakdown যোগ করার সময় বের করে আলাদা করা হলো)।
 */
interface ItemCostContribution {
  materialCost: number
  labourCost: number
  equipmentCost: number
  overheadAmount: number
  profitAmount: number
  totalCost: number
}

function calculateItemCostContribution(
  boqItem: BOQItem,
  rateAnalysisEntries: RateAnalysisEntry[],
  materials: Material[],
  labourRates: ResourceRate[],
  equipmentRates: ResourceRate[]
): ItemCostContribution | undefined {
  const entry = rateAnalysisEntries.find((e) => e.boqItemId === boqItem.id)
  if (!entry) return undefined

  const { breakdown } = calculateRateFromLoadedRates(entry, materials, labourRates, equipmentRates)

  const materialCost = breakdown.materialCost * boqItem.quantity
  const labourCost = breakdown.labourCost * boqItem.quantity
  const equipmentCost = breakdown.equipmentCost * boqItem.quantity
  const overheadAmount = breakdown.overheadAmount * boqItem.quantity
  const profitAmount = breakdown.profitAmount * boqItem.quantity

  return {
    materialCost,
    labourCost,
    equipmentCost,
    overheadAmount,
    profitAmount,
    totalCost: materialCost + labourCost + equipmentCost + overheadAmount + profitAmount,
  }
}

/**
 * প্রতিটা BOQ item-এর rate (Module 4 থেকে) তার quantity (Module 3
 * থেকে) দিয়ে গুণ করে project-level cost summary বানায়। যে BOQ
 * item-এর কোনো RateAnalysisEntry নেই, তার cost 0 ধরা হয় কিন্তু
 * itemsWithoutRateAnalysis-এ নাম রাখা হয় — Dashboard-এ এটা
 * silently বাদ না দিয়ে স্পষ্ট করে জানানো উচিত যে সেই item-এর
 * টাকা এখনো হিসাবে ধরা হয়নি।
 */
export function calculateProjectCostSummary(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[],
  materials: Material[],
  labourRates: ResourceRate[],
  equipmentRates: ResourceRate[]
): ProjectCostSummary {
  let totalMaterialCost = 0
  let totalLabourCost = 0
  let totalEquipmentCost = 0
  let totalOverheadAmount = 0
  let totalProfitAmount = 0
  const itemsWithoutRateAnalysis: string[] = []

  for (const boqItem of boqItems) {
    const contribution = calculateItemCostContribution(boqItem, rateAnalysisEntries, materials, labourRates, equipmentRates)
    if (!contribution) {
      itemsWithoutRateAnalysis.push(boqItem.itemName)
      continue
    }

    totalMaterialCost += contribution.materialCost
    totalLabourCost += contribution.labourCost
    totalEquipmentCost += contribution.equipmentCost
    totalOverheadAmount += contribution.overheadAmount
    totalProfitAmount += contribution.profitAmount
  }

  const totalProjectCost =
    totalMaterialCost + totalLabourCost + totalEquipmentCost + totalOverheadAmount + totalProfitAmount

  return {
    totalMaterialCost,
    totalLabourCost,
    totalEquipmentCost,
    totalOverheadAmount,
    totalProfitAmount,
    totalProjectCost,
    itemsWithoutRateAnalysis,
  }
}

/**
 * Cost Breakdown Chart-এর জন্য ডেটা — pie/bar chart-এ সরাসরি বসানো
 * যাবে এমন shape।
 */
export interface CostBreakdownSlice {
  label: string
  value: number
}

export function toCostBreakdownChartData(summary: ProjectCostSummary): CostBreakdownSlice[] {
  return [
    { label: 'Material', value: summary.totalMaterialCost },
    { label: 'Labour', value: summary.totalLabourCost },
    { label: 'Equipment', value: summary.totalEquipmentCost },
    { label: 'Overhead', value: summary.totalOverheadAmount },
    { label: 'Profit', value: summary.totalProfitAmount },
  ].filter((slice) => slice.value > 0) // শূন্য অংশ chart-এ না দেখানোই ভালো
}

// ═══════════════════════════════════════════════════════════════
// ২০২৬-০৮-২০ যোগ — Trade-wise ও Floor-wise cost breakdown, Cost per
// sqft/sqm (CivilOS-Report-Audit.md gap #4: "Cost Summary শুধু
// resource-type-wise, কোনো trade-wise বা floor-wise breakdown নেই")
// ═══════════════════════════════════════════════════════════════

/**
 * "Trade" এখানে BOQItem.source-এর ওপর ভিত্তি করে (RCC/Earthwork/
 * Masonry/Finishing/Stair/Doors & Windows/Manual) — boq-report.pdf.ts-এর
 * TRADE_GROUPS একই grouping ব্যবহার করে, সেখানকার একই যুক্তি এখানেও
 * প্রযোজ্য: এটাই একমাত্র grouping যা ডেটাতে সত্যিই আছে (প্রতিটা
 * BOQItem-এর নিজস্ব category-metadata হিসেবে source ফিল্ড), বানানো
 * category বসানো হয়নি।
 */
export interface TradeCostSlice {
  source: BOQItemSource
  label: string
  totalCost: number
  itemCount: number
}

const TRADE_LABELS: Record<BOQItemSource, string> = {
  auto_rcc: 'RCC',
  auto_earthwork: 'Earthwork',
  auto_masonry: 'Masonry',
  auto_finishing: 'Finishing',
  auto_stair: 'Stair',
  auto_doors_windows: 'Doors & Windows',
  auto_electrical: 'Electrical', // ２０２৬-０৮-２０ যোগ (audit gap #1)
  auto_plumbing: 'Plumbing & Sanitary', // উপরের নোট দ্রষ্টব্য
  manual: 'Manual / Custom',
}

/**
 * প্রতিটা BOQ item-কে তার source (trade) অনুযায়ী গ্রুপ করে cost
 * summary — RateAnalysisEntry না থাকা item এখানেও বাদ পড়ে (0 cost,
 * calculateProjectCostSummary()-এর itemsWithoutRateAnalysis-এর
 * সাথে ধারাবাহিক আচরণ), কিন্তু trade-level এ আলাদাভাবে সেই warning
 * ফেরত দেওয়া হয় না — caller প্রয়োজনে
 * calculateProjectCostSummary().itemsWithoutRateAnalysis থেকে পুরো
 * তালিকা পাবে।
 */
export function summarizeCostByTrade(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[],
  materials: Material[],
  labourRates: ResourceRate[],
  equipmentRates: ResourceRate[]
): TradeCostSlice[] {
  const bySource = new Map<BOQItemSource, { totalCost: number; itemCount: number }>()

  for (const boqItem of boqItems) {
    const contribution = calculateItemCostContribution(boqItem, rateAnalysisEntries, materials, labourRates, equipmentRates)
    const existing = bySource.get(boqItem.source) ?? { totalCost: 0, itemCount: 0 }
    existing.totalCost += contribution?.totalCost ?? 0
    existing.itemCount += 1
    bySource.set(boqItem.source, existing)
  }

  return Array.from(bySource.entries())
    .map(([source, { totalCost, itemCount }]) => ({ source, label: TRADE_LABELS[source], totalCost, itemCount }))
    .filter((slice) => slice.itemCount > 0)
    .sort((a, b) => b.totalCost - a.totalCost) // সবচেয়ে বড় trade আগে — cost report-এ এই ক্রম প্রচলিত
}

/**
 * প্রতিটা BOQ item-কে তার floorId অনুযায়ী গ্রুপ করে cost summary —
 * floorId undefined (project-wide item, কোনো নির্দিষ্ট floor-এর না)
 * হলে সেগুলো একটা "Unassigned" গ্রুপে পড়ে, যাতে মোট যোগফল
 * calculateProjectCostSummary().totalProjectCost-এর সাথে মেলে
 * (কোনো item silently বাদ না পড়ে)।
 */
export interface FloorCostSlice {
  floorId: string // 'unassigned' বিশেষ sentinel — UI-তে t('costUnassignedFloor') দিয়ে label করা উচিত
  totalCost: number
  itemCount: number
}

const UNASSIGNED_FLOOR_ID = 'unassigned'

export function summarizeCostByFloor(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[],
  materials: Material[],
  labourRates: ResourceRate[],
  equipmentRates: ResourceRate[]
): FloorCostSlice[] {
  const byFloor = new Map<string, { totalCost: number; itemCount: number }>()

  for (const boqItem of boqItems) {
    const contribution = calculateItemCostContribution(boqItem, rateAnalysisEntries, materials, labourRates, equipmentRates)
    const floorId = boqItem.floorId ?? UNASSIGNED_FLOOR_ID
    const existing = byFloor.get(floorId) ?? { totalCost: 0, itemCount: 0 }
    existing.totalCost += contribution?.totalCost ?? 0
    existing.itemCount += 1
    byFloor.set(floorId, existing)
  }

  return Array.from(byFloor.entries())
    .map(([floorId, { totalCost, itemCount }]) => ({ floorId, totalCost, itemCount }))
    .filter((slice) => slice.itemCount > 0)
}

/**
 * Cost per sqft ও per sqm — audit gap #4-এর অংশ। totalFloorAreaSqft
 * Module 2 (Quantity Takeoff)-এর ArchitecturalFloorQuantities.floorAreaSqft
 * সবগুলো floor যোগ করে caller-কে দিতে হবে (এই ফাইলে quantity-takeoff
 * ডেটা নেই, caller — Dashboard component — উভয় সোর্স একসাথে ব্যবহার
 * করবে)। totalFloorAreaSqft শূন্য/অনুপস্থিত হলে undefined রিটার্ন
 * করে (division-by-zero এড়াতে, "Infinity" দেখানোর বদলে)।
 */
export interface CostPerAreaSummary {
  costPerSqft: number
  costPerSqm: number
}

const SQFT_TO_SQM_RATIO = 0.092903

export function calculateCostPerArea(totalProjectCost: number, totalFloorAreaSqft: number): CostPerAreaSummary | undefined {
  if (totalFloorAreaSqft <= 0) return undefined
  return {
    costPerSqft: totalProjectCost / totalFloorAreaSqft,
    costPerSqm: totalProjectCost / (totalFloorAreaSqft * SQFT_TO_SQM_RATIO),
  }
}
