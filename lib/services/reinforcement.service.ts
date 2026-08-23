// lib/services/reinforcement.service.ts
//
// BBS row-এর calculation: Total Length → Weight → Wastage-adjusted
// Total Weight। unit weight standard table থেকে (diameter অনুযায়ী)
// অথবা ব্যবহারকারীর override থেকে।

import {
  BBSRow,
  BBSRowCalculated,
  STANDARD_BAR_WEIGHT_PER_METER,
  StructuralMember,
  TYPICAL_REBAR_RATIO_KG_PER_M3,
} from '@/lib/types/reinforcement.types'
import { StructuralFloorQuantities } from '@/lib/types/quantity-takeoff.types'
import { summarizeFloorVolumes } from '@/lib/services/quantity-takeoff.service'

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

/**
 * structural member (footing/column/beam/slab/stair) অনুযায়ী গ্রুপ
 * করে মোট weight — BBS Report (Module 13)-এ member-wise breakdown
 * দেখানোর জন্য, summarizeBBSByDiameter-এর ঠিক একই প্যাটার্ন।
 */
export function summarizeBBSByMember(calculated: BBSRowCalculated[]): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const row of calculated) {
    summary[row.member] = (summary[row.member] ?? 0) + row.totalWeightKg
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

// ═══════════════════════════════════════════════════════════════
// ২০২৬-০৮-২০ যোগ — BBS auto-derive (reinforcement.types.ts-এর
// TYPICAL_REBAR_RATIO_KG_PER_M3 নোট দ্রষ্টব্য: এটা approximation,
// প্রকৃত bar-level design না)
// ═══════════════════════════════════════════════════════════════

const ASSUMED_DIAMETER_MM = 16 // সবচেয়ে প্রচলিত main bar size — approximation-এর একটাই diameter ধরে single-row রাখা হয়েছে, একাধিক diameter split করলে ভুল নির্ভুলতার বিভ্রম তৈরি হতো
const ASSUMED_WASTAGE_PERCENT = 3 // দেশীয় নির্মাণ চর্চায় সাধারণ কাটিং/হ্যান্ডলিং loss

/**
 * একটা StructuralFloorQuantities থেকে member-ভিত্তিক (footing/
 * column/beam/slab) suggested BBSRow[] তৈরি করে —
 * TYPICAL_REBAR_RATIO_KG_PER_M3 দিয়ে RCC volume থেকে আনুমানিক total
 * weight বের করে, সেই weight থেকে "reverse" করে একটা
 * cuttingLengthM/numberOfBars জোড়া বানানো হয় (numberOfBars=1,
 * cuttingLengthM = weightBeforeWastage / effectiveUnitWeight —
 * অর্থাৎ এই একটা "virtual bar"-এর length-ই আসলে মোট প্রয়োজনীয়
 * বার-দৈর্ঘ্য, প্রকৃত bar count/length বিভাজন না)। এই পদ্ধতি
 * ইচ্ছাকৃতভাবে সরল রাখা হয়েছে যাতে ব্যবহারকারী সহজেই বুঝে edit
 * করতে পারেন — জটিল multi-bar breakdown অনুমান করলে ভুল
 * নির্দিষ্টতা তৈরি হতো।
 *
 * stair এখানে অন্তর্ভুক্ত না — StructuralFloorQuantities.stairQuantity
 * সরল সংখ্যা (nos), volume না, তাই TYPICAL_REBAR_RATIO_KG_PER_M3ের
 * volume-ভিত্তিক সূত্র সরাসরি প্রযোজ্য না। stairDimensions (নতুন
 * optional field, থাকলে) waistSlabVolumeM3 দেয় — সেটা থাকলে আলাদাভাবে
 * ধরা হয়েছে নিচে।
 *
 * ভলিউম শূন্য/অনুপস্থিত এমন member বাদ পড়ে (boq.service.ts-এর
 * `if (volume <= 0)` একই নীতি)।
 */
export function suggestBBSRowsFromFloor(floor: StructuralFloorQuantities): BBSRow[] {
  const volumes = summarizeFloorVolumes(floor)
  const memberVolumes: { member: StructuralMember; volumeM3: number }[] = [
    { member: 'footing', volumeM3: volumes.footingVolumeM3 },
    { member: 'column', volumeM3: volumes.columnVolumeM3 },
    { member: 'beam', volumeM3: volumes.beamVolumeM3 },
    { member: 'slab', volumeM3: volumes.slabVolumeM3 },
    // ২০২৬-০৮-২০ — stairDimensions থাকলে (mainly manual override,
    // structural-mapper.ts future-ready নোট দ্রষ্টব্য) volume-ভিত্তিক
    // suggestion সম্ভব। stairReinforcementKg নিজেই দেওয়া থাকলে সেটা
    // ব্যবহারকারীর সরাসরি input হিসেবে অগ্রাধিকার পাওয়া উচিত (এই
    // ফাংশনের বাইরে, BBSTable-এ), তাই এখানে শুধু ratio-ভিত্তিক
    // approximation, waistSlabVolumeM3 থেকে।
    { member: 'stair', volumeM3: floor.stairDimensions?.waistSlabVolumeM3 ?? 0 },
  ]

  const unitWeight = STANDARD_BAR_WEIGHT_PER_METER[ASSUMED_DIAMETER_MM] // 16mm সবসময় standard table-এ আছে (reinforcement.types.ts), তাই undefined হওয়ার সম্ভাবনা নেই — তবু নিচে 0 হলে row বাদ দেওয়া হবে defensively

  const rows: BBSRow[] = []
  for (const { member, volumeM3 } of memberVolumes) {
    if (volumeM3 <= 0) continue
    const totalWeightKg = volumeM3 * TYPICAL_REBAR_RATIO_KG_PER_M3[member]
    if (!unitWeight || totalWeightKg <= 0) continue

    // wastage-সহ target weight থেকে wastage-ছাড়া weight বের করে
    // cuttingLengthM হিসাব — calculateBBSRow()-এর ফরওয়ার্ড হিসাবের
    // ঠিক উল্টো (totalWeightKg = totalLengthM × unitWeight × (1 +
    // wastage/100))
    const weightBeforeWastage = totalWeightKg / (1 + ASSUMED_WASTAGE_PERCENT / 100)
    const cuttingLengthM = weightBeforeWastage / unitWeight

    rows.push(
      createBBSRow({
        barMark: `${member.charAt(0).toUpperCase()}${member.slice(1)}-Auto`,
        member,
        floorId: floor.floorId,
        diameterMm: ASSUMED_DIAMETER_MM,
        shape: 'straight',
        cuttingLengthM: Math.round(cuttingLengthM * 100) / 100,
        numberOfBars: 1, // "virtual bar" — cuttingLengthM ইতিমধ্যেই মোট প্রয়োজনীয় দৈর্ঘ্য ধারণ করে, উপরের ফাংশন-কমেন্ট দ্রষ্টব্য
        lapLengthM: 0,
        numberOfLaps: 0,
        wastagePercent: ASSUMED_WASTAGE_PERCENT,
      })
    )
  }

  return rows
}

/**
 * একাধিক floor-এর জন্য suggestBBSRowsFromFloor() একসাথে চালায় —
 * BBSTable.tsx-এর "Auto-suggest from Quantity Takeoff" বাটন এই
 * ফাংশন কল করবে (প্রতিটা floor-এর জন্য আলাদা)।
 */
export function suggestBBSRowsFromAllFloors(floors: StructuralFloorQuantities[]): BBSRow[] {
  return floors.flatMap((floor) => suggestBBSRowsFromFloor(floor))
}

