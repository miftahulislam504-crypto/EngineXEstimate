// lib/types/boq.types.ts
//
// Module 3 (BOQ Generator)। Original doc-এর BOQ table structure
// অনুসরণ করা হয়েছে: Item / Unit / Qty, সাথে উদাহরণ হিসেবে Earthwork,
// PCC, RCC, Brick Work, Plaster।
//
// এই মুহূর্তে auto-generation শুধু Structural quantity (RCC volume,
// Module 2 থেকে) থেকে সম্ভব। Earthwork, PCC (আলাদা করে, RCC থেকে
// ভিন্ন), Brick Work, Plaster — এগুলোর জন্য Module 2-এর schema-তে
// এখনো প্রয়োজনীয় ইনপুট নেই (উদাহরণ: Earthwork-এর জন্য excavation
// depth/area, Brick Work-এর জন্য wall thickness — শুধু wallAreaSqft
// থেকে brick volume বের করা যায় না thickness ছাড়া)। তাই এই আইটেমগুলো
// auto-generate না করে "Custom Item" হিসেবে ব্যবহারকারী নিজে যোগ
// করবে, যতক্ষণ না Module 2-এর schema সেই ইনপুটগুলো পায়।

export type BOQUnit = 'm3' | 'm2' | 'kg' | 'nos' | 'ft' | 'ft2' | 'ft3' | 'ton' | 'bag'

export type BOQItemSource =
  | 'auto_rcc' // Module 2-এর structural volume থেকে auto-generated
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
  kg: 'kg',
  nos: 'nos',
  ft: 'ft',
  ft2: 'ft²',
  ft3: 'ft³',
  ton: 'ton',
  bag: 'bag',
}
