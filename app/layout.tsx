import type { Metadata } from "next";
import * as React from "react";
import "./globals.css";

// Mono toggle typeface = SF Mono, self-hosted via @font-face in globals.css
// (loaded from /public/SF-Mono). No next/font import needed — the family
// 'SF Mono' is referenced directly in the mono stack (inline script below + OSSettingsContext).
import { OSSettingsProvider } from "@/components/OSSettingsContext";
import ArcadeChrome from "@/components/ArcadeChrome";

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
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Press+Start+2P&family=Silkscreen:wght@400;700&family=VT323&display=swap" />
        {/* Apply saved font before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('os-settings');if(s){var f={system:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",mono:"'SF Mono',ui-monospace,Menlo,monospace"};var font=f[JSON.parse(s).font]||f.system;document.documentElement.style.setProperty('--os-font',font);}}catch(e){}})();` }} />
        {/* Apply saved CRT state before first paint — recuerda los settings al refrescar, sin flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('os-settings');var c=s?JSON.parse(s).crt:null;var D={on:true,color:'multi',phosphor:'#EA4335',scan:0.11,dots:0.2,vig:0,bloom:0,glow:0.1,aberr:0.6};c=Object.assign({},D,c||{});var e=document.documentElement,st=e.style;e.setAttribute('data-crt',c.on?'on':'off');e.setAttribute('data-crt-color',c.color);st.setProperty('--crt-text',c.phosphor);st.setProperty('--crt-scan-a',''+c.scan);st.setProperty('--crt-dots-o',''+c.dots);st.setProperty('--crt-vig-a',''+c.vig);st.setProperty('--crt-bloom-o',''+c.bloom);st.setProperty('--crt-glow-a',''+c.glow);st.setProperty('--crt-glow-blur',(c.glow*11).toFixed(2)+'px');st.setProperty('--crt-aberr',''+c.aberr);}catch(e){}})();` }} />
      </head>
      <body className="bg-surface-base text-fg antialiased">
        <OSSettingsProvider>
          {/* Chrome del cascarón arcade (sim + Lolo + CRT) — se monta SOLO bajo shell='arcade'. */}
          <ArcadeChrome />
          {/* Content sits above the cosmic sim (which is fixed at z:0); this baseline
              keeps every card, sub-menu and button in front of the ships. The
              .crt-screen wrapper is where the CRT warp filter (fisheye/aberration/
              deform) and the mono-phosphor token remap apply. */}
          <div className="crt-screen" style={{ position: 'relative', zIndex: 1 }}>
            <ViewTransition>{children}</ViewTransition>
          </div>
        </OSSettingsProvider>
      </body>
    </html>
  );
}
