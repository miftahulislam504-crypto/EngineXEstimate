// app/project/[projectId]/plumbing/page.tsx
//
// Module 17 — Plumbing & Sanitary। শুধু projectId লাগে।

'use client'

import { useParams } from 'next/navigation'
import { PlumbingPanel } from '@/components/plumbing/PlumbingPanel'

export default function PlumbingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <PlumbingPanel projectId={projectId} />
}
