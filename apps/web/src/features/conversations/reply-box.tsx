"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { sendManualReply } from "./reply-actions";

type Props = {
  conversationId: string;
  status: string;
  placeholder: string;
  sendLabel: string;
  sendingLabel: string;
  resolvedNote: string;
};

export const ReplyBox = ({ conversationId, status, placeholder, sendLabel, sendingLabel, resolvedNote }: Props) => {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    if (!body.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await sendManualReply(conversationId, body);
        setBody("");
        textareaRef.current?.focus();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send");
      }
    });
  };

  if (status === "resolved") {
    return (
      <div className="border-t pt-3 shrink-0">
        <p className="text-xs text-muted-foreground text-center py-2">{resolvedNote}</p>
      </div>
    );
  }

  return (
    <div className="border-t pt-3 shrink-0 space-y-2">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          rows={2}
          className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" onClick={send} disabled={isPending || !body.trim()}>
          {isPending ? sendingLabel : sendLabel}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Enter to send · Shift+Enter for new line</p>
    </div>
  );
};
