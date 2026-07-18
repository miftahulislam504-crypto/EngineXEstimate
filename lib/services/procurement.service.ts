// lib/services/procurement.service.ts
//
// dashboard.service.ts-এর একই aggregation-pattern: এখানে নতুন কোনো
// hisab নেই, শুধু existing Module (3, 4, 7)-এর output জোড়া লাগিয়ে
// material-quantity বের করা।

import { BOQItem } from '@/lib/types/boq.types'
import { RateAnalysisEntry } from '@/lib/types/rate-analysis.types'
import { Material } from '@/lib/types/material.types'
import { BBSRow } from '@/lib/types/reinforcement.types'
import { calculateBBSRows, summarizeBBSByDiameter } from '@/lib/services/reinforcement.service'
import { MaterialProcurementNeed, ReinforcementProcurementNeed } from '@/lib/types/procurement.types'

/**
 * প্রতিটা BOQ item-এর material consumption (Rate Analysis থেকে) তার
 * quantity দিয়ে গুণ করে, একই material-এর জন্য সব BOQ item জুড়ে
 * যোগ করে মোট procurement need বের করে। dashboard.service.ts-এর
 * calculateProjectCostSummary()-র একই গুণ-ও-যোগ যুক্তি, শুধু টাকার
 * বদলে raw material quantity।
 */
export function calculateMaterialProcurementNeeds(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[],
  materials: Material[]
): MaterialProcurementNeed[] {
  const needsByMaterialId: Record<string, MaterialProcurementNeed> = {}

  for (const boqItem of boqItems) {
    const entry = rateAnalysisEntries.find((e) => e.boqItemId === boqItem.id)
    if (!entry) continue // যে item-এর Rate Analysis নেই, তার material breakdown-ও নেই — Dashboard-এর মতোই silent-skip না করে caller-কে জানানো উচিত, নিচে দ্রষ্টব্য

    for (const consumption of entry.materials) {
      const material = materials.find((m) => m.id === consumption.materialId)
      if (!material) continue

      const quantityForThisItem = consumption.quantityPerUnit * boqItem.quantity

      if (!needsByMaterialId[material.id]) {
        needsByMaterialId[material.id] = {
          materialId: material.id,
          materialName: material.name,
          unit: material.unit,
          totalQuantityNeeded: 0,
        }
      }
      needsByMaterialId[material.id].totalQuantityNeeded += quantityForThisItem
    }
  }

  return Object.values(needsByMaterialId).sort((a, b) => a.materialName.localeCompare(b.materialName))
}

/**
 * BOQ item-গুলোর মধ্যে যাদের Rate Analysis এখনো নেই — Dashboard-এর
 * itemsWithoutRateAnalysis-এর একই উদ্দেশ্যে: silently বাদ না দিয়ে
 * caller-কে (UI) জানানো যে material total সম্পূর্ণ না।
 */
export function findBoqItemsWithoutRateAnalysis(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[]
): string[] {
  return boqItems
    .filter((item) => !rateAnalysisEntries.some((e) => e.boqItemId === item.id))
    .map((item) => item.itemName)
}

/**
 * BBS (Module 7) থেকে diameter-ভিত্তিক reinforcement need — Module
 * 7-এর summarizeBBSByDiameter() ইতিমধ্যেই এই কাজ করে, এখানে শুধু
 * ProcurementNeed shape-এ রূপান্তর করা হচ্ছে UI-consistency-র জন্য।
 */
export function calculateReinforcementProcurementNeeds(bbsRows: BBSRow[]): ReinforcementProcurementNeed[] {
  const { calculated } = calculateBBSRows(bbsRows)
  const byDiameter = summarizeBBSByDiameter(calculated)

  return Object.entries(byDiameter)
    .map(([diameterMm, totalWeightKg]) => ({
      diameterMm: parseFloat(diameterMm),
      totalWeightKg,
    }))
    .sort((a, b) => a.diameterMm - b.diameterMm)
}
