// The routes that serve the platform rather than a learner: the health check
// and the two report endpoints, for content security policy violations and
// for browser errors (docs/spec/02-architecture.md section 9.2).
export { handleClientError } from "./server/client-error";
export { handleCspReport } from "./server/csp-report";
export { healthResponse } from "./server/health";
