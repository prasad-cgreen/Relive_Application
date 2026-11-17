"use client";

type Account = { type: string; balance: number; status: string };

// Secured = backed by an asset (bureau names: "Housing Loan", "Property Loan", "Auto Loan", "Gold Loan", "Business Loan (Secured)"...).
// \bcar\b keeps "Credit Card" unsecured.
const SECURED = /hous|home|property|mortgage|auto|\bcar\b|vehicle|two-wheeler|gold|against shares|\(secured\)/i;
const COLORS = ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500"];
const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** Debt summary: where the outstanding money sits, by loan type. */
export function DebtSummaryCard({ totalBalance, accounts }: { totalBalance: number; accounts: Account[] }) {
  const byType = new Map<string, { balance: number; count: number }>();
  let secured = 0;
  for (const account of accounts) {
    if (account.balance <= 0) continue;
    const entry = byType.get(account.type) ?? { balance: 0, count: 0 };
    entry.balance += account.balance;
    entry.count += 1;
    byType.set(account.type, entry);
    if (SECURED.test(account.type)) secured += account.balance;
  }
  const rows = [...byType.entries()].sort((a, b) => b[1].balance - a[1].balance);
  const sum = rows.reduce((total, [, row]) => total + row.balance, 0);
  const share = (value: number) => (sum > 0 ? Math.round((value / sum) * 100) : 0);

  return (
    <section className="h-full rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-xs sm:p-6 dark:border-[#162a1f] dark:bg-[#0c1a12]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#0c1a13] dark:text-white">Debt summary</h2>
          <p className="mt-0.5 text-sm text-[#63786d] dark:text-[#8ba295]">Outstanding across your active loans and cards</p>
        </div>
      </div>

      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-[#0c1a13] dark:text-white">{rupees(totalBalance)}</p>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[#dbe5df] p-6 text-center text-sm text-[#63786d] dark:border-[#1d3427] dark:text-[#8ba295]">
          No outstanding balances reported.
        </p>
      ) : (
        <>
          {/* Stacked bar by loan type */}
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#eef3f0] dark:bg-white/5">
            {rows.map(([type, row], i) => (
              <div key={type} className={`h-full ${COLORS[i % COLORS.length]}`} style={{ width: `${share(row.balance)}%` }} title={`${type}: ${share(row.balance)}%`} />
            ))}
          </div>

          <ul className="mt-4 space-y-3">
            {rows.map(([type, row], i) => (
              <li key={type} className="flex items-center gap-3 text-sm">
                <span className={`size-2.5 shrink-0 rounded-full ${COLORS[i % COLORS.length]}`} />
                <span className="min-w-0 flex-1 truncate text-[#2d4236] dark:text-[#b0c8bb]">
                  {type} <span className="text-[#8a9c92]">· {row.count}</span>
                </span>
                <span className="font-semibold tabular-nums text-[#0c1a13] dark:text-white">{rupees(row.balance)}</span>
                <span className="w-10 text-right text-xs tabular-nums text-[#7a8f83]">{share(row.balance)}%</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#eef3f0] pt-4 dark:border-[#16291e]">
            <div className="min-w-0">
              <p className="text-xs text-[#6b7f74] dark:text-[#8ba295]">Secured</p>
              <p className="truncate text-sm font-semibold tabular-nums text-[#0c1a13] dark:text-white">
                {rupees(secured)} <span className="font-normal text-[#7a8f83]">· {share(secured)}%</span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#6b7f74] dark:text-[#8ba295]">Unsecured</p>
              <p className="truncate text-sm font-semibold tabular-nums text-[#0c1a13] dark:text-white">
                {rupees(sum - secured)} <span className="font-normal text-[#7a8f83]">· {sum > 0 ? 100 - share(secured) : 0}%</span>
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
