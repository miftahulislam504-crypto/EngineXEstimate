// lib/services/tender.service.ts

import { EngineerEstimate, ContractorBid } from '@/lib/types/tender.types'

export interface ComparativeStatementRow {
  bidId: string
  contractorName: string
  bidAmount: number
  differenceFromEngineerEstimate: number // bidAmount - engineerEstimate.totalAmount
  differencePercent: number
  isLowestBid: boolean
}

/**
 * Comparative Statement-এর মূল টেবিল ডেটা — Engineer Estimate-এর
 * বিপরীতে প্রতিটা contractor bid-এর তুলনা। সর্বনিম্ন bid চিহ্নিত করা
 * হয়, কিন্তু সেটা "সেরা পছন্দ" বোঝায় না — justification field-এ
 * ব্যবহারকারী অন্য কারণ (মান, সময়সীমা, ইত্যাদি) লিখতে পারবে যখন
 * finalize করা হবে।
 */
export function buildComparativeStatement(
  engineerEstimate: EngineerEstimate | null,
  bids: ContractorBid[]
): ComparativeStatementRow[] {
  if (bids.length === 0) return []

  const lowestAmount = Math.min(...bids.map((b) => b.bidAmount))

  return bids
    .map((bid) => {
      const difference = engineerEstimate ? bid.bidAmount - engineerEstimate.totalAmount : 0
      const differencePercent =
        engineerEstimate && engineerEstimate.totalAmount > 0
          ? (difference / engineerEstimate.totalAmount) * 100
          : 0

      return {
        bidId: bid.id,
        contractorName: bid.contractorName,
        bidAmount: bid.bidAmount,
        differenceFromEngineerEstimate: difference,
        differencePercent,
        isLowestBid: bid.bidAmount === lowestAmount,
      }
    })
    .sort((a, b) => a.bidAmount - b.bidAmount) // সর্বনিম্ন bid প্রথমে, তুলনা করা সহজ করার জন্য
}

export interface TenderValidationResult {
  valid: boolean
  errors: string[]
}

export function validateEngineerEstimate(input: { totalAmount: number }): TenderValidationResult {
  const errors: string[] = []
  if (input.totalAmount <= 0) {
    errors.push('Total Amount শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}

export function validateContractorBid(input: {
  contractorName: string
  bidAmount: number
}): TenderValidationResult {
  const errors: string[] = []
  if (!input.contractorName || input.contractorName.trim().length === 0) {
    errors.push('Contractor-এর নাম খালি রাখা যাবে না।')
  }
  if (input.bidAmount <= 0) {
    errors.push('Bid Amount শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}

export function validateFinalization(input: {
  selectedBidId: string
  finalizedAmount: number
}): TenderValidationResult {
  const errors: string[] = []
  if (!input.selectedBidId) {
    errors.push('একটা bid নির্বাচন করতে হবে finalize করার আগে।')
  }
  if (input.finalizedAmount <= 0) {
    errors.push('Finalized Amount শূন্যের বেশি হতে হবে।')
  }
  return { valid: errors.length === 0, errors }
}
