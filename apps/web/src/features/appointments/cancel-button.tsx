"use client";

import { useTransition, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { cancelAppointment } from "./actions";

type Props = {
  appointmentId: string;
  label: string;
  cancellingLabel: string;
  confirmLabel: string;
  notNotifiedLabel: string;
};

export const CancelButton = ({
  appointmentId,
  label,
  cancellingLabel,
  confirmLabel,
  notNotifiedLabel,
}: Props): ReactElement => {
  const [isPending, startTransition] = useTransition();

  const onClick = (): void => {
    if (!window.confirm(confirmLabel)) return;
    startTransition(async () => {
      const { notified } = await cancelAppointment(appointmentId);
      if (!notified) window.alert(notNotifiedLabel);
    });
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={onClick}
      className="text-destructive hover:text-destructive text-xs h-7 px-2"
    >
      {isPending ? cancellingLabel : label}
    </Button>
  );
};
