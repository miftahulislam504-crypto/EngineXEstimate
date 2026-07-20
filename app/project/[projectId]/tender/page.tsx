// app/project/[projectId]/tender/page.tsx
//
// Module 12 — Tender Estimation (admin-gated finalize, Phase 0
// কমেন্ট অনুযায়ী একই প্যাটার্ন Budget-এর মতো)। শুধু projectId লাগে।

'use client'

import { useParams } from 'next/navigation'
import { TenderPanel } from '@/components/tender/TenderPanel'

export default function TenderPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <TenderPanel projectId={projectId} />
}
