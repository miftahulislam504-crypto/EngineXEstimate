// app/project/[projectId]/budget/page.tsx
//
// Module 10 — Budget Planning (admin-gated write, BudgetPanel
// নিজেই estimatingRole চেক করে UI-level এ প্রয়োগ করে)। শুধু
// projectId লাগে।

'use client'

import { useParams } from 'next/navigation'
import { BudgetPanel } from '@/components/budget/BudgetPanel'

export default function BudgetPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <BudgetPanel projectId={projectId} />
}
