// lib/types/integration-hub.types.ts
//
// Module 15 — Integration Hub। মূল doc-এর data flow:
//
//   Architectural → Structural → Estimating & Costing → Budget →
//   Project Management
//
// এই ফাইলে প্রতিটা "connection point" (এক app-এর output যেটা আরেক
// app-এর input) একটা টাইপড contract হিসেবে registry-তে রাখা হয়েছে।
//
// ⚠️ গুরুত্বপূর্ণ প্রেক্ষাপট: Structural/Architectural/Project
// Management app এখনো তৈরি হয়নি, আর Hub এই মুহূর্তে Estimating-এর
// জন্য কোনো live Firestore path-এ write করে না (শুধু Structural-এর
// জন্য একটা path আছে, Hub audit অনুযায়ী — Phase 0 নোট দেখুন)। তাই এই
// registry-র বেশিরভাগ entry এখন 'planned' status-এ থাকবে, শুধু
// firestorePath একটা প্রস্তাবিত মান (এখনো Hub-এর সাথে চূড়ান্ত করা
// হয়নি) — ব্যবহারকারী Hub-এর দিকে গিয়ে প্রকৃত path ঠিক করার পর এখানে
// আপডেট হবে। যতক্ষণ না সেটা হচ্ছে, listener চালু থাকবে কিন্তু কিছু
// শুনবে না — এটা bug না, বরং honest "waiting for upstream" অবস্থা।
//
// একমাত্র সত্যিকারের কার্যকরী connection: Hub-এর manual JSON export
// → Estimating-এর নিজের activeImport pointer (hub-import.firestore.ts,
// Phase 0-এ তৈরি)। এই একটা connection point-এর জন্যই সত্যিকারের
// onSnapshot listener বসানো হয়েছে (lib/integration/hub-import-listener.ts),
// কারণ এই পাথটা আমাদেরই — Hub না লিখলেও, আমাদের নিজের save function
// (saveHubImport) যখনই লেখে, listener সেটা রিয়েল-টাইমে ধরে ফেলে। এর
// মানে UI polling/manual-refresh ছাড়াই একাধিক ট্যাব/ডিভাইসে sync
// থাকবে, আর ভবিষ্যতে Hub সরাসরি এই একই path-এ লিখলে (bridge চালু
// হলে) কোনো কোড পরিবর্তন ছাড়াই সেটাও ধরা পড়বে।

export type ConnectionDirection = 'upstream' | 'downstream'

/**
 * একটা connection বর্তমানে কোন মোডে আছে:
 * - 'live'     — সত্যিকারের Firestore onSnapshot listener সক্রিয়, ও
 *                data প্রকৃতপক্ষে সেই path-এ লেখা হচ্ছে।
 * - 'listening' — listener কোড আছে ও সক্রিয়, কিন্তু upstream app এখনো
 *                সেই path-এ কিছু লেখে না (তাই কিছু শোনা যাচ্ছে না)।
 * - 'manual'   — কোনো listener নেই, শুধু manual JSON import/export।
 * - 'planned'  — upstream/downstream app-ই এখনো তৈরি হয়নি।
 */
export type ConnectionStatus = 'live' | 'listening' | 'manual' | 'planned'

export interface ConnectionPoint {
  id: string
  label: string
  direction: ConnectionDirection
  counterpartApp: string // যেমন "CivilOS Hub", "Structural", "Project Management"
  dataDescription: string // কী ডেটা যাচ্ছে/আসছে (সংক্ষেপে)
  firestorePath: string // প্রস্তাবিত বা বাস্তব path — proposedPath থেকে আলাদা করা হয়নি ইচ্ছাকৃতভাবে, নিচে isPathConfirmed দেখুন
  isPathConfirmed: boolean // true হলে এই path নিয়ে counterpart app-এর সাথে সত্যিকারের সমঝোতা হয়ে গেছে; false হলে এটা এখনো আমাদের দিক থেকে প্রস্তাব মাত্র
  schemaVersion: string
  status: ConnectionStatus
  relatedModules: string[] // এই connection point কোন Module(গুলো)-কে ফিড করে, যেমন ["Module 2", "Module 7"]
  notes?: string
}

/**
 * একটা sync attempt-এর log entry — সফল বা ব্যর্থ দুটোই। Sync failure
 * silently চাপা পড়ে গেলে ব্যবহারকারী জানতেই পারবেন না কেন downstream
 * ডেটা পুরনো — তাই প্রতিটা attempt-ই (সফল/ব্যর্থ নির্বিশেষে) log হয়।
 */
export type SyncLogStatus = 'success' | 'failure' | 'stale_detected'

export interface SyncLogEntry {
  id: string
  connectionId: string // ConnectionPoint.id রেফারেন্স
  status: SyncLogStatus
  occurredAt: number // epoch ms
  detail: string // মানুষ-পড়ার-উপযোগী সংক্ষিপ্ত বার্তা
  errorMessage?: string
}

export interface StoredSyncLog {
  projectId: string
  updatedAt: number
  entries: SyncLogEntry[] // সবচেয়ে নতুনটা শেষে; UI-তে reverse করে দেখানো হয়
}

// প্রতি প্রজেক্টে সর্বোচ্চ কতগুলো log entry রাখা হবে — অসীম growth
// এড়ানোর জন্য (Firestore single-document size limit-ও একটা কারণ,
// একটা document 1 MiB-এর বেশি হতে পারে না)।
export const MAX_SYNC_LOG_ENTRIES = 100
