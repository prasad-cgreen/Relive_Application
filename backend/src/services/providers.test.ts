import { describe, expect, it } from "vitest";

// Pure parsing helpers: no database needed, so give env.ts placeholder URLs before importing.
process.env.DATABASE_URL ??= "postgresql://test@localhost/test";
process.env.DATABASE_URL_UNPOOLED ??= "postgresql://test@localhost/test";
const { normalizeDob, panToProfile } = await import("./providers.js");

describe("IndiConnect PAN response parsing", () => {
  it("normalizes the date formats the provider may return", () => {
    expect(normalizeDob("1992-06-14")).toBe("1992-06-14");
    expect(normalizeDob("14-06-1992")).toBe("1992-06-14");
    expect(normalizeDob("14/06/1992")).toBe("1992-06-14");
    expect(normalizeDob("not a date")).toBeNull();
    expect(normalizeDob(undefined)).toBeNull();
  });

  it("maps PAN-detailed data to a profile", () => {
    expect(panToProfile({ full_name_split: ["RAHUL", "KUMAR", "SHARMA"], dob: "1990-01-31", email: "r@x.in" }))
      .toEqual({ firstName: "RAHUL", lastName: "KUMAR SHARMA", email: "r@x.in", dateOfBirth: "1990-01-31" });
    expect(panToProfile({ full_name: "MADHU", dob: "01-02-1985", email: null }))
      .toEqual({ firstName: "MADHU", lastName: "", email: "", dateOfBirth: "1985-02-01" });
  });

  it("rejects responses without a name or date of birth", () => {
    expect(() => panToProfile({ full_name: "", dob: "1990-01-31" })).toThrow();
    expect(() => panToProfile({ full_name: "A B", dob: "" })).toThrow();
  });
});
