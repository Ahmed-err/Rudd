"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { type Locale } from "./translations";
import { LOCALE_COOKIE } from "./server";

export const setLocale = async (locale: Locale): Promise<void> => {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
};
