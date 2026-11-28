import type { ReactElement } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const BrandLogo = ({ name, className }: { name: string; className?: string }): ReactElement => (
  <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
      <MessageCircle className="size-4.5" strokeWidth={2.25} aria-hidden />
    </span>
    <span className="text-lg">{name}</span>
  </span>
);
