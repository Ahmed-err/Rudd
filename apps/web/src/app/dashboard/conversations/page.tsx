import Link from "next/link";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listConversations } from "@/features/conversations/queries";
import { AutoRefresh } from "@/features/conversations/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "active", "escalated", "resolved"] as const;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; waId?: string }>;
}) {
  const [{ tenantId }, t, { status, waId }] = await Promise.all([
    getSessionTenant(),
    getT(),
    searchParams,
  ]);

  const activeFilter = FILTERS.includes(status as typeof FILTERS[number]) ? status : "all";
  const conversations = await listConversations(
    tenantId,
    activeFilter === "all" ? undefined : activeFilter,
    waId,
  );

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    resolved: "bg-gray-100 text-gray-800",
    escalated: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      <AutoRefresh intervalMs={10000} />
      <h1 className="text-2xl font-semibold">{t.conversations.title}</h1>

      {/* Contact filter banner */}
      {waId && (
        <div className="flex items-center gap-2 text-sm bg-muted px-3 py-2 rounded-md">
          <span className="text-muted-foreground">{t.conversations.filteringBy} <strong>{waId}</strong></span>
          <Link href="/dashboard/conversations" className="text-primary hover:underline text-xs">✕</Link>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/dashboard/conversations" : `/dashboard/conversations?status=${f}`}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              activeFilter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {t.conversations.filter[f as keyof typeof t.conversations.filter]}
          </Link>
        ))}
      </div>

      {conversations.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.conversations.empty}</p>
      ) : (
        <div className="grid gap-3">
          {conversations.map((c) => {
            const hasUnread = c.lastMessageDirection === "inbound";
            return (
            <Link key={c.id} href={`/dashboard/conversations/${c.id}`}>
              <Card className={cn("hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer", hasUnread && "border-primary/40 bg-primary/5")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {hasUnread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      <CardTitle className={cn("text-base truncate", hasUnread && "font-bold")}>
                        {c.contactName ?? c.contactWaId}
                      </CardTitle>
                    </div>
                    <Badge
                      className={statusColor[c.status] ?? "bg-gray-100 text-gray-800"}
                      variant="outline"
                    >
                      {t.conversations.status[c.status as keyof typeof t.conversations.status] ?? c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.contactWaId} ·{" "}
                    {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString(t.locale) : "—"}
                  </p>
                </CardHeader>
                {c.lastMessage && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-1">{c.lastMessage}</p>
                  </CardContent>
                )}
              </Card>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
