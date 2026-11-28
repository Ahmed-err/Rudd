import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { getConversationDetail } from "@/features/conversations/queries";
import { StatusActions } from "@/features/conversations/status-actions";
import { ReplyBox } from "@/features/conversations/reply-box";
import { AutoRefresh } from "@/features/conversations/auto-refresh";
import { MessageList } from "@/features/conversations/message-list";
import { StatusBadge } from "@/components/status-badge";

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

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-3xl flex-col overflow-hidden rounded-xl border bg-card shadow-xs md:h-[calc(100dvh-4rem)]">
      <AutoRefresh intervalMs={5000} />
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
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
          <p className="text-xs text-muted-foreground" dir="ltr">+{conversation.contactWaId}</p>
        </div>
        <StatusBadge
          status={conversation.status}
          label={t.conversations.status[conversation.status as keyof typeof t.conversations.status] ?? conversation.status}
        />
        <StatusActions
          conversationId={conversation.id}
          status={conversation.status}
          aiPaused={conversation.aiPaused}
          t={t.conversations.detail}
        />
      </div>

      {conversation.aiPaused && conversation.status !== "resolved" && (
        <div className="shrink-0 border-b bg-sky-50 px-4 py-2 text-sm text-sky-900">
          {t.conversations.detail.aiPausedNote}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-[oklch(0.965_0.01_120)] px-4 py-4">
        <MessageList messages={messages} t={t.conversations.detail} locale={t.locale} />
      </div>

      {/* Reply box */}
      <ReplyBox
        conversationId={conversation.id}
        status={conversation.status}
        placeholder={t.conversations.detail.replyPlaceholder}
        sendLabel={t.conversations.detail.send}
        sendingLabel={t.conversations.detail.sending}
        resolvedNote={t.conversations.detail.resolvedNote}
      />
    </div>
  );
}
