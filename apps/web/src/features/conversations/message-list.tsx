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
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatDateLabel(dateKey, t, locale)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
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
