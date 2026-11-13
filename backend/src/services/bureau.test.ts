import { describe, expect, it } from "vitest";
import { normalizeCrif, normalizeExperian } from "./bureau.js";

// Synthetic fixtures shaped like the IndiConnect samples (no real personal data).
const NOW = new Date("2026-11-15T00:00:00Z");

const experian = {
  SCORE: { BureauScore: "745" },
  TotalCAPS_Summary: { TotalCAPSLast180Days: "4" },
  CAIS_Account: { CAIS_Account_DETAILS: [
    { Account_Type: "10", Subscriber_Name: "Demo Bank", Account_Number: "1234567890123456", Current_Balance: "4000",
      Credit_Limit_Amount: "10000", Highest_Credit_or_Original_Loan_Amount: "", Amount_Past_Due: "0", Open_Date: "20240915", Date_Closed: "",
      CAIS_Account_History: [{ Year: "2026", Month: "10", Days_Past_Due: "0" }, { Year: "2026", Month: "09", Days_Past_Due: "45" }] },
    { Account_Type: "06", Subscriber_Name: "Demo Finance", Account_Number: "999", Current_Balance: "0",
      Credit_Limit_Amount: "", Highest_Credit_or_Original_Loan_Amount: "25000", Amount_Past_Due: "0", Open_Date: "20250630", Date_Closed: "20260102",
      CAIS_Account_History: [{ Year: "2026", Month: "09", Days_Past_Due: "0" }, { Year: "2025", Month: "12", Days_Past_Due: "" }] },
  ]},
};

const crif = {
  HEADER: { STATUS: "SUCCESS" },
  SCORES: { SCORE: { "SCORE-VALUE": "702" } },
  "ACCOUNTS-SUMMARY": { "DERIVED-ATTRIBUTES": { "INQURIES-IN-LAST-SIX-MONTHS": "1" } },
  RESPONSES: { RESPONSE: [
    { "LOAN-DETAILS": { "ACCT-TYPE": "Credit Card", "CREDIT-GUARANTOR": "Demo Bank", "ACCT-NUMBER": "4321000011112222",
      "ACCOUNT-STATUS": "Active", "CURRENT-BAL": "3,864", "CREDIT-LIMIT": "41,000", "OVERDUE-AMT": "0", "DISBURSED-AMT": "",
      "DISBURSED-DT": "08-09-2026", "CLOSED-DATE": null, "COMBINED-PAYMENT-HISTORY": "Oct:2026,000/XXX|Sep:2026,XXX/STD|" } },
    { "LOAN-DETAILS": { "ACCT-TYPE": "Education Loan", "CREDIT-GUARANTOR": "Demo Finance", "ACCT-NUMBER": "55",
      "ACCOUNT-STATUS": "Closed", "CURRENT-BAL": "0", "CREDIT-LIMIT": "0", "OVERDUE-AMT": "0", "DISBURSED-AMT": "2,50,000",
      "DISBURSED-DT": "22-09-2021", "CLOSED-DATE": "13-09-2024", "COMBINED-PAYMENT-HISTORY": "Sep:2024,095/SUB|Aug:2024,XXX/XXX|" } },
  ]},
};

describe("bureau normalization", () => {
  it("maps an Experian report, including month-by-month history and derived metrics", () => {
    const report = normalizeExperian(experian, NOW)!;
    expect(report.score).toBe(745);
    expect(report.summary).toEqual({
      openAccounts: 1, closedAccounts: 1, totalBalance: 4000, onTimePayments: 67,
      creditUtilization: 40, creditAgeMonths: 26, enquiriesLast6Months: 4, highestCredit: 25000,
      lateMonths: { upTo30: 0, upTo60: 1, over60: 0 },
    });
    // Sep 2026: one account on time, one 45 days late -> the month is late (worst wins). Blank DPD months are skipped.
    expect(report.paymentHistory).toEqual([
      { month: "2026-10", status: "ontime", daysPastDue: 0 },
      { month: "2026-09", status: "late", daysPastDue: 45 },
    ]);
    expect(report.accounts[0]).toMatchObject({ type: "Credit Card", status: "Active", accountNumber: "•••• 3456", creditLimit: 10000, openDate: "2024-09-15", pastDue: 0 });
    expect(report.accounts[1]).toMatchObject({ type: "Consumer Loan", status: "Closed", sanctionedAmount: 25000 });
    // Each account keeps its own months (the summary merges them).
    expect(report.accounts[0]!.history.map((month) => month.status)).toEqual(["ontime", "late"]);
    expect(report.accounts[1]!.history).toEqual([{ month: "2026-09", status: "ontime", daysPastDue: 0 }]);
    expect(report.insights).toEqual(expect.arrayContaining([expect.stringContaining("utilization is 40%"), expect.stringContaining("4 times")]));
  });

  it("maps a CRIF report", () => {
    const report = normalizeCrif(crif, NOW)!;
    expect(report.score).toBe(702);
    expect(report.summary).toMatchObject({
      openAccounts: 1, closedAccounts: 1, totalBalance: 3864, enquiriesLast6Months: 1, highestCredit: 250000,
      creditUtilization: 9, creditAgeMonths: 2, lateMonths: { upTo30: 0, upTo60: 0, over60: 1 },
    });
    expect(report.paymentHistory.map((month) => `${month.month}:${month.status}`)).toEqual(["2026-10:ontime", "2026-09:ontime", "2024-09:late"]);
    expect(report.accounts[0]).toMatchObject({ balance: 3864, creditLimit: 41000, openDate: "2026-09-08" });
  });

  it("reports missing data as null, never as a placeholder", () => {
    const report = normalizeExperian({ SCORE: { BureauScore: "700" } }, NOW)!;
    expect(report.summary).toMatchObject({ creditUtilization: null, creditAgeMonths: null, enquiriesLast6Months: null, highestCredit: null });
    expect(report.paymentHistory).toEqual([]);
  });

  it("treats a missing or out-of-range score as no record, so CRIF fallback kicks in", () => {
    expect(normalizeExperian({ SCORE: { BureauScore: "" } })).toBeNull();
    expect(normalizeExperian({ SCORE: { BureauScore: "-1" } })).toBeNull();
    expect(normalizeCrif({ HEADER: { STATUS: "FAILED" }, SCORES: { SCORE: { "SCORE-VALUE": "700" } } })).toBeNull();
    expect(normalizeCrif({ SCORES: { SCORE: { "SCORE-VALUE": "0" } } })).toBeNull();
  });
});
