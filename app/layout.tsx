import type { Metadata } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { localeFromRequest } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Babel",
  description: "An AI layer that reshapes a store's pages for how each shopper reads the web.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The visitor's language is decided on the server from the cookies and the request's country
  // headers, so the very first paint is already in that language (no English flash).
  const locale = await localeFromRequest();
  return (
    <html lang={locale.lang}>
      <body>
        <I18nProvider info={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
