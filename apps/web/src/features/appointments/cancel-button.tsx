"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelAppointment } from "./actions";

type Props = { appointmentId: string; label: string; cancellingLabel: string };

export const CancelButton = ({ appointmentId, label, cancellingLabel }: Props) => {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() => startTransition(() => cancelAppointment(appointmentId))}
      className="text-destructive hover:text-destructive text-xs h-7 px-2"
    >
      {isPending ? cancellingLabel : label}
    </Button>
  );
};
