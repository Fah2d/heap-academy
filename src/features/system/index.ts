// The routes that serve the platform rather than a learner: the health check
// and the two report endpoints, for content security policy violations and
// for browser errors (docs/spec/02-architecture.md section 9.2), and the nonce
// the page hands to React Aria's own style.
export { handleClientError } from "./server/client-error";
export { CspNonceMeta } from "./components/csp-nonce-meta";
export { handleCspReport } from "./server/csp-report";
export { healthResponse } from "./server/health";
