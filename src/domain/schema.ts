import { z } from "zod";

// Zod compiles object schemas with `new Function` when it may, and probes for
// that by trying. The script policy has no 'unsafe-eval' (NFR-SEC-02), so in a
// browser the probe is refused and reported as a violation even though Zod
// catches it. jitless turns the probe and the compiler off. Schemas a browser
// can load import z from here, so the setting comes before the first schema.
z.config({ jitless: true });

export { z };
