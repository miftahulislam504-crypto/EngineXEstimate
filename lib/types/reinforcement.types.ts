// lib/types/reinforcement.types.ts
//
// Module 7 — BBS (Bar Bending Schedule)। Module 2-এর
// reinforcementQuantityKg একটা flat total (দ্রুত sanity-check-এর
// জন্য Dashboard-এ কাজে লাগবে), কিন্তু BBS-এর জন্য bar-level detail
// দরকার — এই ফাইলে সেই আলাদা, বিস্তারিত schema।
//
// standard শিল্প-চর্চা অনুযায়ী BBS-এর কলাম: Member, Bar Diameter,
// Shape, Cutting Length, Number of Bars, Total Length, Unit Weight
// (kg/m), Total Weight।

export type BarShape =
  | 'straight' // সোজা বার — slab main bar, ইত্যাদি
  | 'l_hook' // এক প্রান্তে ৯০° hook — column bar-এর সাধারণ shape
  | 'u_hook' // দুই প্রান্তে hook — beam bottom bar
  | 'stirrup' // rectangular closed loop — column/beam-এর tie/stirrup
  | 'cranked' // bent bar, সাধারণত slab-এর top bar-এ

export type StructuralMember = 'footing' | 'column' | 'beam' | 'slab' | 'stair'

/**
 * প্রতি মিটার বার-এর ওজন, diameter অনুযায়ী — BNBC/ASTM standard
 * অনুযায়ী স্টিলের density (7850 kg/m³) থেকে derive করা প্রমিত মান,
 * সাধারণত deformed bar (রড)-এর জন্য প্রকৌশল রেফারেন্স টেবিলে পাওয়া
 * যায়। ব্যবহারকারী override করতে পারবে যদি ভিন্ন standard অনুসরণ
 * করেন।
 */
export const STANDARD_BAR_WEIGHT_PER_METER: Record<number, number> = {
  8: 0.395,
  10: 0.617,
  12: 0.888,
  16: 1.578,
  20: 2.466,
  22: 2.984,
  25: 3.853,
  28: 4.834,
  32: 6.313,
}

/**
 * একটা BBS row — একটা নির্দিষ্ট bar mark-এর সম্পূর্ণ তথ্য।
 * cuttingLengthM ব্যবহারকারী দেবে (hook/bend allowance ইতিমধ্যে
 * ধরে হিসাব করা — এই মুহূর্তে shape থেকে স্বয়ংক্রিয় bend-deduction
 * calculate করা হচ্ছে না, কারণ সেটা BNBC-নির্দিষ্ট bend-length
 * factor লাগবে যেটা এখনো confirm করা হয়নি)।
 */
export interface BBSRow {
  id: string
  barMark: string // যেমন "C1-Main", "B2-Stirrup" — ব্যবহারকারীর নিজস্ব রেফারেন্স লেবেল
  member: StructuralMember
  floorId?: string // Module 2-এর floorId-এর সাথে সংযুক্ত করা যেতে পারে, ঐচ্ছিক
  diameterMm: number
  shape: BarShape
  cuttingLengthM: number // hook/bend allowance-সহ একটা বারের দৈর্ঘ্য
  numberOfBars: number
  lapLengthM: number // splice/lap-এর জন্য অতিরিক্ত দৈর্ঘ্য, প্রযোজ্য হলে (নাহলে 0)
  numberOfLaps: number // কতগুলো bar-এ lap প্রযোজ্য (পুরো length-এর জন্য একাধিক bar জোড়া লাগলে)
  wastagePercent: number // কাটিং/হ্যান্ডলিং loss, সাধারণত ৩-৫%
  unitWeightKgPerM?: number // override না দিলে STANDARD_BAR_WEIGHT_PER_METER থেকে diameter অনুযায়ী নেওয়া হয়
}

export interface BBSRowCalculated extends BBSRow {
  totalLengthM: number // (cuttingLengthM × numberOfBars) + (lapLengthM × numberOfLaps)
  effectiveUnitWeightKgPerM: number // override থাকলে সেটা, নাহলে standard table থেকে
  weightBeforeWastageKg: number
  wastageKg: number
  totalWeightKg: number
}

export interface StoredBBS {
  projectId: string
  updatedAt: number
  rows: BBSRow[]
}
