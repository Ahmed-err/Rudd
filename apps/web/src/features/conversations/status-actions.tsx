"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setConversationStatus } from "./actions";
import type { T } from "@/lib/i18n/translations";

type Props = {
  conversationId: string;
  status: string;
  t: T["conversations"]["detail"];
};

export const StatusActions = ({ conversationId, status, t }: Props) => {
  const [isPending, startTransition] = useTransition();

  const update = (next: "active" | "resolved" | "escalated") => {
    startTransition(async () => {
      await setConversationStatus(conversationId, next);
    });
  };

  return (
    <div className="flex gap-2">
      {status !== "resolved" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => update("resolved")}
          disabled={isPending}
          className="text-gray-700 border-gray-300 hover:bg-gray-50"
        >
          {isPending ? t.resolving : t.resolve}
        </Button>
      )}
      {status !== "escalated" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => update("escalated")}
          disabled={isPending}
          className="text-red-700 border-red-300 hover:bg-red-50"
        >
          {isPending ? t.escalating : t.escalate}
        </Button>
      )}
      {status !== "active" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => update("active")}
          disabled={isPending}
          className="text-green-700 border-green-300 hover:bg-green-50"
        >
          {isPending ? t.reopening : t.reopen}
        </Button>
      )}
    </div>
  );
};
