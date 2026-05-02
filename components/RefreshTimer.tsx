'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshTimer() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          router.refresh();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 backdrop-blur-md border border-white/5 rounded-full shadow-2xl">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
        Auto-Sync in {seconds}s
      </span>
    </div>
  );
}
