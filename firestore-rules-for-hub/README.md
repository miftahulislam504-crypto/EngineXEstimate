# Firestore Rules আপডেট — Hub-এ কীভাবে বসাবেন

## কী পরিবর্তন হলো

`firestore.rules`-এ এই পরিবর্তনগুলো যোগ হয়েছে, বাকি সব Hub-এর মূল
rules-এর সাথে অপরিবর্তিত:

1. `isEstimatingAdmin()` নামে একটা helper function — `users/{uid}`
   document পড়ে `estimatingRole == 'admin'` কিনা চেক করে।
2. `projects/{projectId}` block-এর ভেতরে দুইটা নতুন subcollection rule:
   - `budgetApproval/{docId}` — write করতে admin লাগবে
   - `tenderFinalize/{docId}` — write করতে admin লাগবে
3. তিনটা top-level collection rule (Module 4/5/6/9-এর জন্য):
   - `materials/{materialId}` — যেকোনো signed-in user read/write করতে
     পারবে (rate update-এ admin-restriction নেই, শুধু Budget/Tender
     approval-এই সেটা প্রযোজ্য)। priceHistory subcollection নিচের
     wildcard দিয়ে কভার হয়।
   - `suppliers/{supplierId}` — Module 9 (Vendor Management)-এ বাস্তবায়িত (`lib/firestore/supplier.firestore.ts`)।
   - `resourceRates/{rateId}` — Module 4 (Rate Analysis)-এর Labour ও
     Equipment rate, materials-এর একই pattern (rateHistory
     subcollection সহ)।

## কেন wildcard rule-টা edit করতে হলো

Hub-এর আগের rules-এ `projects/{projectId}` ব্লকের নিচে একটা catch-all
`match /{document=**}` ছিল যেটা যেকোনো signed-in user-কে সব
subcollection-এ read/write দিয়ে দিত। Firestore rules-এ একাধিক match
ব্লক মিললে **সবগুলোর OR নেওয়া হয়** — বেশি নির্দিষ্ট rule বেশি
অগ্রাধিকার পায় না। তাই শুধু পাশে নতুন rule বসালে সেটা কোনো কাজে আসতো
না; catch-all ব্লক থেকে এই দুইটা পাথকে explicitly বাদ দিতে হয়েছে।

## ⚠️ গুরুত্বপূর্ণ — Module 10 ও 12 বানানোর সময় মনে রাখতে হবে

এই rules **path name অনুমান করে** বানানো হয়েছে, কারণ Module 10
(Budget Planning) ও Module 12 (Tender Estimation) এখনো তৈরি হয়নি।
যখন সেগুলো বানাবেন:

- Approved Cost সংরক্ষণের Firestore path **অবশ্যই**
  `projects/{projectId}/budgetApproval/{docId}` হতে হবে
- Tender Comparative Statement finalize করার path **অবশ্যই**
  `projects/{projectId}/tenderFinalize/{docId}` হতে হবে

যদি Module 10/12 ডিজাইন করার সময় অন্য path/collection নাম বেছে নেন
(যেমন `projects/{projectId}/budget/{docId}`), তাহলে এই rules কোনো
protection দেবে না — catch-all ব্লকই সেটা কভার করবে, কারণ Firestore
rules exact path string মেলায়, document-এর "অর্থ" বোঝে না। সেক্ষেত্রে
rules-টাও একইসাথে আপডেট করতে হবে।

## কীভাবে Apply করবেন

Hub-এর নিজের `DEPLOYMENT.md`-এ বর্ণিত পদ্ধতি অনুযায়ী:

1. Firebase Console খুলুন → আপনার shared project
2. Firestore Database → Rules ট্যাব
3. এই ফোল্ডারের `firestore.rules` ফাইলের সম্পূর্ণ content কপি করুন
4. Console-এর rules editor-এ পুরনো rules সম্পূর্ণ replace করে paste করুন
5. Publish চাপুন

## ⚠️ দ্বিতীয় সতর্কতা — Hub পুনরায় deploy করলে

এই rules ফাইলটা এখন **দুইটা জায়গায়** বাস করে: Hub-এর নিজের কোডবেসে
(যদি Hub-এর repo-তে rules ফাইল version-controlled থাকে), আর এখানে।
যদি ভবিষ্যতে Hub-এর rules নতুন কোনো কারণে আবার edit ও deploy করা হয়
Hub-এর মূল ফাইল থেকে, এই admin-only অংশটা হারিয়ে যাবে যদি না Hub-এর
নিজের rules ফাইলেও এই একই পরিবর্তন প্রতিফলিত করা হয়। সবচেয়ে নিরাপদ
হলো Hub-এর repo-তেই এই আপডেটেড rules ফাইলটা commit করে রাখা, যাতে এটা
single source of truth হয়ে থাকে।

## যাচাই করার উপায়

Rules deploy করার পর, Firebase Console-এর Rules Playground-এ পরীক্ষা
করতে পারেন:

- একটা `users/{testUid}` document বানান `estimatingRole: 'member'` দিয়ে
- `projects/{anyId}/budgetApproval/test` পাথে write simulate করুন সেই
  uid দিয়ে → **Deny** হওয়া উচিত
- `estimatingRole` কে `'admin'` করে আবার চেষ্টা করুন → **Allow** হওয়া
  উচিত
