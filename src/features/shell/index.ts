// The page frame every route shares: fonts, the skip link and header, the
// not-found and error pages, the development-only primitive gallery and
// browser error trigger, and the reporter that sends a browser error to
// /api/client-error, which the workspace gives the runtime.
export { reportClientError } from "./client/report-client-error";
export { BrowserErrorTrigger } from "./components/browser-error-trigger";
export { ErrorView, errorReference } from "./components/error-view";
export { NotFoundView } from "./components/not-found-view";
export { PrimitiveGallery } from "./components/primitive-gallery";
export { SiteShell } from "./components/site-shell";
export { fontVariables } from "./fonts";
