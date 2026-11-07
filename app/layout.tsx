import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./skins.css"; // after globals.css: a skin wins over the dialect's card styling

export const metadata: Metadata = {
  title: "Babel",
  description: "An AI layer that lays out a store's next pages for how each shopper reads the web. Same products, same prices.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
