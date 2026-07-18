// lib/services/rate-analysis.service.ts
//
// মূল formula: Rate = Material + Labour + Equipment + Overhead + Profit
//
// গুরুত্বপূর্ণ: calculation সবসময় Material/ResourceRate-এর LIVE
// currentRate ব্যবহার করে, RateAnalysisEntry-তে সংরক্ষিত কোনো snapshot
// rate না (সেখানে শুধু materialName/resourceName snapshot, দাম না)।
// এর মানে Module 6 (Market Rate Update)-এ কোনো material-এর rate
// বদলালে, পরের বার calculate হলেই স্বয়ংক্রিয়ভাবে নতুন rate
// প্রতিফলিত হবে — এটাই Module 6-এর "Estimate সবসময় current থাকবে"
// চাহিদার বাস্তবায়ন।
//
// দুটো ভিন্ন calculation ফাংশন ইচ্ছাকৃতভাবে রাখা হয়েছে:
//
// - calculateRateFromLoadedRates() — synchronous, কোনো Firestore
//   call করে না, ইতিমধ্যে-লোড করা Material[]/ResourceRate[] array
//   থেকে হিসাব করে। UI-তে (RateAnalysisPanel.tsx) এটাই ব্যবহার করা
//   উচিত, কারণ UI প্রতিটা quantity-input পরিবর্তনে re-calculate করে —
//   Firestore-hit করা calculateRate() ব্যবহার করলে প্রতি keystroke-এ
//   material+labour+equipment সংখ্যক আলাদা getDoc() call হতো, যেটা
//   ধীরগতি ও অপ্রয়োজনীয় খরচ তৈরি করত।
// - calculateRate() — async, নিজে থেকে Firestore থেকে fetch করে।
//   এমন জায়গায় ব্যবহারের জন্য যেখানে already-loaded array হাতে নেই
//   (যেমন ভবিষ্যতে কোনো background job, Cloud Function, বা report
//   generation যেটা UI state-এর বাইরে চলে)।

import { getMaterial } from '@/lib/firestore/material.firestore'
import { getResourceRate } from '@/lib/firestore/resource-rate.firestore'
import { RateAnalysisEntry, RateAnalysisCostBreakdown } from '@/lib/types/rate-analysis.types'
import { Material } from '@/lib/types/material.types'
import { ResourceRate } from '@/lib/types/resource-rate.types'

/**
 * ইতিমধ্যে-লোড করা material/labour/equipment rate array থেকে
 * synchronous ভাবে cost breakdown calculate করে — কোনো Firestore
 * call নেই। UI-এর জন্য এটাই প্রাথমিক পছন্দ হওয়া উচিত।
 */
export function calculateRateFromLoadedRates(
  entry: RateAnalysisEntry,
  materials: Material[],
  labourRates: ResourceRate[],
  equipmentRates: ResourceRate[]
): { breakdown: RateAnalysisCostBreakdown; warnings: string[] } {
  const warnings: string[] = []

  let materialCost = 0
  for (const m of entry.materials) {
    const material = materials.find((mat) => mat.id === m.materialId)
    if (!material) {
      warnings.push(`Material "${m.materialName}" আর পাওয়া যাচ্ছে না — এই অংশ 0 ধরা হয়েছে।`)
      continue
    }
    materialCost += material.currentRate * m.quantityPerUnit
  }

  let labourCost = 0
  for (const l of entry.labour) {
    const resource = labourRates.find((r) => r.id === l.resourceRateId)
    if (!resource) {
      warnings.push(`Labour "${l.resourceName}" আর পাওয়া যাচ্ছে না — এই অংশ 0 ধরা হয়েছে।`)
      continue
    }
    labourCost += resource.currentRate * l.quantityPerUnit
  }

  let equipmentCost = 0
  for (const e of entry.equipment) {
    const resource = equipmentRates.find((r) => r.id === e.resourceRateId)
    if (!resource) {
      warnings.push(`Equipment "${e.resourceName}" আর পাওয়া যাচ্ছে না — এই অংশ 0 ধরা হয়েছে।`)
      continue
    }
    equipmentCost += resource.currentRate * e.quantityPerUnit
  }

  const subtotal = materialCost + labourCost + equipmentCost
  const overheadAmount = subtotal * (entry.overheadPercent / 100)
  const profitAmount = (subtotal + overheadAmount) * (entry.profitPercent / 100)
  const finalRate = subtotal + overheadAmount + profitAmount

  return {
    breakdown: { materialCost, labourCost, equipmentCost, subtotal, overheadAmount, profitAmount, finalRate },
    warnings,
  }
}

/**
 * একটা RateAnalysisEntry-র জন্য বর্তমান live rate দিয়ে সম্পূর্ণ cost
 * breakdown calculate করে, প্রতিটা material/labour/equipment
 * Firestore থেকে সরাসরি fetch করে। Material/ResourceRate যদি মাঝে
 * deactivate/delete হয়ে যায়, সেই component-টা 0 ধরে বাকিগুলো দিয়ে
 * calculate করে চলবে।
 */
export async function calculateRate(
  entry: RateAnalysisEntry
): Promise<{ breakdown: RateAnalysisCostBreakdown; warnings: string[] }> {
  const warnings: string[] = []

  let materialCost = 0
  for (const m of entry.materials) {
    const material = await getMaterial(m.materialId)
    if (!material) {
      warnings.push(`Material "${m.materialName}" (id: ${m.materialId}) আর পাওয়া যাচ্ছে না — এই অংশ 0 ধরা হয়েছে।`)
      continue
    }
    materialCost += material.currentRate * m.quantityPerUnit
  }

  let labourCost = 0
  for (const l of entry.labour) {
    const resource = await getResourceRate(l.resourceRateId)
    if (!resource) {
      warnings.push(`Labour "${l.resourceName}" (id: ${l.resourceRateId}) আর পাওয়া যাচ্ছে না — এই অংশ 0 ধরা হয়েছে।`)
      continue
    }
    labourCost += resource.currentRate * l.quantityPerUnit
  }

  let equipmentCost = 0
  for (const e of entry.equipment) {
    const resource = await getResourceRate(e.resourceRateId)
    if (!resource) {
      warnings.push(`Equipment "${e.resourceName}" (id: ${e.resourceRateId}) আর পাওয়া যাচ্ছে না — এই অংশ 0 ধরা হয়েছে।`)
      continue
    }
    equipmentCost += resource.currentRate * e.quantityPerUnit
  }

  const subtotal = materialCost + labourCost + equipmentCost
  const overheadAmount = subtotal * (entry.overheadPercent / 100)
  const profitAmount = (subtotal + overheadAmount) * (entry.profitPercent / 100)
  const finalRate = subtotal + overheadAmount + profitAmount

  return {
    breakdown: {
      materialCost,
      labourCost,
      equipmentCost,
      subtotal,
      overheadAmount,
      profitAmount,
      finalRate,
    },
    warnings,
  }
}

export interface RateAnalysisValidationResult {
  valid: boolean
  errors: string[]
}

export function validateRateAnalysisEntry(entry: {
  materials: unknown[]
  labour: unknown[]
  equipment: unknown[]
  overheadPercent: number
  profitPercent: number
}): RateAnalysisValidationResult {
  const errors: string[] = []

  if (entry.materials.length === 0 && entry.labour.length === 0 && entry.equipment.length === 0) {
    errors.push('অন্তত একটা material, labour, বা equipment consumption যোগ করতে হবে।')
  }
  if (entry.overheadPercent < 0) {
    errors.push('Overhead percentage ঋণাত্মক হতে পারে না।')
  }
  if (entry.profitPercent < 0) {
    errors.push('Profit percentage ঋণাত্মক হতে পারে না।')
  }
  if (entry.overheadPercent > 100 || entry.profitPercent > 100) {
    errors.push('Overhead/Profit percentage ১০০%-এর বেশি হলে যাচাই করুন — এটা কি ইচ্ছাকৃত?')
  }

  return { valid: errors.length === 0, errors }
}

function generateEntryId(): string {
  return `rateentry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createRateAnalysisEntry(input: {
  boqItemId: string
  boqItemName: string
  overheadPercent: number
  profitPercent: number
}): RateAnalysisEntry {
  return {
    id: generateEntryId(),
    boqItemId: input.boqItemId,
    boqItemName: input.boqItemName,
    materials: [],
    labour: [],
    equipment: [],
    overheadPercent: input.overheadPercent,
    profitPercent: input.profitPercent,
  }
}
