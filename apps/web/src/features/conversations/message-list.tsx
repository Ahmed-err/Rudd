"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { MessageRow } from "./queries";
import type { T } from "@/lib/i18n/translations";

type Props = {
  messages: MessageRow[];
  t: T["conversations"]["detail"];
  locale: string;
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const formatDateLabel = (dateKey: string, t: T["conversations"]["detail"], locale: string): string => {
  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - 86400000));
  if (dateKey === today) return t.today;
  if (dateKey === yesterday) return t.yesterday;
  return new Date(dateKey).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
};

export const MessageList = ({ messages, t, locale }: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every message update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        {t.noMessages}
      </p>
    );
  }

  let lastDateKey = "";

  return (
    <>
      {messages.map((msg) => {
        const isOutbound = msg.direction === "outbound";
        const dateKey = toDateKey(new Date(msg.createdAt));
        const showDateSep = dateKey !== lastDateKey;
        lastDateKey = dateKey;

        return (
          <div key={msg.id}>
            {showDateSep && (
              <div className="my-4 flex justify-center">
                <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-xs">
                  {formatDateLabel(dateKey, t, locale)}
                </span>
              </div>
            )}
            <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-xs",
                  isOutbound
                    ? "rounded-se-sm bg-[oklch(0.93_0.055_155)] text-foreground"
                    : "rounded-ss-sm bg-card",
                )}
              >
                {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                <p
                  className={cn(
                    "mt-1 text-end text-[10px] tabular-nums text-muted-foreground",
                  )}
                >
                  {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </>
  );
};
