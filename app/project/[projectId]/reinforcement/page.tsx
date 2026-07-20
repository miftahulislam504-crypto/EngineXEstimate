// app/project/[projectId]/reinforcement/page.tsx
//
// Module 7 — Reinforcement Estimation (BBS)। শুধু projectId লাগে।

'use client'

import { useParams } from 'next/navigation'
import { BBSTable } from '@/components/reinforcement/BBSTable'

export default function ReinforcementPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <BBSTable projectId={projectId} />
}
