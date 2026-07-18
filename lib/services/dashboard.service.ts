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
import { BOQItem } from '@/lib/types/boq.types'
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
    const entry = rateAnalysisEntries.find((e) => e.boqItemId === boqItem.id)
    if (!entry) {
      itemsWithoutRateAnalysis.push(boqItem.itemName)
      continue
    }

    const { breakdown } = calculateRateFromLoadedRates(entry, materials, labourRates, equipmentRates)

    // breakdown-এর প্রতিটা component প্রতি-unit — এখানেই quantity
    // দিয়ে গুণ করে প্রকৃত project-level অবদান বের করা হচ্ছে
    totalMaterialCost += breakdown.materialCost * boqItem.quantity
    totalLabourCost += breakdown.labourCost * boqItem.quantity
    totalEquipmentCost += breakdown.equipmentCost * boqItem.quantity
    totalOverheadAmount += breakdown.overheadAmount * boqItem.quantity
    totalProfitAmount += breakdown.profitAmount * boqItem.quantity
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
