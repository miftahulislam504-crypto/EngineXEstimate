// lib/services/material.service.ts
//
// Material entry-র validation। এখানে আটকানো দরকার কারণ Module 4-এর
// Rate = Material + Labour + Equipment + Overhead + Profit ফর্মুলা
// সরাসরি currentRate-এর উপর নির্ভর করে — এখানে bad data (negative
// rate, খালি নাম) ঢুকলে সেটা silently Module 4-এর হিসাবে ভুল ফলাফল
// দেবে, এবং সেই ভুল ধরা কঠিন হবে কারণ ভুলের উৎস অনেক দূরে থাকবে।

export interface MaterialValidationResult {
  valid: boolean
  errors: string[]
}

export function validateMaterialInput(input: {
  name: string
  currentRate: number
  unit: string
}): MaterialValidationResult {
  const errors: string[] = []

  if (!input.name || input.name.trim().length === 0) {
    errors.push('Material-এর নাম খালি রাখা যাবে না।')
  }

  if (input.currentRate <= 0) {
    errors.push(
      `Rate অবশ্যই শূন্যের বেশি হতে হবে (দেওয়া হয়েছে: ${input.currentRate})। Rate Analysis (Module 4) এই মান দিয়ে হিসাব করবে।`
    )
  }

  if (!Number.isFinite(input.currentRate)) {
    errors.push('Rate একটা বৈধ সংখ্যা হতে হবে।')
  }

  if (!input.unit) {
    errors.push('Unit নির্বাচন করা আবশ্যক।')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Rate change validation — Module 6 (Market Rate Update)-এ ব্যবহার
 * হবে। এখানে একটা sanity বাউন্ড আছে (rate ১০০ গুণ বেড়ে/কমে যাওয়া)
 * যেটা সাধারণত টাইপো-জনিত ভুল ধরার জন্য (যেমন ৫৭০ টাইপ করতে গিয়ে
 * ৫৭০০ হয়ে যাওয়া), প্রকৃত বাজার পরিবর্তন প্রতিরোধ করার জন্য না —
 * তাই এটা শুধু warning, error না।
 */
export function validateRateChange(
  previousRate: number,
  newRate: number
): { warning: string | null } {
  if (previousRate <= 0) return { warning: null }

  const ratio = newRate / previousRate
  if (ratio > 100 || ratio < 0.01) {
    return {
      warning: `নতুন rate (${newRate}) আগের rate-এর (${previousRate}) চেয়ে অস্বাভাবিকভাবে ভিন্ন — টাইপো হয়ে থাকতে পারে, আবার যাচাই করুন।`,
    }
  }
  return { warning: null }
}
