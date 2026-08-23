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

// ═══════════════════════════════════════════════════════════════
// ২০২৬-০৮-২০ যোগ — BBS auto-derive from RCC volume (audit gap: "BBS
// পুরোপুরি manual, RCC volume থেকে auto-suggest নেই")
// ═══════════════════════════════════════════════════════════════
//
// একটা সীমাবদ্ধতা প্রথমেই স্পষ্ট করা দরকার: bar-level detail
// (diameter/shape/cutting length/lap) RCC volume থেকে গাণিতিকভাবে
// derive করা সম্ভব না — এর জন্য প্রকৃত structural design (rebar
// spacing, bar cut-list) লাগে, যা Structural app-এর কাজ (এখনো Hub-এ
// bar-level detail export হয় না, শুধু totalRccVolumeM3/
// reinforcementQuantityKg flat summary আসে)।
//
// তাই এই "auto-derive" একটা approximation: member-type অনুযায়ী
// প্রচলিত rebar ratio (kg প্রতি m³ কংক্রিট, দেশীয় নির্মাণ চর্চায়
// সাধারণত ব্যবহৃত পরিসীমার মাঝামাঝি মান) দিয়ে RCC volume থেকে একটা
// single-row "approximate" BBS entry তৈরি হয় — diameter সবচেয়ে
// প্রচলিত ১৬mm ধরা হয় (typical main bar size), shape 'straight'
// (কোনো bend/hook allowance ছাড়া, কারণ এটা প্রকৃত bar cut-list না)।
// ব্যবহারকারী এই row edit করে প্রকৃত bar-level detail বসাতে পারবেন —
// BBSTable.tsx-এ এটা normal BBSRow-এর মতোই editable থাকে, শুধু
// শুরুর মান এখানে থেকে আসে। এটা একটা starting point, চূড়ান্ত নকশা
// না — UI-তে এই সতর্কতা স্পষ্টভাবে দেখানো হয় (নিচের
// APPROXIMATION_WARNING দ্রষ্টব্য)।
export const TYPICAL_REBAR_RATIO_KG_PER_M3: Record<StructuralMember, number> = {
  footing: 80, // ফুটিং — তুলনামূলক কম রড ঘনত্ব
  column: 150, // কলাম — উচ্চ রড ঘনত্ব (heavy load path)
  beam: 120,
  slab: 90,
  stair: 110, // waist slab + landing, slab-এর কাছাকাছি কিন্তু সামান্য বেশি (landing beam সহ)
}

export const APPROXIMATION_WARNING_KEY = 'bbsAutoApproximationWarning' // i18n key, UI-তে সরাসরি ব্যবহারের জন্য
