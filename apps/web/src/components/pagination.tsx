import Link from "next/link";

type Props = {
  page: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
};

export const Pagination = ({ page, total, pageSize, searchParams }: Props) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 0) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-muted-foreground">
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} / {total}
      </p>
      <div className="flex gap-2">
        {page > 0 && (
          <Link href={buildHref(page - 1)}
            className="px-3 py-1.5 rounded-md text-sm bg-muted hover:bg-accent transition-colors">
            ←
          </Link>
        )}
        {page + 1 < totalPages && (
          <Link href={buildHref(page + 1)}
            className="px-3 py-1.5 rounded-md text-sm bg-muted hover:bg-accent transition-colors">
            →
          </Link>
        )}
      </div>
    </div>
  );
};
