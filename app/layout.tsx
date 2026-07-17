import type { Metadata } from "next";
import * as React from "react";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted JetBrains Mono for the Mono toggle. Four weights cover the UI's real needs:
// 400 body · 500 medium (buttons) · 700 bold (headings/labels) · 800 backs font-black montos
// (JetBrains Mono tops out at 800, so `font-black`/900 renders as ExtraBold — the boldest that exists).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
import { StarsBackground } from "@/components/StarsBackground";
import { OSSettingsProvider } from "@/components/OSSettingsContext";
import LoloCompanionWrapper from "@/components/LoloCompanionWrapper";

// React 19.1's ViewTransition is runtime-only (not yet in @types/react), and stripped from some
// builds — so use it when present, else fall back to a no-op wrapper. Keeps the prod build/typecheck
// green and never renders `undefined`.
const ViewTransition: React.ComponentType<{ children?: React.ReactNode }> =
  (React as unknown as { unstable_ViewTransition?: React.ComponentType<{ children?: React.ReactNode }> }).unstable_ViewTransition
  ?? (React.Fragment as unknown as React.ComponentType<{ children?: React.ReactNode }>);

export const metadata: Metadata = {
  title: "Alex Mateo",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`dark ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Press+Start+2P&family=Silkscreen:wght@400;700&family=VT323&display=swap" />
        {/* Apply saved font before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('os-settings');if(s){var f={system:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",mono:"var(--font-jetbrains-mono),'JetBrains Mono','Fira Code',ui-monospace,monospace"};var font=f[JSON.parse(s).font]||f.system;document.documentElement.style.setProperty('--os-font',font);}}catch(e){}})();` }} />
      </head>
      <body className="bg-surface-base text-fg antialiased">
        <OSSettingsProvider>
          <StarsBackground />
          <LoloCompanionWrapper />
          {/* Content sits above the cosmic sim (which is fixed at z:0); this baseline
              keeps every card, sub-menu and button in front of the ships. */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <ViewTransition>{children}</ViewTransition>
          </div>
        </OSSettingsProvider>
      </body>
    </html>
  );
}
