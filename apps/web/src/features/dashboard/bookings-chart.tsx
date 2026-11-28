import type { ReactElement } from "react";

type Props = {
  data: Array<{ date: string; count: number }>;
  locale: string;
  title: string;
  totalLabel: string;
  barLabel: string;
};

const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

export const BookingsChart = ({ data, locale, title, totalLabel, barLabel }: Props): ReactElement => {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const label = (date: string, style: "short" | "long") =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
      timeZone: "UTC",
      ...(style === "short" ? { day: "numeric" } : { weekday: "short", day: "numeric", month: "short" }),
    });

  return (
    <figure className="rounded-xl border bg-card p-5 shadow-xs">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{fill(totalLabel, { n: total })}</span>
      </figcaption>

      <div className="mt-5 flex h-36 items-end gap-0.5 border-b border-border" aria-hidden>
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end px-px">
            <div
              className="w-full rounded-t-[4px] bg-chart-1 transition-opacity group-hover:opacity-80"
              style={{ height: d.count ? `${Math.max(4, (d.count / max) * 100)}%` : "2px", opacity: d.count ? 1 : 0.25 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow group-hover:block">
              {fill(barLabel, { n: d.count, date: label(d.date, "long") })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        <span>{data[0] ? label(data[0].date, "long") : ""}</span>
        <span>{data.at(-1) ? label(data.at(-1)?.date ?? "", "long") : ""}</span>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{label(d.date, "long")}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};
