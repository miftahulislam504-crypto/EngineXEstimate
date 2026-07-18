// lib/services/boq.service.ts
//
// Module 2 (Quantity Takeoff)-এর structural volume থেকে BOQ item
// auto-generate করে। এই মুহূর্তে শুধু RCC — Earthwork/PCC/Brick
// Work/Plaster-এর জন্য Module 2-এর schema যথেষ্ট তথ্য দেয় না
// (lib/types/boq.types.ts-এর শীর্ষের নোট দ্রষ্টব্য), তাই সেগুলো
// generateBOQFromQuantityTakeoff()-এর আউটপুটে থাকে না — ব্যবহারকারীকে
// addCustomBOQItem() দিয়ে যোগ করতে হবে।

import { StoredQuantityTakeoff, effectiveStructuralQuantities } from '@/lib/types/quantity-takeoff.types'
import { summarizeFloorVolumes } from '@/lib/services/quantity-takeoff.service'
import { BOQItem } from '@/lib/types/boq.types'

function generateItemId(): string {
  return `boqitem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * একটা StoredQuantityTakeoff থেকে RCC BOQ item তৈরি করে — প্রতিটা
 * floor-এর জন্য আলাদা item, যাতে পরে floor-ভিত্তিক cost breakdown
 * (Dashboard, Module 1-এ) সম্ভব হয়। একটা প্রজেক্ট-ব্যাপী single
 * "RCC" item-এ সব floor একত্র করলে সেই granularity হারিয়ে যেত।
 */
export function generateBOQFromQuantityTakeoff(quantityTakeoff: StoredQuantityTakeoff): BOQItem[] {
  const items: BOQItem[] = []

  for (const floorItem of quantityTakeoff.structuralFloors) {
    const effective = effectiveStructuralQuantities(floorItem)
    const volumes = summarizeFloorVolumes(effective)

    if (volumes.totalRccVolumeM3 <= 0) continue // খালি floor-এর জন্য শূন্য-quantity আইটেম তৈরি করার দরকার নেই

    items.push({
      id: generateItemId(),
      itemName: `RCC (Footing, Column, Beam, Slab) — ${effective.floorLabel}`,
      unit: 'm3',
      quantity: Math.round(volumes.totalRccVolumeM3 * 100) / 100, // ২ দশমিক পর্যন্ত, বাস্তব নির্মাণ হিসাবে যথেষ্ট নির্ভুল
      floorId: effective.floorId,
      source: 'auto_rcc',
      notes: `Footing ${volumes.footingVolumeM3.toFixed(2)} + Column ${volumes.columnVolumeM3.toFixed(2)} + Beam ${volumes.beamVolumeM3.toFixed(2)} + Slab ${volumes.slabVolumeM3.toFixed(2)} m³`,
    })
  }

  return items
}

/**
 * একটা নতুন custom item তৈরি করে (auto-generate করা যায় না এমন
 * কিছুর জন্য — Earthwork, PCC, Brick Work, Plaster, ইত্যাদি)।
 */
export function createCustomBOQItem(input: {
  itemName: string
  unit: BOQItem['unit']
  quantity: number
  notes?: string
}): BOQItem {
  return {
    id: generateItemId(),
    itemName: input.itemName,
    unit: input.unit,
    quantity: input.quantity,
    source: 'manual',
    notes: input.notes,
  }
}

export interface BOQValidationResult {
  valid: boolean
  errors: string[]
}

export function validateBOQItem(input: { itemName: string; quantity: number }): BOQValidationResult {
  const errors: string[] = []
  if (!input.itemName || input.itemName.trim().length === 0) {
    errors.push('Item-এর নাম খালি রাখা যাবে না।')
  }
  if (input.quantity <= 0) {
    errors.push(`Quantity অবশ্যই শূন্যের বেশি হতে হবে (দেওয়া হয়েছে: ${input.quantity})।`)
  }
  return { valid: errors.length === 0, errors }
}

/**
 * পুরো BOQ-এর মোট quantity unit অনুযায়ী গ্রুপ করে যোগফল দেয় —
 * Module 1 (Dashboard)-এর Cost Breakdown Chart-এ কাজে লাগবে যখন
 * সেটা বানানো হবে।
 */
export function summarizeBOQByUnit(items: BOQItem[]): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const item of items) {
    summary[item.unit] = (summary[item.unit] ?? 0) + item.quantity
  }
  return summary
}
