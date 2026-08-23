// lib/types/plumbing.types.ts
//
// Module 17 — Plumbing & Sanitary (２０২৬-０৮-２０ যোগ, audit gap:
// "Plumbing & Sanitary — সবগুলো (WC/Basin/Shower/Drain/Pipe) — কোনো
// কোড নেই")। electrical.types.ts-এর file-header দ্রষ্টব্য কেন এই
// নতুন module ১৭ নম্বর পেল (Module ১৬ Electrical-এর জন্য)।
//
//
// electrical.types.ts-এর একই স্থাপত্য: কোনো upstream auto-source
// নেই (Draw app কোনো plumbing layout export করে না), তাই সম্পূর্ণ
// manual-entry, floor-ভিত্তিক row array, single Firestore document।
// Fixture (nos-ভিত্তিক) ও Pipe Run (length-ভিত্তিক) — দুই ধরনের
// আইটেম আলাদা রাখা হয়েছে, ঠিক Electrical-এর Point vs Cable Run-এর
// মতোই একই যুক্তি (এক ইউনিট সবার জন্য জোর করে মেলালে হয় fixture-এর
// length জোর করে বসাতে হতো নয়তো pipe-এর "count" অর্থহীন হতো)।

export type PlumbingFixtureCategory =
  | 'wc' // Water Closet (কমোড)
  | 'basin' // Wash Basin
  | 'shower'
  | 'floor_drain'
  | 'kitchen_sink'
  | 'bib_cock' // ট্যাপ/কল
  | 'geyser_point' // গিজার/ওয়াটার হিটার সংযোগ point

/**
 * প্রতিটা fixture category-র একক 'nos' — ElectricalItemCategory-র
 * মতো একটা constant map না রেখে সরাসরি এখানে না রাখার কারণ:
 * plumbing-এ সবগুলো fixture একই একক ('nos'), electrical-এর মতো
 * 'point'/'nos' মিশ্রণ নেই — তাই আলাদা lookup map না রেখে সরলীকরণ
 * করা হলো।
 */
export interface PlumbingFixtureRow {
  id: string
  floorId?: string
  category: PlumbingFixtureCategory
  quantity: number
  notes?: string // যেমন fixture brand/model/grade
}

/**
 * Pipe run — length-ভিত্তিক, water supply ও drainage/soil pipe দুটোই
 * covers করে (pipeType দিয়ে আলাদা করা, যেহেতু rate সাধারণত ভিন্ন হয়
 * — supply pipe সাধারণত CPVC/GI, drainage সাধারণত PVC, দুটোর rate
 * ভিন্ন)।
 */
export type PipeType = 'water_supply' | 'drainage' | 'soil_waste'

export interface PlumbingPipeRun {
  id: string
  floorId?: string
  pipeType: PipeType
  diameterMm: number // যেমন 15, 20, 25 (supply), 75, 100, 110 (drainage/soil)
  lengthM: number
  notes?: string
}

export interface StoredPlumbing {
  projectId: string
  updatedAt: number
  fixtures: PlumbingFixtureRow[]
  pipeRuns: PlumbingPipeRun[]
}

export function createPlumbingFixtureRow(input: Omit<PlumbingFixtureRow, 'id'>): PlumbingFixtureRow {
  return { ...input, id: generatePlumbingRowId('fixture') }
}

export function createPlumbingPipeRun(input: Omit<PlumbingPipeRun, 'id'>): PlumbingPipeRun {
  return { ...input, id: generatePlumbingRowId('pipe') }
}

function generatePlumbingRowId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function validatePlumbingFixtureRow(row: PlumbingFixtureRow): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (row.quantity <= 0) {
    errors.push('Quantity শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}

export function validatePlumbingPipeRun(row: PlumbingPipeRun): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (row.diameterMm <= 0) {
    errors.push('Diameter শূন্যের বেশি হতে হবে।')
  }
  if (row.lengthM <= 0) {
    errors.push('Length শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}
