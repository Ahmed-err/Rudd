import "server-only";
import { db, googleAccounts } from "@rudd/db";
import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "@/server/crypto";
import { env } from "@/lib/env";

// ── Token management ───────────────────────────────────────────────────────────

type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

const refreshAccessToken = async (refreshToken: string): Promise<string> => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.google.GOOGLE_CLIENT_ID,
      client_secret: env.google.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = (await res.json()) as TokenSet;
  return data.access_token;
};

const getAccessTokenForTenant = async (
  tenantId: string,
): Promise<{ accessToken: string; calendarId: string }> => {
  const [account] = await db
    .select({
      encryptedRefreshToken: googleAccounts.encryptedRefreshToken,
      calendarId: googleAccounts.calendarId,
    })
    .from(googleAccounts)
    .where(eq(googleAccounts.tenantId, tenantId))
    .limit(1);

  if (!account) throw new Error(`No Google account connected for tenant ${tenantId}`);

  const refreshToken = await decrypt(account.encryptedRefreshToken);
  const accessToken = await refreshAccessToken(refreshToken);

  return { accessToken, calendarId: account.calendarId };
};

// ── OAuth URL generation ───────────────────────────────────────────────────────

export const getAuthUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: env.google.GOOGLE_CLIENT_ID,
    redirect_uri: env.google.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

// ── Exchange code → store encrypted refresh token ──────────────────────────────

export const exchangeCodeAndStore = async (
  tenantId: string,
  code: string,
  calendarId = "primary",
): Promise<void> => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.google.GOOGLE_CLIENT_ID,
      client_secret: env.google.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.google.GOOGLE_REDIRECT_URI,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  const tokens = (await res.json()) as TokenSet;
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token");

  const encryptedRefreshToken = await encrypt(tokens.refresh_token);
  const scopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
  ];

  await db
    .insert(googleAccounts)
    .values({ tenantId, encryptedRefreshToken, calendarId, scopes })
    .onConflictDoUpdate({
      target: googleAccounts.tenantId,
      set: { encryptedRefreshToken, calendarId, scopes, updatedAt: new Date() },
    });
};

// ── Free/busy query ────────────────────────────────────────────────────────────

export type BusySlot = { start: string; end: string };

type FreeBusyResponse = {
  calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
};

export const getFreeBusy = async (
  tenantId: string,
  timeMin: string,
  timeMax: string,
): Promise<BusySlot[]> => {
  const { accessToken, calendarId } = await getAccessTokenForTenant(tenantId);

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });

  if (!res.ok) throw new Error(`FreeBusy query failed: ${await res.text()}`);

  const data = (await res.json()) as FreeBusyResponse;
  return (data.calendars[calendarId]?.busy ?? []).filter(
    (b): b is BusySlot => typeof b.start === "string" && typeof b.end === "string",
  );
};

// ── Create calendar event ──────────────────────────────────────────────────────

export type CreateEventInput = {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  timezone: string;
  attendeeEmail?: string;
};

type CalendarEvent = { id?: string };

export const createCalendarEvent = async (
  tenantId: string,
  input: CreateEventInput,
): Promise<string> => {
  const { accessToken, calendarId } = await getAccessTokenForTenant(tenantId);

  const body = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startIso, timeZone: input.timezone },
    end: { dateTime: input.endIso, timeZone: input.timezone },
    ...(input.attendeeEmail ? { attendees: [{ email: input.attendeeEmail }] } : {}),
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) throw new Error(`Create event failed: ${await res.text()}`);

  const event = (await res.json()) as CalendarEvent;
  if (!event.id) throw new Error("Google Calendar did not return an event ID");
  return event.id;
};

// ── Delete calendar event ──────────────────────────────────────────────────────

export const deleteCalendarEvent = async (
  tenantId: string,
  gcalEventId: string,
): Promise<void> => {
  const { accessToken, calendarId } = await getAccessTokenForTenant(tenantId);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(gcalEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok && res.status !== 410) {
    throw new Error(`Delete event failed: ${await res.text()}`);
  }
};
