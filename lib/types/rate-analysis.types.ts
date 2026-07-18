// lib/types/rate-analysis.types.ts
//
// Module 4 — প্রতিটা BOQ item-এর জন্য Rate = Material + Labour +
// Equipment + Overhead + Profit breakdown। Original doc-এর উদাহরণ
// (RCC-এর জন্য Cement/Sand/Stone/Rebar + Mason/Bar Bender +
// Mixer/Vibrator) অনুযায়ী প্রতিটা BOQ item-এর নিচে material/labour/
// equipment "consumption" (প্রতি unit BOQ-তে কতটুকু লাগে) রাখা
// হয়েছে, যাতে rate calculate করার সময় Module 5/এই ফাইলের
// resourceRate-এর currentRate-এর সাথে গুণ করা যায়।

export interface MaterialConsumption {
  materialId: string // Module 5-এর Material.id রেফারেন্স
  materialName: string // snapshot — Material পরে rename/deactivate হলেও পুরনো rate analysis পড়া যাবে
  quantityPerUnit: number // BOQ item-এর ১ unit বানাতে কত এই material লাগে (যেমন RCC-এর ১ m³-এ কত ব্যাগ সিমেন্ট)
}

export interface LabourConsumption {
  resourceRateId: string // Module 4-এর নিজের ResourceRate.id রেফারেন্স (labour)
  resourceName: string // snapshot
  quantityPerUnit: number // BOQ item-এর ১ unit বানাতে কত দিন/ঘণ্টা এই labour লাগে
}

export interface EquipmentConsumption {
  resourceRateId: string // ResourceRate.id রেফারেন্স (equipment)
  resourceName: string
  quantityPerUnit: number
}

/**
 * একটা BOQ item-এর জন্য সম্পূর্ণ rate breakdown। overheadPercent ও
 * profitPercent per-item configurable রাখা হয়েছে (per-project global
 * default-ও থাকতে পারে, কিন্তু override করার সুযোগ রাখা হলো, কারণ
 * সব BOQ item-এ একই overhead/profit ধরে নেওয়া বাস্তবসম্মত নাও হতে
 * পারে — যেমন সহজ কাজে profit margin কম রাখা)।
 */
export interface RateAnalysisEntry {
  id: string
  boqItemId: string // BOQItem.id রেফারেন্স
  boqItemName: string // snapshot
  materials: MaterialConsumption[]
  labour: LabourConsumption[]
  equipment: EquipmentConsumption[]
  overheadPercent: number // মোট (material+labour+equipment) খরচের উপর %
  profitPercent: number // (material+labour+equipment+overhead)-এর উপর %
}

export interface RateAnalysisCostBreakdown {
  materialCost: number
  labourCost: number
  equipmentCost: number
  subtotal: number // material + labour + equipment
  overheadAmount: number
  profitAmount: number
  finalRate: number // subtotal + overhead + profit — এটাই প্রতি unit-এর চূড়ান্ত rate
}

export interface StoredRateAnalysis {
  projectId: string
  updatedAt: number
  entries: RateAnalysisEntry[]
}
