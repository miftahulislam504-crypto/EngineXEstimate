// lib/services/procurement.service.ts
//
// dashboard.service.ts-এর একই aggregation-pattern: এখানে নতুন কোনো
// hisab নেই, শুধু existing Module (3, 4, 7)-এর output জোড়া লাগিয়ে
// material-quantity বের করা।

import { BOQItem } from '@/lib/types/boq.types'
import { RateAnalysisEntry, LabourConsumption, EquipmentConsumption } from '@/lib/types/rate-analysis.types'
import { Material } from '@/lib/types/material.types'
import { ResourceRate } from '@/lib/types/resource-rate.types'
import { BBSRow } from '@/lib/types/reinforcement.types'
import { calculateBBSRows, summarizeBBSByDiameter } from '@/lib/services/reinforcement.service'
import { MaterialProcurementNeed, ResourceProcurementNeed, ReinforcementProcurementNeed } from '@/lib/types/procurement.types'

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
 * calculateMaterialProcurementNeeds-এর একই গুণ-ও-যোগ যুক্তি, labour ও
 * equipment উভয়ের জন্য পুনর্ব্যবহারযোগ্য একটা generic ফাংশনে —
 * getConsumption RateAnalysisEntry থেকে labour[] বা equipment[]
 * বেছে দেয়, বাকি aggregation logic হুবহু এক। resource-rate.types.ts-এর
 * ResourceRate[] থেকে unit lookup করা হয় (Material-এর মতো, কারণ
 * LabourConsumption/EquipmentConsumption নিজে unit রাখে না, শুধু
 * resourceRateId রাখে)।
 */
function calculateResourceProcurementNeeds(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[],
  resourceRates: ResourceRate[],
  resourceType: 'labour' | 'equipment',
  getConsumption: (entry: RateAnalysisEntry) => (LabourConsumption | EquipmentConsumption)[]
): ResourceProcurementNeed[] {
  const needsByResourceId: Record<string, ResourceProcurementNeed> = {}

  for (const boqItem of boqItems) {
    const entry = rateAnalysisEntries.find((e) => e.boqItemId === boqItem.id)
    if (!entry) continue // calculateMaterialProcurementNeeds-এর একই কারণ — Rate Analysis না থাকা item silently বাদ, findBoqItemsWithoutRateAnalysis() দিয়ে caller জানতে পারবে

    for (const consumption of getConsumption(entry)) {
      const resourceRate = resourceRates.find((r) => r.id === consumption.resourceRateId)
      if (!resourceRate) continue

      const quantityForThisItem = consumption.quantityPerUnit * boqItem.quantity

      if (!needsByResourceId[resourceRate.id]) {
        needsByResourceId[resourceRate.id] = {
          resourceRateId: resourceRate.id,
          resourceName: resourceRate.name,
          resourceType,
          unit: resourceRate.unit,
          totalQuantityNeeded: 0,
        }
      }
      needsByResourceId[resourceRate.id].totalQuantityNeeded += quantityForThisItem
    }
  }

  return Object.values(needsByResourceId).sort((a, b) => a.resourceName.localeCompare(b.resourceName))
}

/** labourRequirement/labourDemand (Hub-এর EstimatingModuleData)-এর উৎস — একই ডেটা দুই নামে চাওয়া হয়েছে, তাই একই ফাংশন দুই জায়গায় ব্যবহার হবে (hub-module-export.ts দ্রষ্টব্য) */
export function calculateLabourProcurementNeeds(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[],
  resourceRates: ResourceRate[]
): ResourceProcurementNeed[] {
  return calculateResourceProcurementNeeds(boqItems, rateAnalysisEntries, resourceRates, 'labour', (e) => e.labour)
}

/** equipmentRequirement/equipmentDemand-এর উৎস — calculateLabourProcurementNeeds-এর সমান্তরাল */
export function calculateEquipmentProcurementNeeds(
  boqItems: BOQItem[],
  rateAnalysisEntries: RateAnalysisEntry[],
  resourceRates: ResourceRate[]
): ResourceProcurementNeed[] {
  return calculateResourceProcurementNeeds(boqItems, rateAnalysisEntries, resourceRates, 'equipment', (e) => e.equipment)
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
