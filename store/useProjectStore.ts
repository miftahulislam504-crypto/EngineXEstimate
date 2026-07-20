// store/useProjectStore.ts
//
// projects/{projectId} collection Hub-এর সাথে শেয়ার্ড (lib/types/
// project.types.ts আর firestore-rules-for-hub/README.md-এ বিস্তারিত)।
// এই store শুধু read করে — কোনো create/update/delete নেই, কারণ
// প্রজেক্ট ম্যানেজমেন্ট Hub-এর দায়িত্ব (app/page.tsx-এর শীর্ষ কমেন্ট
// দ্রষ্টব্য)।
//
// দুইটা আলাদা concern এখানে একই store-এ রাখা হয়েছে (useAuthStore-এর
// মতোই একক store pattern):
//   1. fetchProjects(uid)      — Project Selector list (app/page.tsx)
//   2. fetchActiveProject(id)  — workspace topbar (layout.tsx), single
//      project-এর জন্য
//
// fetchProjects owner filter করে না — firestore.rules-এ
// projects/{projectId} শুধু isSignedIn() চেক করে, ownerUid ফিল্ড
// অনুযায়ী filter করা হয় না (Hub multi-user/team প্রজেক্ট হতে পারে,
// তাই client-এ owner-only filtering ভুল হবে)। সব signed-in user সব
// প্রজেক্ট দেখে — এটা Hub-এর নিজের project list page-এর একই আচরণ।

import { create } from 'zustand'
import { collection, getDocs, doc, getDoc, query, orderBy, type DocumentData } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Project } from '@/lib/types/project.types'

interface ProjectState {
  // Project Selector (app/page.tsx)
  projects: Project[]
  loading: boolean
  error: string | null
  fetchProjects: (uid: string) => Promise<void>

  // Workspace layout (app/project/[projectId]/layout.tsx)
  activeProject: Project | null
  activeProjectLoading: boolean
  activeProjectError: string | null
  fetchActiveProject: (projectId: string) => Promise<void>
  clearActiveProject: () => void
}

function toProject(id: string, data: DocumentData): Project {
  const d = data as Record<string, unknown>
  return {
    id,
    projectName: (d.projectName as string) ?? '',
    projectCode: (d.projectCode as string) ?? '',
    clientName: (d.clientName as string) ?? '',
    location: (d.location as string) ?? '',
    status: (d.status as Project['status']) ?? 'active',
    startDate: (d.startDate as string) ?? '',
  }
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  // uid বর্তমানে filter-এ ব্যবহার হয় না (উপরের কমেন্ট দ্রষ্টব্য),
  // কিন্তু signature-এ রাখা হয়েছে — future-এ Hub যদি projects-এ
  // memberUids/ownerUid ফিল্ড যোগ করে client-side filtering দরকার
  // হয়, তখন call site (app/page.tsx) বদলাতে হবে না।
  fetchProjects: async (_uid: string) => {
    set({ loading: true, error: null })
    try {
      const q = query(collection(db, 'projects'), orderBy('projectName', 'asc'))
      const snap = await getDocs(q)
      const projects = snap.docs.map((d) => toProject(d.id, d.data()))
      set({ projects, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load projects' })
    }
  },

  activeProject: null,
  activeProjectLoading: false,
  activeProjectError: null,

  fetchActiveProject: async (projectId: string) => {
    set({ activeProjectLoading: true, activeProjectError: null })
    try {
      const snap = await getDoc(doc(db, 'projects', projectId))
      if (!snap.exists()) {
        set({ activeProject: null, activeProjectLoading: false })
        return
      }
      set({ activeProject: toProject(snap.id, snap.data()), activeProjectLoading: false })
    } catch (e) {
      set({
        activeProject: null,
        activeProjectLoading: false,
        activeProjectError: e instanceof Error ? e.message : 'Failed to load project',
      })
    }
  },

  clearActiveProject: () => set({ activeProject: null, activeProjectError: null }),
}))
