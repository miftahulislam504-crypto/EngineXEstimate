// app/project/[projectId]/cost-tracking/page.tsx
//
// Module 11 — Cost Tracking (Dashboard-এর Budget vs Actual অংশ
// পূরণ করে, Phase 0 কমেন্ট অনুযায়ী)। শুধু projectId লাগে।

'use client'

import { useParams } from 'next/navigation'
import { CostTrackingPanel } from '@/components/cost-tracking/CostTrackingPanel'

export default function CostTrackingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <CostTrackingPanel projectId={projectId} />
}
