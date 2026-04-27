import Link from "next/link";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listConversations } from "@/features/conversations/queries";
import { AutoRefresh } from "@/features/conversations/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConversationsPage() {
  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);
  const conversations = await listConversations(tenantId);

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    resolved: "bg-gray-100 text-gray-800",
    escalated: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      <AutoRefresh intervalMs={10000} />
      <h1 className="text-2xl font-semibold">{t.conversations.title}</h1>

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
