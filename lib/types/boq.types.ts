// lib/types/boq.types.ts
//
// Module 3 (BOQ Generator)। Original doc-এর BOQ table structure
// অনুসরণ করা হয়েছে: Item / Unit / Qty, সাথে উদাহরণ হিসেবে Earthwork,
// PCC, RCC, Brick Work, Plaster।
//
// ── ২০২৬-০৮-২০ আপডেট (CivilOS-Report-Audit.md gap #2 সমাধান) ──────
// আগে auto-generation শুধু RCC volume থেকে সম্ভব ছিল। এখন
// quantity-takeoff.types.ts-এ EarthworkQuantities/MasonryWallSegment/
// FinishingQuantities/StairQuantities যোগ হওয়ায়
// Earthwork/Masonry(Brick Work)/Finishing(Plaster/Tiles/Paint/
// Ceiling/Waterproofing)/Stair-ও auto-generate হয় (boq.service.ts-এর
// generateEarthworkBOQItems/generateMasonryBOQItems/
// generateFinishingBOQItems/generateStairBOQItems)। এই ট্রেডগুলোর
// upstream data optional (Structural/Architectural app থেকে না
// এলে undefined) — তাই এখনো পুরোপুরি নির্ভরযোগ্যভাবে সবসময় আসবে না,
// upstream না থাকলে সেই ট্রেড এখনো "Custom Item" হিসেবে manual যোগ
// করতে হবে।
//
// PCC (Plain Cement Concrete, footing-এর নিচে levelling layer)
// এখনো auto-generate হয় না — Module 2-এর schema-তে PCC thickness/
// area আলাদা করে নেই (EarthworkQuantities-এ শুধু excavation আছে)।

export type BOQUnit = 'm3' | 'm2' | 'm' | 'kg' | 'nos' | 'point' | 'ft' | 'ft2' | 'ft3' | 'ton' | 'bag'
// ２０２৬-０৮-２０ যোগ — 'm' (linear meter, cable/pipe run) ও 'point'
// (electrical point-count item) — Electrical/Plumbing module-এর
// জন্য (audit gap #1 সমাধান, boq.service.ts-এর
// generateElectricalBOQItems()/generatePlumbingBOQItems() দ্রষ্টব্য)।

export type BOQItemSource =
  | 'auto_rcc' // Module 2-এর structural volume (footing/column/beam/slab) থেকে auto-generated
  | 'auto_earthwork' // EarthworkQuantities থেকে (excavation/backfill/disposal)
  | 'auto_masonry' // MasonryWallSegment[] থেকে (external/internal/parapet brick work)
  | 'auto_finishing' // FinishingQuantities থেকে (plaster/tiles/paint/ceiling/waterproofing)
  | 'auto_stair' // StairQuantities থেকে (waist slab + reinforcement)
  | 'auto_doors_windows' // ArchitecturalFloorQuantities.doorQuantity/windowQuantity থেকে (২০২৬-০৮-২০ যোগ, audit gap #4)
  | 'auto_electrical' // ElectricalPointRow[]/ElectricalCableRun[] থেকে (２０２৬-０৮-２０ যোগ, audit gap #1)
  | 'auto_plumbing' // PlumbingFixtureRow[]/PlumbingPipeRun[] থেকে (２０২৬-０৮-２０ যোগ, audit gap #1)
  | 'manual' // ব্যবহারকারী নিজে যোগ করেছে (Custom Item)

export interface BOQItem {
  id: string
  itemName: string // যেমন "RCC (Column, Beam, Slab, Footing)", "Earthwork - Foundation Excavation"
  unit: BOQUnit
  quantity: number
  floorId?: string // কোন floor থেকে এসেছে, auto-generated আইটেমের জন্য; custom item হলে undefined (পুরো প্রজেক্টের জন্য প্রযোজ্য ধরে নেওয়া হয়)
  source: BOQItemSource
  notes?: string
}

/**
 * একটা BOQ-এর সম্পূর্ণ version। Original doc-এ "BOQ Versioning" ও
 * "BOQ History" আলাদা করে চাওয়া হয়েছিল — Hub import ও Quantity
 * Takeoff-এর মতো একই versioned-subcollection প্যাটার্ন এখানেও
 * অনুসরণ করা হয়েছে।
 */
export interface BOQVersion {
  versionId: string
  projectId: string
  createdAt: number
  generatedFromQuantityImportId?: string // Module 2-এর কোন quantity takeoff import থেকে auto-generate হয়েছিল, ট্রেসিং-এর জন্য
  items: BOQItem[]
  label?: string // ব্যবহারকারী চাইলে version-এর নাম দিতে পারবে, যেমন "Tender Submission v1"
}

export const BOQ_UNIT_LABELS: Record<BOQUnit, string> = {
  m3: 'm³',
  m2: 'm²',
  m: 'm',
  kg: 'kg',
  nos: 'nos',
  point: 'point',
  ft: 'ft',
  ft2: 'ft²',
  ft3: 'ft³',
  ton: 'ton',
  bag: 'bag',
}
