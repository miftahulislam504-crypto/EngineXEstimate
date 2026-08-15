// lib/types/quantity-takeoff.types.ts
//
// ═══════════════════════════════════════════════════════════════
// গুরুত্বপূর্ণ — এই ফাইলের শেপ এখনো Hub-এর কোডে সংজ্ঞায়িত নেই
// ═══════════════════════════════════════════════════════════════
//
// Structural ও Architectural app এখনো তৈরি হয়নি, এবং সিদ্ধান্ত
// অনুযায়ী তারা সরাসরি Estimating app-এ ডেটা পাঠাবে না — সবকিছু Hub-এর
// মাধ্যমে যাবে। কিন্তু Hub-এর lib/types/integration.types.ts-এ
// TARGET_APPS['estimating'].needs এখন শুধু ['buildingInfo',
// 'bnbcSettings'] — কোনো quantity/BOQ-সংক্রান্ত export shape এখনো
// নেই, কারণ Structural/Architectural নিজেরাই এখনো নেই যে তাদের output
// Hub-এ ফিরিয়ে আনার mechanism ডিজাইন করা হবে।
//
// তাই এই ফাইলে যা আছে তা **অনুমান করে ডিজাইন করা একটা contract
// প্রস্তাব** — Hub-এ প্রকৃত কোড লেখার সময় এই শেপ ব্যবহার করা যেতে
// পারে, কিন্তু এটা এখনো চূড়ান্ত নয়। Hub-এ কাজ করার সময় এই ফাইলটা
// রেফারেন্স হিসেবে ব্যবহার করা উচিত, এবং যদি শেপ বদলায়, এই ফাইলও
// একসাথে আপডেট করতে হবে।
//
// Hub থেকে estimating app-এর TARGET_APPS entry-তে ভবিষ্যতে যোগ করতে
// হবে: needs: ['buildingInfo', 'bnbcSettings', 'quantityTakeoff']

/**
 * একটা floor/তলার জন্য Architectural app থেকে যা আসার কথা।
 * Original doc অনুযায়ী প্রতিটা আইটেম floor-ভিত্তিক হতে পারে বলে
 * ধরে নেওয়া হয়েছে (একটা ভবনের প্রতিটা তলায় ভিন্ন wall
 * length/area থাকতে পারে)।
 */
export interface ArchitecturalFloorQuantities {
  floorId: string // যেমন "ground", "1st", "2nd" — Hub/Architectural app-এর floor identifier-এর সাথে মিলতে হবে
  floorLabel: string // UI-তে দেখানোর জন্য, যেমন "গ্রাউন্ড ফ্লোর"
  wallLengthFt: number
  wallAreaSqft: number
  floorAreaSqft: number
  ceilingAreaSqft: number
  paintAreaSqft: number
  doorQuantity: number
  windowQuantity: number
}

/**
 * একটা কাঠামোগত উপাদানের (column/beam/footing/ইত্যাদি) dimension।
 * ব্যবহারকারীর নিশ্চিতকরণ অনুযায়ী: Structural app raw dimension
 * (length/width/depth) পাঠাবে, volume calculation Estimating app-এর
 * নিজের দায়িত্ব — তাই এখানে volume field রাখা হয়নি, শুধু dimension।
 *
 * ft-এ measurement রাখা হয়েছে (BNBC-ভিত্তিক দেশীয় নির্মাণ চর্চায় ft
 * প্রচলিত), volume calculation-এর সময় m³-এ রূপান্তর করা হবে
 * (quantity-takeoff.service.ts-এ)।
 */
export interface StructuralElementDimensions {
  elementId: string // যেমন "C1", "C2" — Structural app-এর গ্রিড লেবেলের সাথে মিলবে বলে ধরে নেওয়া হলো
  lengthFt: number
  widthFt: number
  depthFt: number // slab-এর ক্ষেত্রে thickness, column/beam-এর ক্ষেত্রে height/depth
  count: number // একই dimension-এর কতগুলো element আছে (যেমন 4টা একই সাইজের কর্নার কলাম) — প্রতিটা ভিন্ন element আলাদা এন্ট্রি না করে count দিয়ে গ্রুপ করা যায়
}

/**
 * একটা floor-এর জন্য Structural app থেকে যা আসার কথা।
 *
 * আগের সংস্করণে এটা ছিল শুধু count (columnQuantity: number) —
 * কিন্তু volume calculate করতে (BOQ Generator-এর জন্য) dimension
 * ছাড়া count-এর কোনো মূল্য নেই। তাই প্রতিটা element-type এখন একটা
 * StructuralElementDimensions[] array, কারণ একই floor-এ ভিন্ন সাইজের
 * column/beam থাকতে পারে (যেমন কর্নার কলাম vs ইন্টেরিয়র কলাম) —
 * একটা mাত্র "average dimension" ধরে নিলে ভুল volume আসবে।
 *
 * footingQuantity সাধারণত শুধু ground floor-এ প্রযোজ্য (উপরের
 * floor-এ খালি array থাকবে), কিন্তু per-floor structure রাখা হয়েছে
 * কারণ এই ধরে নেওয়াটা ভুলও হতে পারে (যেমন split-footing design)।
 */
export interface StructuralFloorQuantities {
  floorId: string
  floorLabel: string
  footings: StructuralElementDimensions[]
  columns: StructuralElementDimensions[]
  beams: StructuralElementDimensions[]
  slabs: StructuralElementDimensions[]
  stairQuantity: number // স্টেয়ার সাধারণত সরল কাউন্ট হিসেবেই যথেষ্ট (volume হিসাব জটিল, ভবিষ্যতে দরকার হলে dimension যোগ করা যাবে)
  reinforcementQuantityKg: number // Module 7 (Reinforcement Estimation)-এর বিস্তারিত হিসাবের সাথে এটা মেলাতে হবে
}

/**
 * Hub থেকে পুরো payload — HubExportPayload (lib/types/hub-import.types.ts)-এর
 * সাথে একই প্যাটার্নে ডিজাইন করা। buildingInfo/bnbcSettings-এর জন্য এই
 * প্যাটার্ন এখন hub-native-sync.ts-এ automatic mechanism হিসেবে
 * বাস্তবায়িত (ম্যানুয়াল JSON parse/validate সম্পূর্ণ বাদ) — Structural
 * quantity-এর জন্যও ভবিষ্যতে (structural-to-estimating-quantity
 * connection producer-side রেডি হলে) একই automatic subscribe-and-
 * assemble approach অনুসরণ করা উচিত, ম্যানুয়াল import panel না।
 */
export interface QuantityTakeoffExport {
  version: '1.0'
  exportedAt: string
  projectId: string
  sourceArchitecturalVersion?: string // Architectural app-এর কোন সংস্করণ/timestamp থেকে এসেছে, ট্রেসিং-এর জন্য
  sourceStructuralVersion?: string
  architecturalFloors: ArchitecturalFloorQuantities[]
  structuralFloors: StructuralFloorQuantities[]
}

/**
 * এই app-এর ভেতরে সংরক্ষণের জন্য — Hub import-এর মতোই manual
 * override সম্ভব হওয়া উচিত (Phase 0-এর সিদ্ধান্ত অনুযায়ী "Manual
 * override option" Module 2-এর নিজের চাহিদাতেও ছিল)। তাই প্রতিটা
 * floor-quantity entry-তে raw (Hub থেকে যা এসেছে) ও override (ইউজার
 * যদি ম্যানুয়ালি ঠিক করে) দুটোই রাখা হয়েছে।
 */
export interface QuantityLineItem<T> {
  raw: T // Hub থেকে যেমন এসেছে
  override?: T // ইউজার ম্যানুয়ালি সংশোধন করলে
  isOverridden: boolean
}

export interface StoredQuantityTakeoff {
  projectId: string
  importedAt: number
  architecturalFloors: QuantityLineItem<ArchitecturalFloorQuantities>[]
  structuralFloors: QuantityLineItem<StructuralFloorQuantities>[]
  /** Hub auto-sync (hub-module-import.ts)-এর duplicate-save guard-এর
   * জন্য — কোন Architectural/Structural moduleData version থেকে এই
   * import এসেছে সেটা persist করে রাখা হয়, যাতে page/tab reload-এর
   * পরেও (in-memory guard হারিয়ে গেলেও) "এই version আগেই save করা
   * হয়েছে কিনা" Firestore থেকে verify করা যায়। manual JSON/paste
   * import-এ undefined থাকে (raw JSON-এর version Hub-verified না)। */
  sourceArchitecturalVersion?: string
  sourceStructuralVersion?: string
}

/**
 * override থাকলে সেটা, না থাকলে raw মান — Module 3 (BOQ Generator)
 * ও পরবর্তী সব হিসাবে এই effective মান ব্যবহার করা উচিত, raw সরাসরি
 * না।
 */
export function effectiveArchitecturalQuantities(
  item: QuantityLineItem<ArchitecturalFloorQuantities>
): ArchitecturalFloorQuantities {
  return item.isOverridden && item.override ? item.override : item.raw
}

export function effectiveStructuralQuantities(
  item: QuantityLineItem<StructuralFloorQuantities>
): StructuralFloorQuantities {
  return item.isOverridden && item.override ? item.override : item.raw
}
