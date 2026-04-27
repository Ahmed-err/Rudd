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
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ tenantId }, t, { status }] = await Promise.all([
    getSessionTenant(),
    getT(),
    searchParams,
  ]);

  const activeFilter = FILTERS.includes(status as typeof FILTERS[number]) ? status : "all";
  const conversations = await listConversations(tenantId, activeFilter === "all" ? undefined : activeFilter);

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    resolved: "bg-gray-100 text-gray-800",
    escalated: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      <AutoRefresh intervalMs={10000} />
      <h1 className="text-2xl font-semibold">{t.conversations.title}</h1>

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
          {conversations.map((c) => (
            <Link key={c.id} href={`/dashboard/conversations/${c.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {c.contactName ?? c.contactWaId}
                    </CardTitle>
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
          ))}
        </div>
      )}
    </div>
  );
}
