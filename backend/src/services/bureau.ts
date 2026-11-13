// Normalizes IndiConnect bureau responses (Experian inprofileResponse, CRIF credit_report)
// into the report shape the dashboard renders. Raw responses are stored separately.
// Every number here comes from the bureau data; anything a bureau doesn't report is null, never a placeholder.

export type NormalizedAccount = {
  type: string;
  lender: string;
  balance: number;
  status: "Active" | "Closed";
  accountNumber: string;
  creditLimit?: number;
  sanctionedAmount?: number;
  pastDue: number;
  openDate?: string;
  history: HistoryMonth[]; // this account's months, newest first
};

/** One month across all accounts: "late" if any account reported days past due that month. */
export type HistoryMonth = { month: string; status: "ontime" | "late"; daysPastDue: number };

export type NormalizedReport = {
  score: number;
  summary: {
    openAccounts: number;
    closedAccounts: number;
    totalBalance: number;
    onTimePayments: number;
    creditUtilization: number | null; // % of credit card limits used (open cards), null if no cards
    creditAgeMonths: number | null; // average age of open accounts
    enquiriesLast6Months: number | null;
    highestCredit: number | null; // largest sanctioned amount / credit limit
    lateMonths: { upTo30: number; upTo60: number; over60: number };
  };
  accounts: NormalizedAccount[];
  paymentHistory: HistoryMonth[]; // newest first
  insights: string[];
};

type MonthEntry = { month: string; daysPastDue: number };

const toHistory = (entries: MonthEntry[]): HistoryMonth[] =>
  [...entries].sort((a, b) => b.month.localeCompare(a.month))
    .map(({ month, daysPastDue }) => ({ month, daysPastDue, status: daysPastDue > 0 ? "late" : "ontime" }));

const asList = <T>(value: T | T[] | null | undefined): T[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
const amount = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const count = (value: unknown) => (/^\d+$/.test(String(value ?? "").trim()) ? Number(value) : null);
const mask = (value: unknown) => {
  const digits = String(value ?? "").replace(/\s/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "";
};
/** Bureau scores are 300-900; anything else (0, -1, blank) means no score was generated. */
export function validScore(value: unknown) {
  const score = Number(String(value ?? "").trim());
  return Number.isInteger(score) && score >= 300 && score <= 900 ? score : null;
}
/** YYYYMMDD or DD-MM-YYYY -> YYYY-MM-DD */
function isoDate(value: unknown) {
  const text = String(value ?? "");
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : undefined;
}
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Experian account type codes (most common ones; the rest fall back to a generic label).
const EXPERIAN_ACCOUNT_TYPES: Record<string, string> = {
  "01": "Auto Loan", "02": "Housing Loan", "03": "Property Loan", "04": "Loan Against Shares", "05": "Personal Loan",
  "06": "Consumer Loan", "07": "Gold Loan", "08": "Education Loan", "09": "Loan to Professional", "10": "Credit Card",
  "11": "Leasing", "12": "Overdraft", "13": "Two-Wheeler Loan", "17": "Commercial Vehicle Loan", "32": "Used Car Loan",
  "51": "Business Loan", "61": "Business Loan (Secured)", "69": "Short-Term Personal Loan",
};

function monthsSince(isoDay: string, now = new Date()) {
  const [year, month] = isoDay.split("-").map(Number);
  return (now.getFullYear() - year!) * 12 + (now.getMonth() + 1 - month!);
}

function finish(score: number, accounts: NormalizedAccount[], history: MonthEntry[], enquiries: number | null, now = new Date()): NormalizedReport {
  const open = accounts.filter((account) => account.status === "Active");

  // Worst status per calendar month across all accounts.
  const byMonth = new Map<string, number>();
  for (const entry of history) byMonth.set(entry.month, Math.max(byMonth.get(entry.month) ?? 0, entry.daysPastDue));
  const paymentHistory = toHistory([...byMonth.entries()].map(([month, daysPastDue]) => ({ month, daysPastDue })));

  const onTime = history.length ? Math.round((history.filter((entry) => entry.daysPastDue === 0).length / history.length) * 100) : 100;
  const late = history.filter((entry) => entry.daysPastDue > 0);
  const lateMonths = {
    upTo30: late.filter((entry) => entry.daysPastDue <= 30).length,
    upTo60: late.filter((entry) => entry.daysPastDue > 30 && entry.daysPastDue <= 60).length,
    over60: late.filter((entry) => entry.daysPastDue > 60).length,
  };

  const cards = open.filter((account) => /credit card/i.test(account.type) && account.creditLimit);
  const limit = cards.reduce((sum, card) => sum + (card.creditLimit ?? 0), 0);
  const utilization = limit ? Math.round((cards.reduce((sum, card) => sum + card.balance, 0) / limit) * 100) : null;

  const ages = (open.length ? open : accounts).flatMap((account) => (account.openDate ? [monthsSince(account.openDate, now)] : []));
  const creditAgeMonths = ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null;
  const credits = accounts.map((account) => Math.max(account.sanctionedAmount ?? 0, account.creditLimit ?? 0)).filter(Boolean);
  const overdue = accounts.reduce((sum, account) => sum + account.pastDue, 0);

  const insights = [
    overdue > 0 ? "You have overdue amounts reported. Clearing them is the fastest way to protect your score." : "No overdue amounts are reported on your accounts.",
    onTime === 100 ? "Every reported payment was made on time." : `${onTime}% of your reported payments were on time.`,
    ...(utilization === null ? [] : [utilization > 30
      ? `Your credit card utilization is ${utilization}%. Keeping it under 30% can help your score.`
      : `Your credit card utilization is ${utilization}%, which is within a healthy range.`]),
    ...(enquiries && enquiries >= 3 ? [`Lenders checked your credit ${enquiries} times in the last 6 months. Many applications in a short time can lower your score.`] : []),
  ];
  return {
    score,
    summary: {
      openAccounts: open.length,
      closedAccounts: accounts.length - open.length,
      totalBalance: open.reduce((sum, account) => sum + account.balance, 0),
      onTimePayments: onTime,
      creditUtilization: utilization,
      creditAgeMonths,
      enquiriesLast6Months: enquiries,
      highestCredit: credits.length ? Math.max(...credits) : null,
      lateMonths,
    },
    accounts,
    paymentHistory,
    insights,
  };
}

export function normalizeExperian(inprofile: any, now = new Date()): NormalizedReport | null {
  const score = validScore(inprofile?.SCORE?.BureauScore);
  if (score === null) return null;
  const history: MonthEntry[] = [];
  const accounts = asList<any>(inprofile?.CAIS_Account?.CAIS_Account_DETAILS).map((account): NormalizedAccount => {
    const own: MonthEntry[] = [];
    for (const month of asList<any>(account.CAIS_Account_History)) {
      const days = count(month?.Days_Past_Due);
      if (days !== null && /^\d{4}$/.test(String(month?.Year)) && /^\d{1,2}$/.test(String(month?.Month))) {
        own.push({ month: `${month.Year}-${String(month.Month).padStart(2, "0")}`, daysPastDue: days });
      }
    }
    history.push(...own);
    return {
      type: EXPERIAN_ACCOUNT_TYPES[String(account.Account_Type)] ?? "Credit Account",
      lender: String(account.Subscriber_Name ?? "").trim() || "Unknown lender",
      balance: amount(account.Current_Balance),
      status: String(account.Date_Closed ?? "").trim() ? "Closed" : "Active",
      accountNumber: mask(account.Account_Number),
      creditLimit: amount(account.Credit_Limit_Amount) || undefined,
      sanctionedAmount: amount(account.Highest_Credit_or_Original_Loan_Amount) || undefined,
      pastDue: amount(account.Amount_Past_Due),
      openDate: isoDate(account.Open_Date),
      history: toHistory(own),
    };
  });
  return finish(score, accounts, history, count(inprofile?.TotalCAPS_Summary?.TotalCAPSLast180Days), now);
}

export function normalizeCrif(creditReport: any, now = new Date()): NormalizedReport | null {
  if (creditReport?.HEADER?.STATUS && creditReport.HEADER.STATUS !== "SUCCESS") return null;
  const score = validScore(asList<any>(creditReport?.SCORES?.SCORE)[0]?.["SCORE-VALUE"]);
  if (score === null) return null;
  const history: MonthEntry[] = [];
  const accounts = asList<any>(creditReport?.RESPONSES?.RESPONSE).map((entry): NormalizedAccount => {
    const loan = entry?.["LOAN-DETAILS"] ?? {};
    const own: MonthEntry[] = [];
    // "Oct:2026,000/XXX|Sep:2026,XXX/STD|" -> days past due per month; "XXX/STD" = reported standard (on time)
    for (const part of String(loan["COMBINED-PAYMENT-HISTORY"] ?? "").split("|")) {
      const match = part.match(/^([A-Za-z]{3}):(\d{4}),([^/]+)\/(\w+)/);
      if (!match) continue;
      const monthIndex = MONTHS.indexOf(match[1]!.toUpperCase());
      const days = /^\d+$/.test(match[3]!) ? Number(match[3]) : match[4] === "STD" ? 0 : null;
      if (monthIndex >= 0 && days !== null) own.push({ month: `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`, daysPastDue: days });
    }
    history.push(...own);
    return {
      type: String(loan["ACCT-TYPE"] ?? "").trim() || "Credit Account",
      lender: String(loan["CREDIT-GUARANTOR"] ?? "").trim() || "Unknown lender",
      balance: amount(loan["CURRENT-BAL"]),
      status: loan["CLOSED-DATE"] || /closed/i.test(String(loan["ACCOUNT-STATUS"] ?? "")) ? "Closed" : "Active",
      accountNumber: mask(loan["ACCT-NUMBER"]),
      creditLimit: amount(loan["CREDIT-LIMIT"]) || undefined,
      sanctionedAmount: amount(loan["DISBURSED-AMT"]) || undefined,
      pastDue: amount(loan["OVERDUE-AMT"]),
      openDate: isoDate(loan["DISBURSED-DT"]),
      history: toHistory(own),
    };
  });
  const enquiries = count(creditReport?.["ACCOUNTS-SUMMARY"]?.["DERIVED-ATTRIBUTES"]?.["INQURIES-IN-LAST-SIX-MONTHS"]);
  return finish(score, accounts, history, enquiries, now);
}

/** Demo report for mock mode and seeding: a synthetic Experian response run through the real parser (no personal data). */
export function demoReport(score: number, now = new Date()): NormalizedReport {
  const months = (count: number, late: Record<number, string> = {}) => Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 1 - index, 1);
    return { Year: String(date.getFullYear()), Month: String(date.getMonth() + 1).padStart(2, "0"), Days_Past_Due: late[index] ?? "0" };
  });
  const report = normalizeExperian({
    SCORE: { BureauScore: String(score) },
    TotalCAPS_Summary: { TotalCAPSLast180Days: "1" },
    CAIS_Account: { CAIS_Account_DETAILS: [
      { Account_Type: "02", Subscriber_Name: "Demo Bank", Account_Number: "HL000004821", Current_Balance: "162000", Highest_Credit_or_Original_Loan_Amount: "2500000",
        Amount_Past_Due: "0", Open_Date: "20210412", Date_Closed: "", CAIS_Account_History: months(24) },
      { Account_Type: "10", Subscriber_Name: "Demo Finance", Account_Number: "4000000000001190", Current_Balance: "22500", Credit_Limit_Amount: "150000",
        Amount_Past_Due: "0", Open_Date: "20190801", Date_Closed: "", CAIS_Account_History: months(24, { 14: "20" }) },
      { Account_Type: "05", Subscriber_Name: "Demo Capital", Account_Number: "PL000007702", Current_Balance: "0", Highest_Credit_or_Original_Loan_Amount: "300000",
        Amount_Past_Due: "0", Open_Date: "20170220", Date_Closed: "20220315", CAIS_Account_History: [] },
    ]},
  }, now);
  return report!;
}
