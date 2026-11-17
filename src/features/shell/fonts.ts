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
// preloaded. Next.js generates metric fallbacks for Arial and Times New Roman
// only, so the mono fallbacks are declared in src/ui/tokens/font-fallbacks.css
// and come first in the stack, ahead of the unmatched system monospace.
// Android has none of the matched fonts, so it still swaps from its own
// monospace (see that file).
//
// The WOFF2 files are byte-for-byte the @fontsource/ibm-plex-sans and
// @fontsource/ibm-plex-mono files of the version in package.json, which are
// development dependencies for that reason only (a test compares them).
export const plexMono = localFont({
  src: [
    { path: "../../ui/fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../ui/fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["plex-mono-fallback-menlo", "plex-mono-fallback-courier", "ui-monospace", "monospace"],
});

/** The class names that declare both font variables on the document. */
export const fontVariables = `${plexSans.variable} ${plexMono.variable}`;
