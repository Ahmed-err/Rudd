import "server-only";
import { cookies } from "next/headers";
import { translations, type Locale, type T } from "./translations";

export const LOCALE_COOKIE = "rudd_locale";

export const getLocale = async (): Promise<Locale> => {
  const store = await cookies();
  const val = store.get(LOCALE_COOKIE)?.value;
  return val === "ar" ? "ar" : "en";
};

export const getT = async (): Promise<T> => {
  const locale = await getLocale();
  return translations[locale] as T;
};
