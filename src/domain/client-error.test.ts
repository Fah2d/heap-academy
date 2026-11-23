import { describe, expect, it } from "vitest";
import { MAX_REPORTED_ROUTE_LENGTH, reportedRoute } from "./client-error";

describe("reported route", () => {
  it("[NFR-PRIV-03] keeps the path and drops the query and the fragment", () => {
    expect(reportedRoute("/courses/python")).toBe("/courses/python");
    expect(reportedRoute("/courses?email=ada%40example.com")).toBe("/courses");
    expect(reportedRoute("/lessons/1#print(1)")).toBe("/lessons/1");
    expect(reportedRoute("/")).toBe("/");
  });

  it("[NFR-PRIV-03] always starts with a slash and is never longer than a report may carry", () => {
    expect(reportedRoute("")).toBe("/");
    expect(reportedRoute("courses")).toBe("/courses");
    expect(reportedRoute(`/${"a".repeat(5000)}`)).toHaveLength(MAX_REPORTED_ROUTE_LENGTH);
  });
});
