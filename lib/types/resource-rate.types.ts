// lib/types/resource-rate.types.ts
//
// Module 4 (Rate Analysis)-এর Labour ও Equipment cost — Material
// Database (Module 5)-এর মতোই list/rate/history প্যাটার্ন অনুসরণ
// করে, কিন্তু আলাদা টাইপ কারণ unit fundamentally ভিন্ন: Material
// quantity-ভিত্তিক (bag, cft, kg), Labour/Equipment সময়-ভিত্তিক
// (day, hour)। এই দুটো এক schema-তে জোর করে মেলালে MaterialUnit
// union-এ "day"/"hour" ঢুকে যেত, যেটা conceptually ভুল — একজন Mason
// কখনো "কত ব্যাগ" হিসেবে measure হয় না।

export type ResourceRateType = 'labour' | 'equipment'

export type ResourceRateUnit = 'day' | 'hour'

/**
 * Original doc-এ উদাহরণ হিসেবে যা ছিল: Labour-এ Mason, Helper,
 * Carpenter, Bar Bender; Equipment-এ Mixer, Vibrator, Excavator।
 * Material-এর মতোই hardcoded union না রেখে category হিসেবে রাখা
 * হলো, যাতে নতুন labour/equipment role/machine যোগ করা যায়
 * ব্লক ছাড়াই।
 */
export type LabourCategory = 'mason' | 'helper' | 'carpenter' | 'bar_bender' | 'other'
export type EquipmentCategory = 'mixer' | 'vibrator' | 'excavator' | 'other'

export interface ResourceRate {
  id: string
  type: ResourceRateType
  category: LabourCategory | EquipmentCategory
  name: string // যেমন "Mason (Skilled)", "Concrete Mixer (10/7 cft)"
  unit: ResourceRateUnit
  currentRate: number // টাকা, প্রতি unit
  lastUpdatedAt: number
  notes?: string
  isActive: boolean
}

/**
 * material.types.ts-এর PriceHistoryEntry-র সমান্তরাল — একই কারণে
 * (audit trail, "কোন দিনের রেট দিয়ে estimate হয়েছিল" জানার জন্য)।
 */
export interface ResourceRateHistoryEntry {
  id: string
  resourceRateId: string
  rate: number
  recordedAt: number
  recordedBy?: string
  note?: string
}

// নোট: এই ফাইলে আগে LABOUR_CATEGORY_LABELS, EQUIPMENT_CATEGORY_LABELS,
// RESOURCE_RATE_UNIT_LABELS নামে hardcoded বাংলা Record ছিল। i18n
// retrofit করার সময় সেগুলো সরিয়ে components/resource-rates/
// ResourceRateManager.tsx-এ নেওয়া হয়েছে, কারণ অনুবাদের জন্য t() hook
// লাগে যেটা .types.ts ফাইলে (component/hook না হওয়ায়) ব্যবহার করা
// যায় না।
