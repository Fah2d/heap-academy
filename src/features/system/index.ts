// The routes that serve the platform rather than a learner: the health check
// and the content security policy report endpoint (docs/spec/02-architecture.md
// section 9.2).
export { handleCspReport } from "./server/csp-report";
export { healthResponse } from "./server/health";
