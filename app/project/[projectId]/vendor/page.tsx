// app/project/[projectId]/vendors/page.tsx
//
// Module 9 — supplier organization-wide, quotation/purchase
// project-scoped (Phase 0 কমেন্টে একই ব্যাখ্যা ছিল)। VendorPanel
// নিজেই এই বিভাজন সামলায়, তাই এখানে শুধু projectId পাস করাই যথেষ্ট।

'use client'

import { useParams } from 'next/navigation'
import { VendorPanel } from '@/components/vendor/VendorPanel'

export default function VendorsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <VendorPanel projectId={projectId} />
}
