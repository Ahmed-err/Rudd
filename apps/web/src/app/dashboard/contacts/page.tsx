import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { getSessionTenant } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { listContacts, countContacts, CONTACTS_PAGE_SIZE } from "@/features/contacts/queries";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const leadStatusColor: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  qualified: "bg-green-100 text-green-800",
  unqualified: "bg-gray-100 text-gray-800",
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ tenantId }, t, { page: pageParam }] = await Promise.all([
    getSessionTenant(),
    getT(),
    searchParams,
  ]);
  const page = Math.max(0, Number(pageParam ?? 0));
  const [contacts, total] = await Promise.all([
    listContacts(tenantId, page),
    countContacts(tenantId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t.contacts.title} description={t.contacts.subtitle} />

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">{t.contacts.empty}</p>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <Table className="min-w-[44rem] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">{t.contacts.columns.name}</TableHead>
                <TableHead className="w-36">{t.contacts.columns.phone}</TableHead>
                <TableHead className="w-32">{t.contacts.columns.status}</TableHead>
                <TableHead className="w-28">{t.contacts.columns.conversations}</TableHead>
                <TableHead className="w-40">{t.contacts.columns.lastSeen}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium truncate">{c.name ?? "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums" dir="ltr">+{c.waId}</TableCell>
                  <TableCell>
                    <Badge
                      className={leadStatusColor[c.leadStatus] ?? "bg-gray-100 text-gray-800"}
                      variant="outline"
                    >
                      {c.leadStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{c.conversationCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.lastSeen ? new Date(c.lastSeen).toLocaleDateString(t.locale) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/conversations?waId=${encodeURIComponent(c.waId)}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        {t.contacts.viewConversations}
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination page={page} total={total} pageSize={CONTACTS_PAGE_SIZE} searchParams={{}} />
        </>
      )}
    </div>
  );
}
