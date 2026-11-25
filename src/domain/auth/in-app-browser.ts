// Google refuses sign-in inside the browsers that apps embed (E-10), so the
// sign-in view leads with the email code there (FR-AUTH-03). This is the one
// place the product reads the user agent (NFR-COMPAT-04): there is no
// capability to detect, only a policy on Google's side.

export type InAppBrowser =
  | "tiktok"
  | "instagram"
  | "facebook"
  | "messenger"
  | "snapchat"
  | "linkedin"
  | "line"
  | "wechat"
  | "android-webview";

// Most specific first: Messenger and Instagram also carry Facebook's tokens.
const MARKERS: readonly (readonly [InAppBrowser, RegExp])[] = [
  ["tiktok", /musical_ly|BytedanceWebview|\bTikTok\b|\btrill_\d/],
  ["instagram", /\bInstagram\b/],
  ["messenger", /\bFB_IAB\/MESSENGER\b|\bMessengerForiOS\b|\bFBAN\/Messenger\b/],
  ["facebook", /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b/],
  ["snapchat", /\bSnapchat\b/],
  ["linkedin", /\bLinkedInApp\b/],
  ["line", /\bLine\/\d/],
  ["wechat", /\bMicroMessenger\//],
  // An Android WebView marks itself with "; wv)" in the platform part.
  ["android-webview", /\bAndroid\b[^)]*;\s?wv\)/],
];

/** The in-app browser this user agent names, or null for an ordinary browser. */
export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  if (!userAgent) return null;
  for (const [name, pattern] of MARKERS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}
