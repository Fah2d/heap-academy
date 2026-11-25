// The routes that serve the platform rather than a learner: the health check
// and the content security policy report endpoint (docs/spec/02-architecture.md
// section 9.2), and the nonce the page hands to React Aria's own style.
export { CspNonceMeta } from "./components/csp-nonce-meta";
export { handleCspReport } from "./server/csp-report";
export { healthResponse } from "./server/health";
