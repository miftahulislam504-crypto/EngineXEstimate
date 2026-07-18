// lib/services/vendor.service.ts

import { Quotation, PriceComparisonRow, Supplier } from '@/lib/types/vendor.types'

/**
 * একটা নির্দিষ্ট material-এর জন্য সব quotation পাশাপাশি সাজায়,
 * সর্বনিম্ন দাম চিহ্নিত করে। tender.service.ts-এর
 * buildComparativeStatement()-এর একই ধরনের তুলনামূলক-টেবিল যুক্তি,
 * কিন্তু এখানে material-rate তুলনা করা হচ্ছে, contractor bid না।
 */
export function buildPriceComparison(
  materialId: string,
  quotations: Quotation[],
  suppliers: Supplier[]
): PriceComparisonRow[] {
  const relevantQuotes = quotations.filter((q) => q.materialId === materialId)
  if (relevantQuotes.length === 0) return []

  const lowestRate = Math.min(...relevantQuotes.map((q) => q.quotedRate))

  return relevantQuotes
    .map((quote) => {
      const supplier = suppliers.find((s) => s.id === quote.supplierId)
      return {
        supplierId: quote.supplierId,
        supplierName: supplier?.name ?? 'অজানা সরবরাহকারী',
        quotedRate: quote.quotedRate,
        quotedAt: quote.quotedAt,
        isLowest: quote.quotedRate === lowestRate,
      }
    })
    .sort((a, b) => a.quotedRate - b.quotedRate)
}

export interface VendorValidationResult {
  valid: boolean
  errors: string[]
}

export function validateSupplier(input: { name: string }): VendorValidationResult {
  const errors: string[] = []
  if (!input.name || input.name.trim().length === 0) {
    errors.push('সরবরাহকারীর নাম খালি রাখা যাবে না।')
  }
  return { valid: errors.length === 0, errors }
}

export function validateQuotation(input: { quotedRate: number }): VendorValidationResult {
  const errors: string[] = []
  if (input.quotedRate <= 0) {
    errors.push('Quoted rate শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}

export function validatePurchaseRecord(input: { quantity: number; unitRate: number }): VendorValidationResult {
  const errors: string[] = []
  if (input.quantity <= 0) {
    errors.push('Quantity শূন্যের বেশি হতে হবে।')
  }
  if (input.unitRate <= 0) {
    errors.push('Unit rate শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}
