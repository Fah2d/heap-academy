import localFont from "next/font/local";

// IBM Plex, self-hosted as Latin WOFF2 under the SIL Open Font License 1.1
// (DESIGN.md section 5, ADR-0031). The files and both licenses are in
// src/ui/fonts/. Only the weights in use ship.

// Every page opens on Sans, so it is preloaded. Next.js generates an Arial
// fallback with size-adjust, so the swap does not shift the layout.
export const plexSans = localFont({
  src: [
    { path: "../../ui/fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../ui/fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../ui/fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
});

// Mono appears only where code or a structural label does, so it is not
// preloaded. Next.js offers a metric fallback for Arial and Times New Roman
// only, so the mono fallback is not metric-matched (recorded in the WP-1.4
// pull request). Any monospace fallback still keeps code in columns.
export const plexMono = localFont({
  src: [
    { path: "../../ui/fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../ui/fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Menlo", "Consolas", "Courier New", "monospace"],
});

/** The class names that declare both font variables on the document. */
export const fontVariables = `${plexSans.variable} ${plexMono.variable}`;
