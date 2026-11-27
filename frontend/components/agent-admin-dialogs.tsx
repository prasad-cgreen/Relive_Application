"use client";

// Dialogs for the agents admin page (app/admin/agents): add agents (one, or many from a CSV), an agent's QR card,
// and the deactivate confirmation. Phones get bottom sheets, larger screens centred dialogs.

import { AGENT_IMPORT_BATCH, adminPasswordSchema, agentCsvRows, agentSchema } from "@relive/shared";
import { AlertCircle, Check, CheckCircle2, Copy, Download, Eye, EyeOff, FileSpreadsheet, Loader2, QrCode, UploadCloud, X } from "lucide-react";
import { Dialog, Tabs } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import { api, apiErrorCode } from "../lib/api";

export type Agent = { id: string; name: string; mobile: string; active: boolean; referrals: number; viaQr: number; createdAt: string };
export type AgentQr = { agent: Agent; link: string; image: string };
type ImportResult = { added: number; updated: number; errors: { row: number; message: string }[] };

export const ui = {
  input:
    "h-11 w-full rounded-xl border border-[#d8e3dc] bg-white px-3.5 text-sm text-[#0c1a13] outline-none transition placeholder:text-[#9aaea3] focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 aria-invalid:border-red-400 dark:border-[#1a3526] dark:bg-[#08150f] dark:text-white",
  primary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/25 disabled:pointer-events-none disabled:opacity-60",
  secondary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d8e3dc] bg-white px-4 text-sm font-medium text-[#0c1a13] transition hover:bg-[#f4f8f6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/15 disabled:pointer-events-none disabled:opacity-60 dark:border-[#1a3526] dark:bg-transparent dark:text-white dark:hover:bg-[#12241a]",
  danger:
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-600/25 disabled:pointer-events-none disabled:opacity-60",
  muted: "text-[#5d7367] dark:text-[#8ba295]",
};

export const formatMobile = (mobile: string) => `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`;
export const plural = (n: number, word: string) => `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;
const TEMPLATE = `data:text/csv;charset=utf-8,${encodeURIComponent("name,mobile\nPriya Nair,9876500001\nRavi Kumar,9876500002\n")}`;

/** Each dialog reports failures through this: it handles an expired admin sign-in and returns the message to show. */
export type Fail = (error: unknown) => string;

function Modal({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#04100a]/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#0c1a13] shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-6 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0 dark:bg-[#0c1a12] dark:text-white">
          <div className="mx-auto -mt-1 mb-4 h-1 w-10 rounded-full bg-[#dbe5df] sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
              <Dialog.Description className={`mt-1 text-sm ${ui.muted}`}>{description}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-[#5d7367] transition hover:bg-[#f2f6f4] hover:text-[#0c1a13] dark:hover:bg-[#12241a] dark:hover:text-white">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {children}
    </p>
  );
}

// ─── Add agents ──────────────────────────────────────────────────────────────

type PreviewRow = { row: number; name: string; mobile: string; error?: string };

export function AddAgentsDialog({ tab, onClose, onAdded, onImported, fail }: {
  tab: "one" | "csv"; onClose: () => void; onAdded: (agentId: string) => void; onImported: () => void; fail: Fail;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<{ name: string; rows: PreviewRow[] } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const addOne = async (form: HTMLFormElement) => {
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<{ id: string }>("/admin/agents", { name: values.get("name"), mobile: values.get("mobile") });
      toast.success(`${String(values.get("name")).trim()} is ready. Here's their QR code.`);
      onAdded(data.id);
    } catch (requestError) {
      setError(fail(requestError));
    } finally {
      setBusy(false);
    }
  };

  // The rows are checked in the browser first (same rules as the server), so problems show before anything is saved.
  const readFile = async (picked: File | undefined) => {
    if (!picked) return;
    setError("");
    setResult(null);
    if (!/\.csv$/i.test(picked.name) && picked.type !== "text/csv") {
      setFile(null);
      setError("Choose a .csv file. In Excel or Google Sheets: File › Save as / Download › CSV.");
      return;
    }
    const rows = agentCsvRows(await picked.text()).map((row) => {
      const checked = agentSchema.safeParse(row);
      return checked.success ? row : { ...row, error: checked.error.issues[0]?.message ?? "Check this row" };
    });
    if (rows.length === 0) {
      setFile(null);
      setError("No agents found in this file. It needs a name column and a mobile number column.");
      return;
    }
    setFile({ name: picked.name, rows });
  };

  const valid = file?.rows.filter((row) => !row.error) ?? [];
  const invalid = file?.rows.filter((row) => row.error) ?? [];

  const importRows = async () => {
    setBusy(true);
    setError("");
    try {
      const total: ImportResult = { added: 0, updated: 0, errors: [] };
      for (let start = 0; start < valid.length; start += AGENT_IMPORT_BATCH) {
        const { data } = await api.post<ImportResult>("/admin/agents/import", {
          rows: valid.slice(start, start + AGENT_IMPORT_BATCH).map(({ row, name, mobile }) => ({ row, name, mobile })),
        });
        total.added += data.added;
        total.updated += data.updated;
        total.errors.push(...data.errors);
      }
      total.errors.push(...invalid.map(({ row, error }) => ({ row, message: error! })));
      total.errors.sort((a, b) => a.row - b.row);
      setResult(total);
      onImported();
      toast.success(total.added ? `${plural(total.added, "agent")} added` : "Agents updated");
    } catch (requestError) {
      setError(fail(requestError));
    } finally {
      setBusy(false);
    }
  };

  const tabClass =
    "flex-1 rounded-lg px-3 py-2 text-sm font-medium text-[#5d7367] transition data-[state=active]:bg-white data-[state=active]:text-[#0c1a13] data-[state=active]:shadow-sm dark:text-[#8ba295] dark:data-[state=active]:bg-[#16291e] dark:data-[state=active]:text-white";

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Add agents" description="An agent's mobile number is their referral code. Adding a number that's already here updates that agent.">
      <Tabs.Root defaultValue={tab} onValueChange={() => setError("")}>
        <Tabs.List aria-label="How to add agents" className="flex gap-1 rounded-xl bg-[#eef3f0] p-1 dark:bg-[#08150f]">
          <Tabs.Trigger value="one" className={tabClass}>One agent</Tabs.Trigger>
          <Tabs.Trigger value="csv" className={tabClass}>Upload a CSV</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="one" className="mt-5 outline-none">
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void addOne(event.currentTarget); }}>
            <div>
              <label htmlFor="agent-name" className="text-sm font-medium">Full name</label>
              <input id="agent-name" name="name" required minLength={2} maxLength={80} autoComplete="off" autoFocus placeholder="e.g. Priya Nair" className={`${ui.input} mt-1.5`} />
            </div>
            <div>
              <label htmlFor="agent-mobile" className="text-sm font-medium">Mobile number</label>
              <div className="mt-1.5 flex rounded-xl focus-within:ring-4 focus-within:ring-emerald-600/10">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-[#d8e3dc] bg-[#f4f8f6] px-3 text-sm text-[#5d7367] dark:border-[#1a3526] dark:bg-[#12241a] dark:text-[#8ba295]">+91</span>
                <input
                  id="agent-mobile" name="mobile" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="off"
                  title="10-digit mobile number" placeholder="98765 00001" className={`${ui.input} rounded-l-none focus:ring-0`}
                />
              </div>
              <p className={`mt-1.5 text-xs ${ui.muted}`}>This becomes their referral code and goes into their QR code.</p>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className={ui.secondary}>Cancel</button>
              <button type="submit" disabled={busy} className={ui.primary}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <QrCode className="size-4" aria-hidden="true" />}
                {busy ? "Adding…" : "Add and create QR code"}
              </button>
            </div>
          </form>
        </Tabs.Content>

        <Tabs.Content value="csv" className="mt-5 space-y-4 outline-none">
          {result ? (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    {plural(result.added, "agent")} added{result.updated ? `, ${plural(result.updated, "agent")} updated` : ""}
                  </p>
                  <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-300/80">Their QR codes are ready in the list.</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">{plural(result.errors.length, "row")} skipped. Fix them in the file and upload it again:</p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-amber-900/90 dark:text-amber-200/90">
                    {result.errors.map((rowError) => <li key={rowError.row}>Row {rowError.row}: {rowError.message}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setResult(null); setFile(null); }} className={ui.secondary}>Upload another file</button>
                <button type="button" onClick={onClose} className={ui.primary}>Done</button>
              </div>
            </>
          ) : file ? (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-[#e1e9e4] p-3 dark:border-[#1a3526]">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <FileSpreadsheet className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className={`text-xs ${ui.muted}`}>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{plural(valid.length, "agent")} ready</span>
                    {invalid.length > 0 && <span className="text-red-700 dark:text-red-400"> · {plural(invalid.length, "row")} to fix</span>}
                  </p>
                </div>
                <button type="button" onClick={() => setFile(null)} className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40">Change</button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-[#e1e9e4] dark:border-[#1a3526]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#f6f8f7] text-xs text-[#5d7367] dark:bg-[#08150f] dark:text-[#8ba295]">
                    <tr><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Mobile</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef3f0] dark:divide-[#16291e]">
                    {file.rows.map((row) => (
                      <tr key={row.row} className={row.error ? "bg-red-50/60 dark:bg-red-950/20" : ""}>
                        <td className={`px-3 py-2 tabular-nums ${ui.muted}`}>{row.row}</td>
                        <td className="max-w-[10rem] px-3 py-2">
                          <span className="block truncate">{row.name || <span className={ui.muted}>—</span>}</span>
                          {row.error && <span className="mt-0.5 flex items-center gap-1 text-xs text-red-700 dark:text-red-400"><AlertCircle className="size-3" aria-hidden="true" />{row.error}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                          {row.error ? row.mobile || <span className={ui.muted}>—</span> : (
                            <span className="inline-flex items-center gap-1.5">{formatMobile(row.mobile)}<Check className="size-3.5 text-emerald-600" aria-label="OK" /></span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invalid.length > 0 && valid.length > 0 && <p className={`text-xs ${ui.muted}`}>Rows marked in red are skipped. The rest are added now.</p>}
              {error && <ErrorText>{error}</ErrorText>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} className={ui.secondary}>Cancel</button>
                <button type="button" disabled={busy || valid.length === 0} onClick={() => void importRows()} className={ui.primary}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {busy ? "Adding…" : valid.length ? `Add ${plural(valid.length, "agent")}` : "No rows to add"}
                </button>
              </div>
            </>
          ) : (
            <>
              <label
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files[0]); }}
                className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition focus-within:ring-4 focus-within:ring-emerald-600/15 ${
                  dragging ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30" : "border-[#d0ddd5] hover:border-emerald-400 hover:bg-[#f6faf8] dark:border-[#1f3a2b] dark:hover:bg-[#0f2017]"
                }`}
              >
                <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <UploadCloud className="size-6" aria-hidden="true" />
                </span>
                <span className="mt-3 text-sm font-semibold">Drop a CSV file here, or <span className="text-emerald-700 underline underline-offset-2 dark:text-emerald-400">choose one</span></span>
                <span className={`mt-1 text-xs ${ui.muted}`}>Two columns: name and mobile number. You&apos;ll see every row before anything is saved.</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { void readFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
              {error && <ErrorText>{error}</ErrorText>}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f8f7] px-3.5 py-3 text-sm dark:bg-[#08150f]">
                <span className={ui.muted}>Not sure of the format?</span>
                <a href={TEMPLATE} download="relive-agents-template.csv" className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                  <Download className="size-4" aria-hidden="true" /> Download template
                </a>
              </div>
            </>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </Modal>
  );
}

// ─── QR card ─────────────────────────────────────────────────────────────────

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

/** A printable / shareable card: Relive logo, the QR code, the agent's name and referral code. */
async function cardImage({ agent, image }: AgentQr) {
  const [code, logo] = await Promise.all([loadImage(image), loadImage("/relive-logo.svg")]);
  const font = getComputedStyle(document.body).fontFamily;
  const canvas = Object.assign(document.createElement("canvas"), { width: 1000, height: 1360 });
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 1000, 1360);
  c.fillStyle = "#047857";
  c.fillRect(0, 0, 1000, 14);
  c.drawImage(logo, 500 - 147, 80, 295, 84);
  c.textAlign = "center";
  c.fillStyle = "#0c1a13";
  c.font = `600 46px ${font}`;
  c.fillText("Scan to start your journey", 500, 270);
  c.strokeStyle = "#e1e9e4";
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(170, 320, 660, 660, 36);
  c.stroke();
  c.drawImage(code, 190, 340, 620, 620);
  c.fillStyle = "#0c1a13";
  c.font = `600 54px ${font}`;
  c.fillText(agent.name, 500, 1090, 860);
  c.fillStyle = "#5d7367";
  c.font = `36px ${font}`;
  c.fillText(`Referral code  ${formatMobile(agent.mobile)}`, 500, 1155, 860);
  c.fillStyle = "#8aa094";
  c.font = `30px ${font}`;
  c.fillText("relive.co.in", 500, 1290);
  return canvas.toDataURL("image/png");
}

const saveAs = (href: string, name: string) => Object.assign(document.createElement("a"), { href, download: name }).click();
const fileBase = (agent: Agent) => `${agent.name.replace(/[^a-z0-9]+/gi, "-")}-${agent.mobile.slice(-4)}`;

export function QrDialog({ qr, onClose }: { qr: AgentQr; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const { agent } = qr;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(qr.link);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  };

  const downloadCard = async () => {
    setSaving(true);
    try { saveAs(await cardImage(qr), `${fileBase(agent)}-QR-card.png`); }
    catch { toast.error("Couldn't create the card. Download the QR code instead."); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={`${agent.name}'s QR code`} description="Scanning it opens Relive's sign-up with this agent's referral code filled in and locked.">
      <div className="rounded-2xl border border-[#e1e9e4] bg-gradient-to-b from-[#f3f8f5] to-white p-5 text-center dark:border-[#1a3526] dark:from-[#0f2017] dark:to-[#0c1a12]">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
        <img src={qr.image} alt={`QR code for ${agent.name}`} className="mx-auto size-52 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5 sm:size-56" />
        <p className="mt-4 font-semibold">{agent.name}</p>
        <p className={`text-sm tabular-nums ${ui.muted}`}>Referral code {formatMobile(agent.mobile)}</p>
        {!agent.active && (
          <p className="mx-auto mt-3 max-w-xs rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            This agent is inactive. Reactivate them before sharing this code.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e1e9e4] p-1.5 pl-3 dark:border-[#1a3526]">
        <span className={`min-w-0 flex-1 truncate text-xs ${ui.muted}`} title={qr.link}>{qr.link}</span>
        <button type="button" onClick={() => void copy()} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#eef3f0] px-3 text-xs font-semibold text-[#0c1a13] transition hover:bg-[#e2ebe6] dark:bg-[#16291e] dark:text-white">
          {copied ? <Check className="size-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => saveAs(qr.image, `${fileBase(agent)}-QR.png`)} className={ui.secondary}>
          <QrCode className="size-4" aria-hidden="true" /> QR code only
        </button>
        <button type="button" disabled={saving} onClick={() => void downloadCard()} className={ui.primary}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          Download card
        </button>
      </div>
      <p className={`mt-2 text-center text-xs ${ui.muted}`}>The card adds the Relive logo, the agent&apos;s name and code: ready to print or share on WhatsApp.</p>
    </Modal>
  );
}

// ─── Change password ─────────────────────────────────────────────────────────

export function ChangePasswordDialog({ onClose, fail }: { onClose: () => void; fail: Fail }) {
  const [show, setShow] = useState({ current: false, next: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (form: HTMLFormElement) => {
    const values = new FormData(form);
    const next = String(values.get("next"));
    const checked = adminPasswordSchema.safeParse(next);
    if (!checked.success) return setError(`New password: ${checked.error.issues[0]?.message ?? "not allowed"}`);
    if (next !== values.get("confirm")) return setError("The new passwords don't match");
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/password", { current: values.get("current"), next });
      toast.success("Password changed. Anyone else signed in will need the new one.");
      onClose();
    } catch (requestError) {
      setError(apiErrorCode(requestError) === "ADMIN_CURRENT_PASSWORD_WRONG" ? "Your current password isn't right" : fail(requestError));
    } finally {
      setBusy(false);
    }
  };

  // The eye shows current and new; the confirm field stays hidden and is only checked against new.
  const field = (id: "current" | "next" | "confirm", label: string, hint?: string) => {
    const revealable = id !== "confirm";
    const visible = revealable && show[id];
    return (
      <div>
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <div className="relative mt-1.5">
          <input
            id={id} name={id} type={visible ? "text" : "password"} required maxLength={200} autoFocus={id === "current"}
            autoComplete={id === "current" ? "current-password" : "new-password"} minLength={id === "current" ? undefined : 8}
            onChange={() => error && setError("")} className={`${ui.input} ${revealable ? "pr-11" : ""}`}
          />
          {revealable && (
            <button
              type="button" onClick={() => setShow((value) => ({ ...value, [id]: !value[id] }))}
              aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}
              className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl ${ui.muted} hover:text-[#0c1a13] dark:hover:text-white`}
            >
              {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          )}
        </div>
        {hint && <p className={`mt-1.5 text-xs ${ui.muted}`}>{hint}</p>}
      </div>
    );
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Change the admin password" description="Everyone uses this one password. After you change it, anyone else signed in has to sign in again with the new one.">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        {field("current", "Current password")}
        {field("next", "New password", "At least 8 characters. A short sentence is easy to remember and hard to guess.")}
        {field("confirm", "New password again")}
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={ui.secondary}>Cancel</button>
          <button type="submit" disabled={busy} className={ui.primary}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} {busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export function DeleteDialog({ agent, onClose, onConfirm, onDeactivate }: {
  agent: Agent; onClose: () => void; onConfirm: () => Promise<void>; onDeactivate: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open onOpenChange={(open) => !open && onClose()} title={`Delete ${agent.name}?`}
      description="They're removed from this list and their QR code stops working. The users they referred keep their accounts."
    >
      {agent.referrals > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            {agent.name} has <strong>{plural(agent.referrals, "referral")}</strong>. Deleting hides them from this page, so they no longer
            count towards {agent.name.split(" ")[0]}&apos;s benefit.{agent.active ? " To keep the count, deactivate them instead." : ""}
          </p>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={ui.secondary}>Cancel</button>
        {agent.referrals > 0 && agent.active && (
          <button type="button" onClick={onDeactivate} className={ui.secondary}>Deactivate instead</button>
        )}
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }} className={ui.danger}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Delete agent
        </button>
      </div>
    </Modal>
  );
}

// ─── Deactivate ──────────────────────────────────────────────────────────────

export function DeactivateDialog({ agent, onClose, onConfirm }: { agent: Agent; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={`Deactivate ${agent.name}?`} description="Their number and QR code stop working as an agent's referral code. Their past referrals stay, and you can reactivate them at any time.">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={ui.secondary}>Keep active</button>
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }} className={ui.danger}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Deactivate
        </button>
      </div>
    </Modal>
  );
}
