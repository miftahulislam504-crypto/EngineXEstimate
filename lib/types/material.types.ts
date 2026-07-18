// lib/types/material.types.ts
//
// Module 5 (Material Database) + Module 6 (Market Rate Update)-এর
// schema একসাথে ডিজাইন করা হয়েছে, কারণ দুটোই আসলে একই ডেটার উপর কাজ
// করে: Module 5 বলে প্রতিটা material-এর "Price History" থাকবে,
// Module 6 বলে "প্রতিদিন Rate Update হবে" — এই দুটো একই জিনিস, শুধু
// আলাদা Module নম্বরে বর্ণিত হয়েছিল মূল doc-এ।

/**
 * Original doc-এ উদাহরণ হিসেবে যা ছিল: Cement, Sand, Stone, Rebar,
 * Brick, Tiles, Paint। কিন্তু এটা hardcoded union type হিসেবে রাখা
 * হয়নি — কারণ বাস্তবে নতুন material (যেমন different cement grade,
 * বা নতুন ধরনের tile) যোগ করার প্রয়োজন হবেই। তার বদলে category
 * হিসেবে একটা looser grouping রাখা হলো, যেটা UI-তে filter/group করার
 * কাজে লাগবে কিন্তু নতুন material যোগ করতে block করবে না।
 */
export type MaterialCategory =
  | 'cement'
  | 'sand'
  | 'stone'
  | 'rebar'
  | 'brick'
  | 'tiles'
  | 'paint'
  | 'other'

/**
 * Rate Analysis (Module 4)-এর Rate = Material + Labour + Equipment +
 * Overhead + Profit ফর্মুলায় unit ঠিকভাবে মেলাতে হবে — তাই এখানে
 * একটা bounded union রাখা হলো, ফ্রি-টেক্সট স্ট্রিং না। BNBC/দেশীয়
 * নির্মাণ শিল্পে প্রচলিত একক অনুযায়ী।
 */
export type MaterialUnit =
  | 'bag' // সিমেন্ট
  | 'cft' // কিউবিক ফুট (বালি, পাথর)
  | 'kg' // রড, ইত্যাদি ওজনভিত্তিক
  | 'ton'
  | 'piece' // ইট, টাইলস
  | 'sqft'
  | 'liter' // রং
  | 'sqm'

export interface Supplier {
  id: string
  name: string
  contactPerson?: string
  phone?: string
  address?: string
}

/**
 * একটা material entry-র মূল ডকুমেন্ট। currentRate এখানেই থাকে
 * (দ্রুত read করার জন্য — Rate Analysis-এ বারবার লাগবে), কিন্তু
 * পুরো ইতিহাস আলাদা subcollection-এ (নিচে দ্রষ্টব্য), যাতে এই মূল
 * document ছোট থাকে এবং প্রতিটা rate change-এ পুরো ইতিহাস
 * rewrite করতে না হয়।
 */
export interface Material {
  id: string
  name: string // যেমন "OPC Cement (Fresh)", "1st Class Brick"
  category: MaterialCategory
  unit: MaterialUnit
  brand?: string
  defaultSupplierId?: string // Supplier collection-এর রেফারেন্স
  currentRate: number // টাকা, প্রতি unit
  lastUpdatedAt: number // epoch ms — currentRate কবে আপডেট হয়েছে
  notes?: string
  isActive: boolean // বন্ধ হয়ে যাওয়া material লিস্ট থেকে সরানোর বদলে inactive করা, কারণ পুরনো BOQ/estimate-এ রেফারেন্স থাকতে পারে
}

/**
 * Module 6 (Market Rate Update)-এর প্রতিদিনের entry। Firestore পাথ:
 * materials/{materialId}/priceHistory/{entryId}
 *
 * প্রতিটা entry immutable — একবার লেখা হলে বদলানো হয় না (ভুল হলে
 * নতুন correcting entry যোগ করা হয়, পুরনোটা মুছে না), কারণ এটা একটা
 * audit trail: কোনদিন rate কত ছিল সেটা historical record, ভবিষ্যতে
 * "এই estimate কোন দিনের rate দিয়ে হয়েছিল" জানতে দরকার হতে পারে।
 */
export interface PriceHistoryEntry {
  id: string
  materialId: string
  rate: number
  recordedAt: number // epoch ms
  source: 'manual' | 'market_scan' // ভবিষ্যতে external API/scrape যোগ হলে ব্যবহার হবে; এখন শুধু 'manual'
  recordedBy?: string // uid
  note?: string // যেমন "সরকারি ছুটির আগে দাম বৃদ্ধি"
}

/**
 * একটা rate যখন হঠাৎ অনেকখানি বদলায় (Module 6-এ উল্লিখিত "Rate
 * change notification/flag"), সেটা চিহ্নিত করার থ্রেশহোল্ড। এই
 * সংখ্যাটা arbitrary সিদ্ধান্ত — বাস্তব ব্যবহারে দেখে টিউন করা
 * দরকার হতে পারে।
 */
export const SIGNIFICANT_RATE_CHANGE_THRESHOLD_PERCENT = 10
