// lib/utils.ts
//
// সাধারণ helper — Hub-এর lib/utils.ts-এর একই cn() pattern (clsx +
// tailwind-merge), প্লাস প্রজেক্ট স্ট্যাটাস/তারিখ ফরম্যাট করার
// helper-গুলো যেগুলো Project Selector (app/page.tsx) আর workspace
// layout (app/project/[projectId]/layout.tsx) দুই জায়গাতেই লাগে,
// তাই এখানে একবার লেখা।

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ProjectStatus } from '@/lib/types/project.types'
import { Lang } from '@/lib/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// প্রজেক্ট কার্ডের বাম পাশের রঙিন বার (status বোঝাতে)
export function getStatusBarColor(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    active: 'bg-green-500',
    on_hold: 'bg-amber-500',
    completed: 'bg-blue-500',
  }
  return map[status] ?? 'bg-surface-border'
}

// প্রজেক্ট কার্ড/টপবারের status badge
export function getStatusBadgeClass(status: ProjectStatus): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold'
  const map: Record<ProjectStatus, string> = {
    active: `${base} bg-green-100 text-green-700`,
    on_hold: `${base} bg-amber-100 text-amber-700`,
    completed: `${base} bg-blue-100 text-blue-700`,
  }
  return map[status] ?? `${base} bg-surface text-text-muted`
}

// status badge/label-এর জন্য i18n key — STATUS_FILTERS-এর labelKey-এর
// সাথে একই নামকরণ মেলানো হয়েছে (statusActive/statusOnHold/statusCompleted)
export function getStatusLabelKey(status: ProjectStatus): 'statusActive' | 'statusOnHold' | 'statusCompleted' {
  const map: Record<ProjectStatus, 'statusActive' | 'statusOnHold' | 'statusCompleted'> = {
    active: 'statusActive',
    on_hold: 'statusOnHold',
    completed: 'statusCompleted',
  }
  return map[status] ?? 'statusActive'
}

// প্রজেক্টের startDate (ISO string) কে বাংলা/ইংরেজি lang অনুযায়ী
// readable date-এ ফরম্যাট করে
export function formatDate(dateStr: string | undefined | null, lang: Lang = 'en'): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
