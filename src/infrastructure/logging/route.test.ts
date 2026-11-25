import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { actionLogRoute, logRoute, MAX_ROUTE_SEGMENTS, ROUTE_SEGMENTS } from "./route";

describe("log route", () => {
  it("[NFR-OBS-01] keeps the app's own route segments", () => {
    expect(logRoute("GET", "/api/health")).toBe("GET /api/health");
    expect(logRoute("POST", "/api/csp-report")).toBe("POST /api/csp-report");
    expect(logRoute("GET", "/")).toBe("GET /");
    expect(logRoute("GET", "")).toBe("GET /");
  });

  it("[NFR-PRIV-03] [T-16] logs any other segment as a parameter, so an email in the path never reaches the log", () => {
    expect(logRoute("GET", "/ada@example.com")).toBe("GET /:param");
    expect(logRoute("GET", "/api/ada@example.com/health")).toBe("GET /api/:param/health");
    expect(logRoute("GET", "/fatima-alharbi")).toBe("GET /:param");
    expect(logRoute("GET", "/API/Health")).toBe("GET /:param/:param");
  });

  it("[NFR-PRIV-03] [T-16] logs a method that is not standard as OTHER", () => {
    expect(logRoute("get", "/")).toBe("OTHER /");
    expect(logRoute("ADA@EXAMPLE.COM", "/")).toBe("OTHER /");
    expect(logRoute("DELETE", "/")).toBe("DELETE /");
  });

  it("[T-16] bounds the length however long the path is", () => {
    const long = `/${Array.from({ length: 500 }, () => "x".repeat(3000)).join("/")}`;
    const route = logRoute("GET", long);
    expect(route).toBe(
      `GET /${Array.from({ length: MAX_ROUTE_SEGMENTS }, () => ":param").join("/")}/*`,
    );
    expect(logRoute("GET", "/api/health/a/b/c/d")).toBe(
      "GET /api/health/:param/:param/:param/:param",
    );
  });

  it("[NFR-OBS-01] knows every literal route segment under src/app", () => {
    const literal: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        // Dynamic segments, route groups, parallel routes, and private folders are not literal.
        if (!/^[[(@_]/.test(entry.name)) literal.push(entry.name);
        walk(join(dir, entry.name));
      }
    };
    walk(join(process.cwd(), "src/app"));
    expect(literal.length).toBeGreaterThan(0);
    expect(literal.filter((segment) => !ROUTE_SEGMENTS.has(segment))).toEqual([]);
  });
});

describe("actionLogRoute", () => {
  it("[NFR-PRIV-03] names a server action by the name in the code", () => {
    expect(actionLogRoute("request-email-code")).toBe("POST /actions/request-email-code");
    expect(actionLogRoute("ada@example.com")).toBe("POST /actions/:param");
  });
});
