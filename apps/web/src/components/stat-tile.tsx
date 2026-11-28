import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = { label: string; value: number | string; icon: ReactNode; tone?: "default" | "warning" };

export const StatTile = ({ label, value, icon, tone = "default" }: Props): ReactElement => (
  <div className="rounded-xl border bg-card p-4 shadow-xs">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-accent text-accent-foreground",
        )}
        aria-hidden
      >
        {icon}
      </span>
    </div>
    <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
  </div>
);
