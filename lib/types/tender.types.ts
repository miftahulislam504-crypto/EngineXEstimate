// lib/types/tender.types.ts
//
// Module 12 — Engineer Estimate, Contractor Estimate, Comparative
// Statement। Phase 0-এ Firestore rules-এ আগেভাগে path নির্ধারণ করা
// হয়েছিল: projects/{projectId}/tenderFinalize/{docId} — শুধু write
// admin-only (read সবার জন্য), ঠিক Module 10 (Budget Planning)-এর
// budgetApproval-এর একই প্যাটার্নে।
//
// rules-এর path নাম "tenderFinalize" (পুরো "tender" না) থেকে ডিজাইন
// intent স্পষ্ট: Engineer Estimate তৈরি ও Contractor bid এন্ট্রি করা
// যে কেউ করতে পারবে, কিন্তু Comparative Statement finalize করে
// চূড়ান্ত সিদ্ধান্ত নেওয়া শুধু admin-এর কাজ।

/**
 * Engineer Estimate — নিজেদের BOQ + Rate Analysis থেকে হিসাব করা
 * "আমাদের দৃষ্টিতে এই কাজের ন্যায্য দাম কত"। Module 1
 * (Dashboard)-এর totalProjectCost-এর সাথে conceptually একই উৎস,
 * কিন্তু এখানে snapshot হিসেবে আলাদা রাখা হচ্ছে — কারণ tender-এর
 * সময়ের cost আর পরবর্তীতে rate বদলে যাওয়া Dashboard cost এক নাও
 * থাকতে পারে, tender comparison-এর জন্য সেই মুহূর্তের snapshot দরকার।
 */
export interface EngineerEstimate {
  id: string
  totalAmount: number
  basedOnBoqVersionId?: string // কোন BOQ version-এর ভিত্তিতে হিসাব করা হয়েছিল, ট্রেসিং-এর জন্য
  createdAt: number
  createdBy?: string
  notes?: string
}

/**
 * একটা contractor-এর জমা দেওয়া bid। একাধিক contractor bid দিতে
 * পারবে, তাই এটা array-ভিত্তিক (single value না)।
 */
export interface ContractorBid {
  id: string
  contractorName: string
  contactInfo?: string
  bidAmount: number
  submittedAt: number
  notes?: string
  documentUrl?: string // পরবর্তীতে Cloudflare R2/Firebase Storage-এ আপলোড করা bid document-এর লিংক
}

/**
 * Comparative Statement — Engineer Estimate বনাম সব Contractor
 * bid-এর পাশাপাশি তুলনা, এবং admin-only finalize action যা কোন
 * bid নির্বাচিত হলো তা লক করে।
 */
export interface TenderFinalization {
  id: string
  selectedBidId: string // কোন ContractorBid নির্বাচিত হলো
  finalizedAmount: number
  finalizedAt: number
  finalizedBy?: string // uid — Firestore rules নিশ্চিত করে এই uid-এর estimatingRole 'admin'
  justification?: string // কেন এই bid নির্বাচিত হলো (শুধু সর্বনিম্ন দাম নাও হতে পারে)
}

export interface StoredTender {
  projectId: string
  updatedAt: number
  engineerEstimates: EngineerEstimate[]
  contractorBids: ContractorBid[]
}

export interface StoredTenderFinalizations {
  projectId: string
  updatedAt: number
  finalizations: TenderFinalization[]
}
