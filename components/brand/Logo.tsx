// components/brand/Logo.tsx
//
// EngineX Quanta-র ব্র্যান্ড মার্ক। আগে <Image src="/logo.png">
// ব্যবহার হচ্ছিল কিন্তু public/logo.png ফাইলটাই প্রজেক্টে ছিল না —
// ফলে সব জায়গায় লোগোর জায়গায় ভাঙা ইমেজ আইকন দেখাচ্ছিল। এখন থেকে
// inline SVG ব্যবহার করা হচ্ছে (কোনো external ফাইলের উপর নির্ভরতা
// নেই, তাই এই সমস্যা আর কখনো হবে না), আর একই কম্পোনেন্ট সব জায়গায়
// (login, project selector, project shell sidebar) পুনর্ব্যবহার
// করা হচ্ছে যাতে ব্র্যান্ডিং সব জায়গায় ঠিক এক থাকে।
//
// মার্কের ধারণা: "Q" (Quanta) — একটা কোয়ান্টাইজড/ধাপে-ধাপে রিং, যা
// এস্টিমেটিং/কোয়ান্টিটি টেকঅফের ধাপে-ধাপে হিসাবের সাথে ইঙ্গিতপূর্ণ,
// সাথে ভেতরে ছোট একটা bar-chart টিক (costing/BOQ-এর ইঙ্গিত)।

interface LogoProps {
  size?: number
  className?: string
}

export function LogoMark({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="EngineX Quanta"
    >
      <rect width="32" height="32" rx="9" fill="url(#exq-grad)" />
      {/* কোয়ান্টাইজড রিং — Q-এর বডি, ধাপে ধাপে আর্ক দিয়ে গঠিত */}
      <path
        d="M22.5 16a6.5 6.5 0 1 1-2.28-4.94"
        stroke="white"
        strokeWidth="2.25"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      />
      {/* Q-এর টেইল */}
      <path d="M19.3 19.1L23 22.8" stroke="white" strokeWidth="2.25" strokeLinecap="round" />
      {/* ভেতরে ছোট bar-chart টিক — costing/BOQ ইঙ্গিত */}
      <rect x="12.5" y="15" width="1.8" height="4.5" rx="0.9" fill="white" />
      <rect x="15.2" y="12.5" width="1.8" height="7" rx="0.9" fill="white" />
      <defs>
        <linearGradient id="exq-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4338CA" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** লোগো + নাম, একসাথে — topbar-গুলোতে ব্যবহারের জন্য */
export function LogoWithName({ size = 28, textClassName = '' }: { size?: number; textClassName?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`font-bold text-sm text-text-primary tracking-tight ${textClassName}`}>
        EngineX <span className="font-light text-text-secondary">Quanta</span>
      </span>
    </div>
  )
}
