// app/project/[projectId]/materials/page.tsx
//
// Module 5/6 — MaterialDatabase organization-wide (projectId লাগে
// না, Phase 0-এ মূল কোডের কমেন্টেও এটা স্পষ্ট করা ছিল)। এই route-এ
// থাকার কারণ শুধু sidebar navigation-এর জন্য — ডেটা প্রজেক্ট-নিরপেক্ষ
// হলেও ব্যবহারকারী "একটা প্রজেক্টের workspace-এর ভেতরে আছি"
// প্রসঙ্গটা হারায় না, sidebar/topbar একই থাকে।

'use client'

import { MaterialDatabase } from '@/components/materials/MaterialDatabase'

export default function MaterialsPage() {
  return <MaterialDatabase />
}
