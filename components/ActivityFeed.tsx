"use client";

import { Activity, AlertCircle, TrendingUp, Cpu } from "lucide-react";

const TYPE_CONFIG: Record<string, { color: string; icon: any }> = {
  TRADE:  { color: 'text-green-400',  icon: TrendingUp },
  ERROR:  { color: 'text-red-400',    icon: AlertCircle },
  SCAN:   { color: 'text-blue-400',   icon: Activity },
  SYSTEM: { color: 'text-zinc-400',   icon: Cpu },
};

export function ActivityFeed({ logs }: { logs: any[] }) {
  return (
    <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
      {logs.length === 0 && (
        <p className="text-zinc-600 text-xs text-center py-4">Belum ada aktivitas</p>
      )}
      {logs.map((log: any) => {
        const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.SYSTEM;
        const Icon = cfg.icon;
        const time = new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return (
          <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0">
            <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${cfg.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-zinc-300 leading-snug truncate">{log.message}</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">{time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
