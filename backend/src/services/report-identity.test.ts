import { describe, expect, it } from "vitest";
import { echoedRequestIdentity, extractReportIdentity, matchReportIdentity, normalizeReportDob } from "./report-identity.js";

const hash = (pan: string) => `h:${pan}`;
// Shape of a real Experian inprofileResponse (values invented).
const experian = {
  inprofileResponse: {
    CAPS: { CAPS_Application_Details: { CAPS_Applicant_Details: { IncomeTaxPan: "abcde1234f", Date_Of_Birth_Applicant: "20040309" } } },
    CAIS_Account: { CAIS_Account_DETAILS: [{ CAIS_Holder_Details: { Income_TAX_PAN: "ABCDE1234F", Date_of_birth: "20040309" } }] },
    // What we sent: must be ignored even if it carried identity.
    Current_Application: { Current_Application_Details: { Current_Applicant_Details: { IncomeTaxPan: "ZZZZZ9999Z", Date_Of_Birth_Applicant: "19990101" } } },
  },
};

describe("report identity", () => {
  it("extracts PANs and DOBs, ignoring our own request echo", () => {
    const id = extractReportIdentity(experian);
    expect([...id.pans]).toEqual(["ABCDE1234F"]);
    expect([...id.dobs]).toEqual(["2004-03-09"]);
  });

  it("normalizes bureau date formats", () => {
    expect(normalizeReportDob("09-03-2004")).toBe("2004-03-09");
    expect(normalizeReportDob("2004-03-09")).toBe("2004-03-09");
    expect(normalizeReportDob("")).toBeNull();
  });

  it("verified PAN decides when the report has one", () => {
    const id = extractReportIdentity(experian);
    expect(matchReportIdentity(id, { verifiedPanHash: hash("ABCDE1234F"), dateOfBirth: null }, hash)).toBe("MATCH");
    // Someone else's report: DOB happens to match but PAN does not -> still a mismatch.
    expect(matchReportIdentity(id, { verifiedPanHash: hash("PQRSX6789K"), dateOfBirth: "2004-03-09" }, hash)).toBe("MISMATCH");
  });

  it("falls back to date of birth without a verified PAN", () => {
    const id = extractReportIdentity(experian);
    expect(matchReportIdentity(id, { verifiedPanHash: null, dateOfBirth: "2004-03-09" }, hash)).toBe("MATCH");
    expect(matchReportIdentity(id, { verifiedPanHash: null, dateOfBirth: "1990-01-01" }, hash)).toBe("MISMATCH");
  });

  it("reports whether the bureau echoed the PAN / DOB we sent", () => {
    expect(echoedRequestIdentity(experian)).toEqual({ pan: true, dob: true });
    // Holder details elsewhere in the report don't count as our request being received.
    expect(echoedRequestIdentity({ CAIS: { Income_TAX_PAN: "ABCDE1234F" }, Current_Application: { IncomeTaxPan: "" } })).toEqual({ pan: false, dob: false });
  });

  it("is unverifiable when the report carries no identity", () => {
    expect(matchReportIdentity(extractReportIdentity({}), { verifiedPanHash: null, dateOfBirth: "2004-03-09" }, hash)).toBe("UNVERIFIABLE");
  });
});
