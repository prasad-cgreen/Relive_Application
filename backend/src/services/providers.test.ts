import { describe, expect, it } from "vitest";

// Pure parsing helpers: no database needed, so give env.ts placeholder URLs before importing.
process.env.DATABASE_URL ??= "postgresql://test@localhost/test";
process.env.DATABASE_URL_UNPOOLED ??= "postgresql://test@localhost/test";
const { normalizeDob, panToProfile, otpSmsText, smartpingResult, normalizePanPhone, panPhoneMatches, maskPanPhone } = await import("./providers.js");

describe("PAN record mobile vs the OTP-verified mobile", () => {
  const login = "9100953181";
  const check = (raw: string) => panPhoneMatches(normalizePanPhone(raw)!, login);

  it("matches IndiConnect's masked number on the digits it shows", () => {
    expect(check("91XXXXXX81")).toBe(true); // the live format: first 2 + last 2 digits
    expect(check("92XXXXXX81")).toBe(false);
    expect(check("91XXXXXX82")).toBe(false);
  });

  it("handles full numbers, +91, spaces and other mask styles", () => {
    expect(check("9100953181")).toBe(true);
    expect(check("9100953182")).toBe(false);
    expect(check("+91 91XXXXXX81")).toBe(true);
    expect(check("******3181")).toBe(true);
    expect(check("XXXXXX3180")).toBe(false);
  });

  it("treats a missing or fully masked number as nothing to compare", () => {
    expect(normalizePanPhone(null)).toBeNull();
    expect(normalizePanPhone("")).toBeNull();
    expect(normalizePanPhone("XXXXXXXXXX")).toBeNull();
  });

  it("never logs more than the first 2 and last 2 digits", () => {
    expect(maskPanPhone("9100953181")).toBe("91XXXXXX81");
    expect(maskPanPhone("91XXXXXX81")).toBe("91XXXXXX81");
  });
});

describe("Smartping SMS", () => {
  it("sends the DLT-approved template text exactly", () => {
    expect(otpSmsText("048213")).toBe("Dear Customer, Your login OTP is 048213. Do not share it with anyone.-cGreen");
  });

  it("maps SPARC submit states", () => {
    expect(smartpingResult({ state: "SUBMIT_ACCEPTED", transactionId: 42 })).toEqual({ providerRef: "42" });
    expect(() => smartpingResult({ state: "INVALID_MSISDN" })).toThrow(expect.objectContaining({ kind: "BUSINESS_FAILURE" }));
    expect(() => smartpingResult({ state: "TEMPLATE_MISSING" })).toThrow(expect.objectContaining({ code: "SMARTPING_TEMPLATE_MISSING", kind: "TECHNICAL_FAILURE" }));
    expect(() => smartpingResult(null)).toThrow(expect.objectContaining({ code: "INVALID_PROVIDER_RESPONSE" }));
  });
});

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
