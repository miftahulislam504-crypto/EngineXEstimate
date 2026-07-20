// lib/types/project.types.ts
//
// projects/{projectId} — CivilOS Hub-এ তৈরি হওয়া প্রজেক্ট রেকর্ড।
// এই collection Hub-এর সাথে শেয়ার্ড (একই Firestore project, একই
// collection নাম, firestore-rules-for-hub/README.md-এ নিশ্চিত করা
// আছে)। Estimating app এই collection-এ শুধু read করে — প্রজেক্ট
// তৈরি/সম্পাদনা/মুছা Hub-এর দায়িত্ব (app/page.tsx-এর শীর্ষ কমেন্টে
// বিস্তারিত কারণ)।
//
// এখানে শুধু সেই ফিল্ডগুলো টাইপ করা হয়েছে যেগুলো Estimating app
// আসলে পড়ে (Project Selector list card + workspace topbar) —
// Hub-এর নিজের প্রজেক্ট document-এ আরও ফিল্ড থাকতে পারে, কিন্তু
// সেগুলো এখানে অপ্রাসঙ্গিক।

export type ProjectStatus = 'active' | 'on_hold' | 'completed'

export interface Project {
  id: string
  projectName: string
  projectCode: string
  clientName: string
  location: string
  status: ProjectStatus
  startDate: string
}
