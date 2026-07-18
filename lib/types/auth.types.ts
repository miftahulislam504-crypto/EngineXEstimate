// lib/types/auth.types.ts
//
// Hub-এর lib/types.ts-এ থাকা User interface (role: 'engineer' | 'admin')
// থেকে ইচ্ছাকৃতভাবে আলাদা রাখা হয়েছে। users/{uid} document Hub-এর
// সাথে শেয়ার্ড (একই Firestore project, একই collection), আর সেখানে
// ইতিমধ্যে Hub-এর "role" ফিল্ড লেখা হয়। যদি আমরা সেই একই ফিল্ডে
// 'admin' | 'member' লিখি, Hub-এর role vocabulary ('engineer' |
// 'admin') এর সাথে সংঘর্ষ হবে। তাই এই app নিজের role রাখে আলাদা
// ফিল্ডে: users/{uid}.estimatingRole।
//
// এই মুহূর্তে অ্যাপ একজনের ব্যবহারের জন্য — সবাই 'admin'। ভবিষ্যতে
// কর্মচারী/পার্টনার যুক্ত হলে তাদের estimatingRole 'member' বানালেই
// financial write access আটকে যাবে, কোনো নতুন rules deploy বা কোড
// পরিবর্তন ছাড়াই।

export type UserRole = 'admin' | 'member'

export interface EstimatingUser {
  uid: string
  email: string
  displayName: string
  estimatingRole: UserRole
  createdAt: Date
}

/**
 * কোন কাজে admin role লাগবে তার একক তালিকা। এটা শুধু client-side
 * UI-তে বাটন show/hide করার জন্য ব্যবহার হবে — আসল নিরাপত্তা
 * firestore.rules-এ, এই তালিকা না। কিন্তু দুই জায়গায় (rules এবং UI)
 * একই সিদ্ধান্ত প্রতিফলিত হওয়া উচিত, তাই এখানে মন্তব্য হিসেবে রাখা
 * হলো — rules বদলালে এই কমেন্টও বদলাতে হবে।
 *
 * admin-only:
 *   - Module 10 Budget Planning: Approved Cost সেট করা
 *   - Module 12 Tender Estimation: Comparative Statement finalize করা
 *
 * সব role (admin + member) করতে পারবে:
 *   - নিজের estimate/BOQ তৈরি ও এডিট করা
 *   - Hub থেকে ডেটা import করা
 *   - Report দেখা ও export করা
 */
export function canApproveFinancials(role: UserRole): boolean {
  return role === 'admin'
}
