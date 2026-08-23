// lib/types/electrical.types.ts
//
// Module 16 — Electrical (２０２৬-０৮-２０ যোগ, audit gap: "Electrical —
// সবগুলো (Lighting/Socket/Switch/DB/Cable/Earthing) — কোনো কোড নেই")।
// Module ১-১৩ আগে থেকেই বরাদ্দ ছিল, আর Module ১৪/১৫ যথাক্রমে Hub
// Import ও Integration page-এর জন্য (lib/modules.ts দ্রষ্টব্য) —
// তাই এই নতুন module ১৬ নম্বর পেল, original doc-এর scope-এর
// বাইরের সংযোজন।
//
// এই module-এর জন্য কোনো upstream auto-source নেই — Draw/Structural
// app কোনো electrical layout export করে না (Hub module-data.types.ts
// দ্রষ্টব্য, সেখানে electrical-নির্দিষ্ট কোনো field নেই)। তাই এটা
// সম্পূর্ণ manual-entry module, ঠিক BBS (Module 7)-এর মতোই একই
// pattern: floor-ভিত্তিক row array, single Firestore document
// (versioned না, কারণ electrical layout সাধারণত ক্রমান্বয়ে সংশোধন
// হয়, প্রতিটা সংশোধনকে আলাদা version হিসেবে audit-trail করার
// প্রয়োজনীয়তা BOQ/Hub import-এর মতো স্পষ্ট না — reinforcement.firestore.ts-এর
// একই যুক্তি)।
//
// Point-count-ভিত্তিক (Lighting Point, Socket Point, ইত্যাদি) —
// দেশীয় নির্মাণ শিল্পে electrical BOQ সাধারণত "point" এককে হয়
// (একটা point = wiring + accessory + labour একসাথে ধরা একটা
// composite item), তারবিহীন দৈর্ঘ্য-ভিত্তিক আলাদা হিসাব (cable
// running meter) শুধু DB-to-DB বা main feeder-এর জন্য আলাদা রাখা
// হয়েছে (ElectricalCableRun)।

export type ElectricalItemCategory =
  | 'lighting_point' // সিলিং লাইট, ওয়াল লাইট ইত্যাদি — point হিসেবে
  | 'socket_point' // ১৩A/৫A সকেট আউটলেট — point হিসেবে
  | 'switch_point' // সুইচ (single/multi-gang একটা point হিসেবে ধরা, gang সংখ্যা notes-এ)
  | 'fan_point'
  | 'db_unit' // Distribution Board — nos
  | 'earthing_point' // আর্থিং pit/point — nos
  | 'exhaust_fan_point'
  | 'ac_point' // AC-এর জন্য আলাদা heavy-duty point/socket

export const ELECTRICAL_CATEGORY_UNIT: Record<ElectricalItemCategory, 'point' | 'nos'> = {
  lighting_point: 'point',
  socket_point: 'point',
  switch_point: 'point',
  fan_point: 'point',
  db_unit: 'nos',
  earthing_point: 'nos',
  exhaust_fan_point: 'point',
  ac_point: 'point',
}

/**
 * একটা floor-এ একটা category-র মোট count — একটা row = একটা
 * floor+category জোড়া (একই floor-এ একই category দুইবার row না
 * রেখে, count আপডেট করাই সহজ)।
 */
export interface ElectricalPointRow {
  id: string
  floorId?: string // Module 2 (Quantity Takeoff)-এর floorId-এর সাথে সংযুক্ত করা যেতে পারে, ঐচ্ছিক (BBSRow.floorId-এর একই pattern)
  category: ElectricalItemCategory
  quantity: number
  notes?: string // যেমন switch gang সংখ্যা, socket amperage, ইত্যাদি অতিরিক্ত বিবরণ
}

/**
 * Cable run — length-ভিত্তিক আইটেম, point-count থেকে আলাদা কারণ
 * এর একক রৈখিক দৈর্ঘ্য (running meter), point-count না। সাধারণত
 * main feeder (Meter-to-DB) ও DB-to-DB সংযোগে ব্যবহৃত হয়।
 */
export interface ElectricalCableRun {
  id: string
  floorId?: string
  description: string // যেমন "Main Feeder — Meter to Main DB", "Sub-DB — 2nd Floor to 3rd Floor"
  cableSizeSqmm: number // যেমন 4, 6, 10 sqmm
  lengthM: number
  notes?: string
}

export interface StoredElectrical {
  projectId: string
  updatedAt: number
  points: ElectricalPointRow[]
  cableRuns: ElectricalCableRun[]
}

export function createElectricalPointRow(input: Omit<ElectricalPointRow, 'id'>): ElectricalPointRow {
  return { ...input, id: generateElectricalRowId('elecpt') }
}

export function createElectricalCableRun(input: Omit<ElectricalCableRun, 'id'>): ElectricalCableRun {
  return { ...input, id: generateElectricalRowId('cable') }
}

function generateElectricalRowId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * validation — validateBBSRow()-এর একই "errors: string[]" প্যাটার্ন
 * অনুসরণ করে (reinforcement.service.ts দ্রষ্টব্য), যাতে UI-তে একই
 * ধরনের error-display component পুনর্ব্যবহার করা যায়।
 */
export function validateElectricalPointRow(row: ElectricalPointRow): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (row.quantity <= 0) {
    errors.push('Quantity শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}

export function validateElectricalCableRun(row: ElectricalCableRun): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!row.description.trim()) {
    errors.push('Description আবশ্যক।')
  }
  if (row.cableSizeSqmm <= 0) {
    errors.push('Cable size শূন্যের বেশি হতে হবে।')
  }
  if (row.lengthM <= 0) {
    errors.push('Length শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}
