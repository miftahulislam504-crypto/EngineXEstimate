// app/project/[projectId]/electrical/page.tsx
//
// Module 16 — Electrical। শুধু projectId লাগে (app/project/[projectId]/reinforcement/page.tsx-এর একই pattern)।

'use client'

import { useParams } from 'next/navigation'
import { ElectricalPanel } from '@/components/electrical/ElectricalPanel'

export default function ElectricalPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <ElectricalPanel projectId={projectId} />
}
