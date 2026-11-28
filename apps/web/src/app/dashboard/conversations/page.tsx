import Link from "next/link";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listConversations, countConversations, PAGE_SIZE } from "@/features/conversations/queries";
import { AutoRefresh } from "@/features/conversations/auto-refresh";
import { Pagination } from "@/components/pagination";
import { MessagesSquare, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "active", "escalated", "resolved"] as const;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; waId?: string; page?: string }>;
}) {
  const [{ tenantId }, t, { status, waId, page: pageParam }] = await Promise.all([
    getSessionTenant(),
    getT(),
    searchParams,
  ]);

  const activeFilter = FILTERS.includes(status as typeof FILTERS[number]) ? status : "all";
  const statusFilter = activeFilter === "all" ? undefined : activeFilter;
  const page = Math.max(0, Number(pageParam ?? 0));

  const [conversations, total] = await Promise.all([
    listConversations(tenantId, statusFilter, waId, page),
    countConversations(tenantId, statusFilter, waId),
  ]);

  const initials = (name: string | null) =>
    name?.trim() ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "#";

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={10000} />
      <PageHeader title={t.conversations.title} description={t.conversations.subtitle} />

      {waId && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {t.conversations.filteringBy} <strong dir="ltr">{waId}</strong>
          </span>
          <Link href="/dashboard/conversations" className="ms-auto rounded p-1 hover:bg-background" aria-label="Clear filter">
            <X className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}

      <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/dashboard/conversations" : `/dashboard/conversations?status=${f}`}
            aria-current={activeFilter === f ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeFilter === f ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.conversations.filter[f as keyof typeof t.conversations.filter]}
          </Link>
        ))}
      </div>

      {conversations.length === 0 && page === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <MessagesSquare className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">{t.conversations.empty}</p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {conversations.map((c) => {
            const hasUnread = c.lastMessageDirection === "inbound";
            return (
              <li key={c.id}>
                <Link
                  href={`/dashboard/conversations/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
                      hasUnread ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
                    )}
                    aria-hidden
                  >
                    {initials(c.contactName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("truncate text-sm", hasUnread ? "font-semibold" : "font-medium")}>
                        {c.contactName ?? <span dir="ltr">+{c.contactWaId}</span>}
                      </p>
                      {hasUnread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </div>
                    <p className={cn("truncate text-sm", hasUnread ? "text-foreground" : "text-muted-foreground")}>
                      {c.lastMessage ?? "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {c.lastMessageAt
                        ? new Date(c.lastMessageAt).toLocaleString(t.locale, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                    <StatusBadge
                      status={c.status}
                      label={t.conversations.status[c.status as keyof typeof t.conversations.status] ?? c.status}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        searchParams={{ status: activeFilter !== "all" ? activeFilter : undefined, waId }}
      />
    </div>
  );
}
