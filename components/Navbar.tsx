"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, BarChart3, Settings, Zap, LineChart } from "lucide-react";

const NAV = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/portfolio",  label: "Portfolio",  icon: LineChart },
  { href: "/history",    label: "History",    icon: History },
  { href: "/analytics",  label: "Analytics",  icon: BarChart3 },
  { href: "/settings",   label: "Settings",   icon: Settings },
];

export function Navbar() {
  const path = usePathname();
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-12">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-400" />
          <span className="font-black text-sm uppercase tracking-widest">Alpha Omega</span>
        </div>
        <div className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${
                path === href
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
