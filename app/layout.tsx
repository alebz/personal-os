import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="bg-ink-0 text-ink-4 antialiased">{children}</body>
    </html>
  );
}
