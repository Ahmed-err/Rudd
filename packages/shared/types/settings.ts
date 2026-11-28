import { z } from "zod";

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");

export const dayScheduleSchema = z
  .object({ enabled: z.boolean(), open: hhmm, close: hhmm })
  .refine((d) => !d.enabled || d.open < d.close, { message: "Opening time must be before closing time" });
export type DaySchedule = z.infer<typeof dayScheduleSchema>;

export const workingHoursSchema = z.object({
  mon: dayScheduleSchema,
  tue: dayScheduleSchema,
  wed: dayScheduleSchema,
  thu: dayScheduleSchema,
  fri: dayScheduleSchema,
  sat: dayScheduleSchema,
  sun: dayScheduleSchema,
});
export type WorkingHours = z.infer<typeof workingHoursSchema>;

const weekday: DaySchedule = { enabled: true, open: "09:00", close: "17:00" };
const weekend: DaySchedule = { enabled: false, open: "09:00", close: "17:00" };

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: weekday,
  tue: weekday,
  wed: weekday,
  thu: weekday,
  fri: weekday,
  sat: weekend,
  sun: weekend,
};

// Older rows hold other shapes (e.g. { Mon: "9am-5pm" }); anything invalid falls back to defaults.
export const parseWorkingHours = (raw: unknown): WorkingHours => {
  if (!raw || typeof raw !== "object") return DEFAULT_WORKING_HOURS;
  const obj = raw as Record<string, unknown>;
  const result = { ...DEFAULT_WORKING_HOURS };
  for (const day of DAY_KEYS) {
    const parsed = dayScheduleSchema.safeParse(obj[day]);
    if (parsed.success) result[day] = parsed.data;
  }
  return result;
};

export const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive().max(24 * 60),
});
export type Service = z.infer<typeof serviceSchema>;

export const parseServices = (raw: unknown): Service[] => {
  const parsed = z.array(serviceSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
};

export const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const timezoneSchema = z.string().min(1).refine(isValidTimezone, { message: "Unknown IANA timezone" });
