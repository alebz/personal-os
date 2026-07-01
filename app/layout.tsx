import type { Metadata } from "next";
import { unstable_ViewTransition as ViewTransition } from "react";
import "./globals.css";
import { StarsBackground } from "@/components/StarsBackground";

export const metadata: Metadata = {
  title: "personal-os",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="bg-ink-0 text-ink-4 antialiased">
        <StarsBackground />
        <ViewTransition>{children}</ViewTransition>
      </body>
    </html>
  );
}
