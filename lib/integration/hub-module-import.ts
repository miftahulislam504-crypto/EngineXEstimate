// lib/integration/hub-module-import.ts
//
// architectural-mapper.ts/structural-mapper.ts শুধু raw module data-কে
// ArchitecturalFloorQuantities[]/StructuralFloorQuantities[]-এ নামায়।
// এই ফাইল সেই দুটোকে getModuleData() (hub-sdk-client.ts)-এর সাথে জুড়ে
// একটাই QuantityTakeoffExport বানায় ও existing
// parseQuantityTakeoffExport()-এর মধ্য দিয়ে validate করে।
//
// ⚠️ ইচ্ছাকৃতভাবে এখানে saveQuantityTakeoff() কল করা হয় না।
// app/project/[projectId]/quantity-takeoff/page.tsx-এর
// handleImportSuccess() ইতিমধ্যে এই দায়িত্ব পালন করে (manual JSON
// import-এর QuantityImportPanel.onImportSuccess থেকেও একই পথে যায়) —
// prepareHubImport() সেই একই contract মেনে শুধু validated payload
// ফেরত দেয়, page নিজেই save করবে। এতে save-path একটাই জায়গায় থাকে,
// Hub-import ও manual-import দুটোই এক pipeline দিয়ে যায় — future
// bug কমই হবে যদি সেভ-লজিক এক জায়গায় থাকে।
//
// dependency-link (Estimate যে architectural/structural-এর কোন
// version থেকে import করেছে, Hub-এর dependency graph-এ) save সফল
// হওয়ার *পরে* হওয়া উচিত (আগে হলে, save ব্যর্থ হলেও link থেকে যাবে,
// মিথ্যা signal দেবে) — তাই সেটা আলাদা linkHubImportDependencies()
// ফাংশনে, page save সফল হওয়ার পর কল করবে।

import { getModuleData, linkOwnDependency } from '@/lib/integration/hub-sdk-client'
import { mapArchitecturalModuleDataToFloors } from '@/lib/integration/architectural-mapper'
import { mapStructuralModuleDataToFloors } from '@/lib/integration/structural-mapper'
import { parseQuantityTakeoffExport } from '@/lib/services/quantity-takeoff.service'
import type { ArchitecturalModuleData, StructuralModuleData } from '@/lib/types/module-data.types'
import type { QuantityTakeoffExport } from '@/lib/types/quantity-takeoff.types'

export interface HubModuleImportPrepareResult {
  success: boolean
  parsed?: QuantityTakeoffExport
  architecturalAvailable: boolean
  structuralAvailable: boolean
  architecturalVersion?: number
  structuralVersion?: number
  errors: string[]
  warnings: string[]
}

/**
 * Hub-এর moduleData থেকে Architectural (ও পাওয়া গেলে Structural)
 * পড়ে, mapper দিয়ে রূপান্তর করে, ও validate করে — কিন্তু save করে না
 * (উপরের নোট দেখুন)। Structural module data এখনো না থাকলে (আজ এটাই
 * স্বাভাবিক অবস্থা — কোনো producer নেই) স্পষ্ট, honest error বার্তা
 * দেয়, কারণ QuantityTakeoffExport-এর দুটোই (architecturalFloors ও
 * structuralFloors) আবশ্যক।
 */
export async function prepareHubImport(projectId: string): Promise<HubModuleImportPrepareResult> {
  const archRecord = await getModuleData(projectId, 'architectural')
  const structRecord = await getModuleData(projectId, 'structural')

  const warnings: string[] = []

  if (!archRecord) {
    return {
      success: false,
      architecturalAvailable: false,
      structuralAvailable: !!structRecord,
      errors: ['Hub-এ এখনো কোনো Architectural module data পাওয়া যায়নি — Architectural app থেকে এখনো কিছু publish হয়নি।'],
      warnings: [],
    }
  }
  if (!structRecord) {
    return {
      success: false,
      architecturalAvailable: true,
      structuralAvailable: false,
      architecturalVersion: archRecord.version,
      errors: ['Hub-এ এখনো কোনো Structural module data পাওয়া যায়নি — Quantity Takeoff-এর জন্য Architectural ও Structural দুটোরই ডেটা দরকার। Structural app থেকে model publish হলে আবার চেষ্টা করুন।'],
      warnings: [],
    }
  }

  const archMap = mapArchitecturalModuleDataToFloors(archRecord.data as ArchitecturalModuleData)
  const structMap = mapStructuralModuleDataToFloors(structRecord.data as StructuralModuleData)
  warnings.push(...archMap.warnings, ...structMap.warnings)

  if (archMap.floors.length === 0 || structMap.floors.length === 0) {
    return {
      success: false,
      architecturalAvailable: true,
      structuralAvailable: true,
      architecturalVersion: archRecord.version,
      structuralVersion: structRecord.version,
      errors: [
        archMap.floors.length === 0 ? 'Architectural module data থেকে কোনো valid floor পাওয়া যায়নি।' : '',
        structMap.floors.length === 0 ? 'Structural module data থেকে কোনো valid floor পাওয়া যায়নি।' : '',
      ].filter(Boolean),
      warnings,
    }
  }

  const candidate = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projectId,
    sourceArchitecturalVersion: String(archRecord.version),
    sourceStructuralVersion: String(structRecord.version),
    architecturalFloors: archMap.floors,
    structuralFloors: structMap.floors,
  }

  const validation = parseQuantityTakeoffExport(JSON.stringify(candidate))

  return {
    success: validation.success,
    parsed: validation.payload,
    architecturalAvailable: true,
    structuralAvailable: true,
    architecturalVersion: archRecord.version,
    structuralVersion: structRecord.version,
    errors: validation.errors,
    warnings: [...warnings, ...validation.warnings],
  }
}

/**
 * page-এর handleImportSuccess() saveQuantityTakeoff() সফল করার পর এটা
 * কল করবে — Estimating-কে architectural ও structural দুটোরই ওপর
 * dependency হিসেবে link করে (Hub-এর dependency graph-এ), যাতে
 * upstream version বদলালে estimating-এর quantities OUTDATED হিসেবে
 * চিহ্নিত হতে পারে (dependency.types.ts-এর getDependencyStatus,
 * Hub-এর existing cascade যা bumpModuleVersion() ব্যবহার করে)।
 * best-effort — link ব্যর্থ হলেও quantity import ইতিমধ্যে সফলভাবে
 * সংরক্ষিত থাকে, তাই এখানে throw করা হয় না।
 */
export async function linkHubImportDependencies(
  projectId: string,
  architecturalVersion: number,
  structuralVersion: number
): Promise<void> {
  try {
    await linkOwnDependency(projectId, 'architectural', architecturalVersion, 'Architectural module data থেকে Quantity Takeoff স্বয়ংক্রিয়ভাবে আমদানি করা হয়েছে')
  } catch {
    /* non-critical */
  }
  try {
    await linkOwnDependency(projectId, 'structural', structuralVersion, 'Structural module data থেকে Quantity Takeoff স্বয়ংক্রিয়ভাবে আমদানি করা হয়েছে')
  } catch {
    /* non-critical */
  }
}
