// lib/services/reinforcement.service.ts
//
// BBS row-এর calculation: Total Length → Weight → Wastage-adjusted
// Total Weight। unit weight standard table থেকে (diameter অনুযায়ী)
// অথবা ব্যবহারকারীর override থেকে।

import { BBSRow, BBSRowCalculated, STANDARD_BAR_WEIGHT_PER_METER } from '@/lib/types/reinforcement.types'

/**
 * একটা diameter-এর জন্য effective unit weight — override থাকলে সেটা,
 * নাহলে standard table থেকে। Table-এ না থাকা diameter হলে undefined
 * রিটার্ন করে (কল-কারীকে ব্যবহারকারীকে জানাতে হবে যে override দরকার)।
 */
export function getUnitWeight(diameterMm: number, override?: number): number | undefined {
  if (override !== undefined && override > 0) return override
  return STANDARD_BAR_WEIGHT_PER_METER[diameterMm]
}

/**
 * একটা BBS row-এর সম্পূর্ণ calculation। unit weight standard
 * table-এ না থাকলে (এবং override-ও না দিলে) weight 0 ধরে, কিন্তু
 * সেটা silently না করে caller-কে warning array-তে জানানো উচিত —
 * তাই এই ফাংশনটা শুধু calculation করে, warning তৈরির দায়িত্ব
 * calculateBBSRows()-এর।
 */
export function calculateBBSRow(row: BBSRow): BBSRowCalculated {
  const effectiveUnitWeightKgPerM = getUnitWeight(row.diameterMm, row.unitWeightKgPerM) ?? 0

  const totalLengthM = row.cuttingLengthM * row.numberOfBars + row.lapLengthM * row.numberOfLaps
  const weightBeforeWastageKg = totalLengthM * effectiveUnitWeightKgPerM
  const wastageKg = weightBeforeWastageKg * (row.wastagePercent / 100)
  const totalWeightKg = weightBeforeWastageKg + wastageKg

  return {
    ...row,
    totalLengthM,
    effectiveUnitWeightKgPerM,
    weightBeforeWastageKg,
    wastageKg,
    totalWeightKg,
  }
}

/**
 * একাধিক row calculate করে, সাথে কোন row-এ unit weight পাওয়া যায়নি
 * (standard table-এ নেই, override-ও নেই) তার warning।
 */
export function calculateBBSRows(rows: BBSRow[]): { calculated: BBSRowCalculated[]; warnings: string[] } {
  const warnings: string[] = []
  const calculated = rows.map((row) => {
    const result = calculateBBSRow(row)
    if (result.effectiveUnitWeightKgPerM === 0) {
      warnings.push(
        `"${row.barMark}" (${row.diameterMm}mm) — এই diameter-এর জন্য standard unit weight পাওয়া যায়নি, ম্যানুয়ালি override দিন। আপাতত weight 0 ধরা হয়েছে।`
      )
    }
    return result
  })
  return { calculated, warnings }
}

export function summarizeBBSTotalWeight(calculated: BBSRowCalculated[]): number {
  return calculated.reduce((sum, row) => sum + row.totalWeightKg, 0)
}

/**
 * diameter অনুযায়ী গ্রুপ করে মোট weight — procurement-এর জন্য useful
 * ("কত kg ২০mm রড লাগবে")। Module 8 (Procurement Planning)-এ পরে
 * কাজে লাগবে।
 */
export function summarizeBBSByDiameter(calculated: BBSRowCalculated[]): Record<number, number> {
  const summary: Record<number, number> = {}
  for (const row of calculated) {
    summary[row.diameterMm] = (summary[row.diameterMm] ?? 0) + row.totalWeightKg
  }
  return summary
}

export interface BBSValidationResult {
  valid: boolean
  errors: string[]
}

export function validateBBSRow(row: {
  barMark: string
  diameterMm: number
  cuttingLengthM: number
  numberOfBars: number
  wastagePercent: number
}): BBSValidationResult {
  const errors: string[] = []

  if (!row.barMark || row.barMark.trim().length === 0) {
    errors.push('Bar Mark খালি রাখা যাবে না।')
  }
  if (row.diameterMm <= 0) {
    errors.push('Diameter শূন্যের বেশি হতে হবে।')
  }
  if (row.cuttingLengthM <= 0) {
    errors.push('Cutting Length শূন্যের বেশি হতে হবে।')
  }
  if (row.numberOfBars <= 0) {
    errors.push('Number of Bars শূন্যের বেশি হতে হবে।')
  }
  if (row.wastagePercent < 0 || row.wastagePercent > 20) {
    errors.push('Wastage percentage সাধারণত ০-২০%-এর মধ্যে হয় — এই মান যাচাই করুন।')
  }

  return { valid: errors.length === 0, errors }
}

function generateRowId(): string {
  return `bbsrow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createBBSRow(input: Omit<BBSRow, 'id'>): BBSRow {
  return { ...input, id: generateRowId() }
}
