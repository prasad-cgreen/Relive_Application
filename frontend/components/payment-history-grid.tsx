"use client";

import { Check, ShieldCheck, X } from "lucide-react";

interface PaymentHistoryGridProps {
  onTimePercent?: number;
  totalBalance?: number;
  highestBalance?: number;
  accountName?: string;
  accountNumber?: string;
  accountType?: string;
  status?: string;
  openedDate?: string;
  lastPaymentDate?: string;
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const YEARS = [2026, 2025, 2024, 2023, 2022];

export function PaymentHistoryGrid({
  onTimePercent = 98,
  totalBalance = 0,
  highestBalance = 162000,
  accountName = "Demo Lender",
  accountNumber = "•••• 4028",
  accountType = "Credit Account",
  status = "Current",
  openedDate = "Jan 12, 2022",
  lastPaymentDate = "Recent",
}: PaymentHistoryGridProps) {
  // Generate realistic on-time status matrix based on actual on-time percentage
  const getMonthStatus = (year: number, monthIdx: number) => {
    // Current year: future months are empty
    const currentMonth = 10; // November
    if (year === 2026 && monthIdx > currentMonth) return "future";
    if (year === 2022 && monthIdx < 2) return "inactive"; // opened early 2022

    // Slight variation if onTimePercent < 100
    if (onTimePercent < 95 && year === 2024 && monthIdx === 3) return "late";
    if (onTimePercent < 90 && year === 2023 && monthIdx === 7) return "late";

    return "ontime";
  };

  return (
    <div className="rounded-2xl border border-[#e1e9e4] bg-white p-5 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
      {/* Account Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#0c1a13] dark:text-white">
              {accountName}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#63786d] dark:text-[#8ba295]">
            {accountType} • Acct {accountNumber} • Opened {openedDate}
          </p>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[10px] font-medium text-[#768a80] uppercase tracking-wider dark:text-[#8ba295]">
              Balance
            </p>
            <p className="text-sm font-bold text-[#0c1a13] dark:text-white">
              ₹{totalBalance.toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-[#768a80] uppercase tracking-wider dark:text-[#8ba295]">
              Highest Balance
            </p>
            <p className="text-sm font-bold text-[#0c1a13] dark:text-white">
              ₹{highestBalance.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        {/* Left Column: Payment History Matrix (DisputeFox Style) */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0c1a13] uppercase tracking-wider dark:text-white">
              Payment History
            </h3>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {onTimePercent}% on time
            </span>
          </div>
          <p className="mt-1 text-xs text-[#63786d] dark:text-[#8ba295]">
            You have made {onTimePercent}% of payments for this account on time.
          </p>

          {/* Matrix Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr>
                  <th className="w-12 text-left text-[11px] font-semibold text-[#8ca095] dark:text-[#6a8275]">
                    Year
                  </th>
                  {MONTHS.map((m, idx) => (
                    <th
                      key={idx}
                      className="px-1 pb-2 text-[10px] font-bold text-[#8ca095] dark:text-[#7f998c]"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="space-y-1.5">
                {YEARS.map((year) => (
                  <tr key={year} className="group hover:bg-[#f6f9f7] dark:hover:bg-[#11241a]">
                    <td className="py-1 text-left text-xs font-bold text-[#44574d] dark:text-[#9bb2a6]">
                      {year}
                    </td>
                    {MONTHS.map((_, mIdx) => {
                      const state = getMonthStatus(year, mIdx);
                      return (
                        <td key={mIdx} className="py-1 px-1">
                          {state === "ontime" ? (
                            <span
                              title={`${MONTH_NAMES[mIdx]} ${year}: Paid as Agreed`}
                              className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xs hover:scale-110 transition-transform"
                            >
                              <Check className="size-3 stroke-[3]" />
                            </span>
                          ) : state === "late" ? (
                            <span
                              title={`${MONTH_NAMES[mIdx]} ${year}: Late Payment Reported`}
                              className="inline-flex size-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-2xs hover:scale-110 transition-transform"
                            >
                              <X className="size-3 stroke-[3]" />
                            </span>
                          ) : (
                            <span
                              title={`${MONTH_NAMES[mIdx]} ${year}: No reporting required`}
                              className="inline-block size-2 rounded-full bg-[#d6ded9] dark:bg-[#203629]"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#6b8074] dark:text-[#8ba295]">
            <div className="flex items-center gap-1.5">
              <span className="size-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                <Check className="size-2.5" />
              </span>
              <span>Paid on time</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3.5 rounded-full bg-rose-500 flex items-center justify-center text-white">
                <X className="size-2.5" />
              </span>
              <span>Past due</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#d6ded9] dark:bg-[#203629]" />
              <span>No record/Future</span>
            </div>
          </div>
        </div>

        {/* Right Column: DisputeFox Account Details Sidebar Box */}
        <div className="flex flex-col justify-between rounded-xl border border-[#e5ece8] bg-[#f8faf9] p-4 dark:border-[#193023] dark:bg-[#08120d]">
          <h4 className="text-xs font-bold text-[#0c1a13] uppercase tracking-wider dark:text-white">
            Account Details
          </h4>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between border-b border-[#ebf0ed] pb-1.5 dark:border-[#15281d]">
              <span className="text-[#687e72] dark:text-[#87a092]">Last Payment</span>
              <span className="font-semibold text-[#0c1a13] dark:text-white">{lastPaymentDate}</span>
            </div>
            <div className="flex justify-between border-b border-[#ebf0ed] pb-1.5 dark:border-[#15281d]">
              <span className="text-[#687e72] dark:text-[#87a092]">Current Status</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">As Agreed</span>
            </div>
            <div className="flex justify-between border-b border-[#ebf0ed] pb-1.5 dark:border-[#15281d]">
              <span className="text-[#687e72] dark:text-[#87a092]">Worst Status</span>
              <span className="font-semibold text-[#0c1a13] dark:text-white">None</span>
            </div>
            <div className="flex justify-between border-b border-[#ebf0ed] pb-1.5 dark:border-[#15281d]">
              <span className="text-[#687e72] dark:text-[#87a092]">Account Type</span>
              <span className="font-semibold text-[#0c1a13] dark:text-white">{accountType}</span>
            </div>
            <div className="flex justify-between border-b border-[#ebf0ed] pb-1.5 dark:border-[#15281d]">
              <span className="text-[#687e72] dark:text-[#87a092]">Responsibility</span>
              <span className="font-semibold text-[#0c1a13] dark:text-white">Individual</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#687e72] dark:text-[#87a092]">30/60/90 Days Late</span>
              <span className="font-semibold text-[#0c1a13] dark:text-white">00 / 00 / 00</span>
            </div>
          </div>

          {/* Action CTA matching DisputeFox */}
          <div className="mt-4 pt-3 border-t border-[#e2eae5] dark:border-[#193023]">
            <button
              type="button"
              onClick={() => {
                alert("Account verification confirmed. No discrepancies reported.");
              }}
              className="w-full rounded-xl bg-[#0c1a13] py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#183325] dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
            >
              Verify / Inquire Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

