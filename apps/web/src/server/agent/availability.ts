import type { DayKey, WorkingHours } from "@rudd/shared";

export type Interval = { start: Date; end: Date };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

type LocalParts = { date: string; time: string; weekday: DayKey; offsetMinutes: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
};

const WEEKDAY: Record<string, DayKey> = {
  Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun",
};

export const toLocalParts = (instant: Date, timeZone: string): LocalParts => {
  const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  const offsetMinutes = Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / MINUTE);
  return { date, time, weekday: WEEKDAY[parts.weekday ?? ""] ?? "mon", offsetMinutes };
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Wall-clock date + time in `timeZone` → UTC instant. Handles DST by re-checking the offset. */
export const zonedToUtc = (date: string, time: string, timeZone: string): Date => {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) throw new Error(`Invalid local date/time: ${date} ${time}`);
  const naive = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]), Number(t[3] ?? 0));
  let guess = naive - toLocalParts(new Date(naive), timeZone).offsetMinutes * MINUTE;
  guess = naive - toLocalParts(new Date(guess), timeZone).offsetMinutes * MINUTE;
  return new Date(guess);
};

const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Accepts full ISO with offset, or a bare local "YYYY-MM-DDTHH:MM[:SS]" interpreted in `timeZone`. */
export const parseDateTime = (input: string, timeZone: string): Date | null => {
  const trimmed = input.trim();
  if (OFFSET_RE.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [date, time] = trimmed.split(/[T ]/);
  if (!date || !time) return null;
  try {
    return zonedToUtc(date, time.slice(0, 8), timeZone);
  } catch {
    return null;
  }
};

const pad = (n: number): string => String(Math.abs(n)).padStart(2, "0");

/** e.g. "2026-11-28T10:00:00+02:00" — unambiguous and readable by the model. */
export const formatLocalIso = (instant: Date, timeZone: string): string => {
  const { date, time, offsetMinutes } = toLocalParts(instant, timeZone);
  const sign = offsetMinutes < 0 ? "-" : "+";
  return `${date}T${time}:00${sign}${pad(Math.trunc(offsetMinutes / 60))}:${pad(offsetMinutes % 60)}`;
};

export const addDays = (date: string, days: number): string => {
  const d = DATE_RE.exec(date);
  if (!d) throw new Error(`Invalid date: ${date}`);
  return new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])) + days * DAY).toISOString().slice(0, 10);
};

export const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

export const isWithinWorkingHours = (slot: Interval, hours: WorkingHours, timeZone: string): boolean => {
  const start = toLocalParts(slot.start, timeZone);
  const day = hours[start.weekday];
  if (!day.enabled) return false;
  const open = zonedToUtc(start.date, day.open, timeZone);
  const close = zonedToUtc(start.date, day.close, timeZone);
  return slot.start >= open && slot.end <= close;
};

export type SlotQuery = {
  workingHours: WorkingHours;
  timeZone: string;
  dateFrom: string;
  dateTo: string;
  durationMinutes: number;
  busy: Interval[];
  now: Date;
  count: number;
  stepMinutes?: number;
  minNoticeMinutes?: number;
  maxPerDay?: number;
};

export const MAX_RANGE_DAYS = 14;

export const generateSlots = (q: SlotQuery): Interval[] => {
  const step = (q.stepMinutes ?? 30) * MINUTE;
  const duration = q.durationMinutes * MINUTE;
  const earliest = new Date(q.now.getTime() + (q.minNoticeMinutes ?? 60) * MINUTE);
  const maxPerDay = q.maxPerDay ?? 2;
  const lastDate = q.dateTo < addDays(q.dateFrom, MAX_RANGE_DAYS - 1) ? q.dateTo : addDays(q.dateFrom, MAX_RANGE_DAYS - 1);

  const slots: Interval[] = [];
  for (let date = q.dateFrom; date <= lastDate && slots.length < q.count; date = addDays(date, 1)) {
    const weekday = toLocalParts(zonedToUtc(date, "12:00", q.timeZone), q.timeZone).weekday;
    const day = q.workingHours[weekday];
    if (!day.enabled) continue;

    const open = zonedToUtc(date, day.open, q.timeZone).getTime();
    const close = zonedToUtc(date, day.close, q.timeZone).getTime();
    let perDay = 0;
    for (let t = open; t + duration <= close && perDay < maxPerDay && slots.length < q.count; t += step) {
      const slot = { start: new Date(t), end: new Date(t + duration) };
      if (slot.start < earliest) continue;
      if (q.busy.some((b) => overlaps(slot, b))) continue;
      slots.push(slot);
      perDay++;
      // Spread same-day options out instead of offering 9:00 and 9:30.
      t += Math.max(0, 2 * 60 * MINUTE - step);
    }
  }
  return slots;
};
