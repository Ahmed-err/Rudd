import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { getConversationDetail } from "@/features/conversations/queries";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ tenantId }, t] = await Promise.all([getSessionTenant(), getT()]);

  const detail = await getConversationDetail(tenantId, id);
  if (!detail) notFound();

  const { conversation, messages } = detail;

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    resolved: "bg-gray-100 text-gray-800",
    escalated: "bg-red-100 text-red-800",
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b shrink-0">
        <Link
          href="/dashboard/conversations"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t.conversations.detail.back}
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">
            {conversation.contactName ?? conversation.contactWaId}
          </p>
          <p className="text-xs text-muted-foreground">{conversation.contactWaId}</p>
        </div>
        <Badge
          className={statusColor[conversation.status] ?? "bg-gray-100 text-gray-800"}
          variant="outline"
        >
          {t.conversations.status[conversation.status as keyof typeof t.conversations.status] ?? conversation.status}
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            {t.conversations.detail.noMessages}
          </p>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === "outbound";
            return (
              <div
                key={msg.id}
                className={cn("flex", isOutbound ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                    isOutbound
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm",
                  )}
                >
                  {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                  <p
                    className={cn(
                      "text-[10px] mt-1",
                      isOutbound ? "text-primary-foreground/60 text-end" : "text-muted-foreground",
                    )}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString(t.locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
