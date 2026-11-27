"use client";

import {
  ArrowDownWideNarrow, Eye, EyeOff, KeyRound, Link2, Loader2, LogOut, MoreHorizontal, Plus, QrCode, Search, ShieldCheck, Trophy, Upload,
  UserCheck, Users, UserX, X,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  AddAgentsDialog, ChangePasswordDialog, DeactivateDialog, formatMobile, plural, QrDialog, ui, type Agent, type AgentQr,
} from "../../../components/agent-admin-dialogs";
import { api, apiErrorCode, apiMessage } from "../../../lib/api";

// Staff page for company agents (one shared password, stored hashed in the database; changed on this page): add agents one by one or from a
// CSV, share their QR codes, see who they referred, deactivate them. An agent's mobile number is their referral code.

type Filter = "all" | "active" | "inactive";
type Sort = "referrals" | "newest" | "name";

const CARD = "rounded-2xl border border-[#e1e9e4] bg-white shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]";
const added = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");

export default function AgentsAdminPage() {
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "off">("loading");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("referrals");
  const [adding, setAdding] = useState<"one" | "csv" | null>(null);
  const [qr, setQr] = useState<AgentQr | null>(null);
  const [deactivating, setDeactivating] = useState<Agent | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [busyId, setBusyId] = useState("");

  /** Handles an expired admin sign-in (back to the password screen) and returns the message to show. */
  const fail = useCallback((error: unknown) => {
    if (apiErrorCode(error) === "ADMIN_AUTH_REQUIRED") {
      setPhase("login");
      setAdding(null);
      setQr(null);
      setDeactivating(null);
      setChangingPassword(false);
      return "Your admin sign-in has ended. Please sign in again.";
    }
    return apiMessage(error);
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ agents: Agent[] }>("/admin/agents");
      setAgents(data.agents);
      setPhase("ready");
      return data.agents;
    } catch (error) {
      const code = apiErrorCode(error);
      if (code === "ADMIN_DISABLED") setPhase("off");
      else if (code === "ADMIN_AUTH_REQUIRED") setPhase("login");
      else { toast.error(apiMessage(error)); setPhase((current) => (current === "loading" ? "login" : current)); }
      return [];
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const fetchQr = async (agent: Agent) => (await api.get<{ link: string; image: string }>(`/admin/agents/${agent.id}/qr`)).data;

  const showQr = async (agent: Agent) => {
    setBusyId(agent.id);
    try { setQr({ agent, ...(await fetchQr(agent)) }); }
    catch (error) { toast.error(fail(error)); }
    finally { setBusyId(""); }
  };

  const copyLink = async (agent: Agent) => {
    try {
      await navigator.clipboard.writeText((await fetchQr(agent)).link);
      toast.success(`${agent.name}'s referral link copied`);
    } catch (error) { toast.error(fail(error)); }
  };

  const setActive = async (agent: Agent, active: boolean) => {
    try {
      await api.post(`/admin/agents/${agent.id}/active`, { active });
      await load(); // before the dialog closes, so the row never shows the old status
      setDeactivating(null);
      toast.success(active ? `${agent.name} is active again` : `${agent.name} deactivated`);
    } catch (error) { toast.error(fail(error)); }
  };

  const afterAdd = async (agentId: string) => {
    setAdding(null);
    const agent = (await load()).find((item) => item.id === agentId);
    if (agent) await showQr(agent);
  };

  const logout = async () => {
    await api.post("/admin/logout").catch(() => undefined);
    setAgents([]);
    setPhase("login");
  };

  const stats = useMemo(() => {
    const referrals = agents.reduce((sum, agent) => sum + agent.referrals, 0);
    const viaQr = agents.reduce((sum, agent) => sum + agent.viaQr, 0);
    const top = agents.reduce<Agent | null>((best, agent) => (agent.referrals > (best?.referrals ?? 0) ? agent : best), null);
    return { active: agents.filter((agent) => agent.active).length, referrals, viaQr, top };
  }, [agents]);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return agents
      .filter((agent) => filter === "all" || agent.active === (filter === "active"))
      .filter((agent) => !words || agent.name.toLowerCase().includes(words) || (digits.length > 0 && agent.mobile.includes(digits)))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name)
        : sort === "newest" ? b.createdAt.localeCompare(a.createdAt)
        : b.referrals - a.referrals || b.viaQr - a.viaQr || a.name.localeCompare(b.name));
  }, [agents, query, filter, sort]);

  if (phase === "loading" || phase === "login" || phase === "off") {
    return (
      <>
        <Toaster position="top-center" richColors />
        <SignIn phase={phase} onSignedIn={() => void load()} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-[#0c1a13] dark:bg-[#070e0a] dark:text-[#f0fdf4]">
      <Toaster position="top-center" richColors />
      <header className="sticky top-0 z-30 bg-[#07130c] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img src="/relive-logo-light.svg" alt="Relive" width={98} height={28} className="h-6 w-auto sm:h-7" />
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setChangingPassword(true)} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white">
              <KeyRound className="size-4" aria-hidden="true" /> <span className="max-sm:sr-only">Password</span>
            </button>
            <button type="button" onClick={() => void logout()} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white">
              <LogOut className="size-4" aria-hidden="true" /> <span className="max-sm:sr-only">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
            <p className={`mt-1 max-w-xl text-sm ${ui.muted}`}>
              Agents earn a benefit when people sign up with their number or QR code. Their mobile number is their referral code.
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" onClick={() => setAdding("csv")} className={`${ui.secondary} flex-1 sm:flex-none`}>
              <Upload className="size-4" aria-hidden="true" /> Upload CSV
            </button>
            <button type="button" onClick={() => setAdding("one")} className={`${ui.primary} flex-1 sm:flex-none`}>
              <Plus className="size-4" aria-hidden="true" /> Add agent
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat icon={UserCheck} label="Active agents" value={stats.active.toLocaleString("en-IN")} hint={`of ${plural(agents.length, "agent")} added`} />
          <Stat icon={Users} label="Users referred" value={stats.referrals.toLocaleString("en-IN")} hint="by all agents" />
          <Stat
            icon={QrCode} label="Via QR code" value={stats.viaQr.toLocaleString("en-IN")}
            hint={stats.referrals ? `${Math.round((stats.viaQr / stats.referrals) * 100)}% of referrals` : "No referrals yet"}
          />
          <Stat
            icon={Trophy} label="Top agent" value={stats.top?.name ?? "—"} small
            hint={stats.top ? `${plural(stats.top.referrals, "referral")}` : "No referrals yet"}
          />
        </dl>

        <section className={CARD} aria-label="Agent list">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Users className="size-7" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">No agents yet</h2>
              <p className={`mt-1 max-w-sm text-sm ${ui.muted}`}>Add your first agent to get their QR code, or upload a CSV to add your whole team at once.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setAdding("csv")} className={ui.secondary}><Upload className="size-4" aria-hidden="true" /> Upload CSV</button>
                <button type="button" onClick={() => setAdding("one")} className={ui.primary}><Plus className="size-4" aria-hidden="true" /> Add agent</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-[#eef3f0] p-4 sm:flex-row sm:items-center sm:p-5 dark:border-[#16291e]">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8aa094]" aria-hidden="true" />
                  <input
                    type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or number"
                    aria-label="Search agents" className={`${ui.input} h-10 pl-10`}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div role="radiogroup" aria-label="Show" className="flex min-w-0 flex-1 rounded-xl bg-[#eef3f0] p-1 dark:bg-[#08150f]">
                    {(["all", "active", "inactive"] as const).map((value) => {
                      const count = value === "all" ? agents.length : value === "active" ? stats.active : agents.length - stats.active;
                      return (
                        <button
                          key={value} type="button" role="radio" aria-checked={filter === value} onClick={() => setFilter(value)}
                          className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition sm:flex-none ${
                            filter === value ? "bg-white text-[#0c1a13] shadow-sm dark:bg-[#16291e] dark:text-white" : "text-[#5d7367] hover:text-[#0c1a13] dark:text-[#8ba295]"
                          }`}
                        >
                          {value} <span className="tabular-nums opacity-60">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="relative">
                    <span className="sr-only">Sort by</span>
                    <ArrowDownWideNarrow className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5d7367]" aria-hidden="true" />
                    <select
                      value={sort} onChange={(event) => setSort(event.target.value as Sort)}
                      className="h-10 appearance-none rounded-xl border border-[#d8e3dc] bg-white pl-9 pr-3 text-xs font-medium outline-none focus:border-emerald-600 dark:border-[#1a3526] dark:bg-[#08150f]"
                    >
                      <option value="referrals">Most referrals</option>
                      <option value="newest">Newest first</option>
                      <option value="name">Name A–Z</option>
                    </select>
                  </label>
                </div>
              </div>

              {shown.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-medium">No agents match{query ? ` “${query}”` : ""}</p>
                  <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                    <X className="size-3.5" aria-hidden="true" /> Clear search and filters
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop: table */}
                  <table className="hidden w-full text-left text-sm md:table">
                    <thead className={`text-xs ${ui.muted}`}>
                      <tr className="border-b border-[#eef3f0] dark:border-[#16291e]">
                        <th className="py-3 pl-5 pr-3 font-medium">Agent</th>
                        <th className="px-3 py-3 font-medium">Referral code</th>
                        <th className="px-3 py-3 text-right font-medium">Referred</th>
                        <th className="px-3 py-3 text-right font-medium">Via QR</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="py-3 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef3f0] dark:divide-[#16291e]">
                      {shown.map((agent) => (
                        <tr key={agent.id} className="transition hover:bg-[#f9fbfa] dark:hover:bg-[#0f2017]">
                          <td className="py-3 pl-5 pr-3"><AgentName agent={agent} /></td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatMobile(agent.mobile)}</td>
                          <td className="px-3 py-3 text-right text-base font-semibold tabular-nums">{agent.referrals.toLocaleString("en-IN")}</td>
                          <td className={`px-3 py-3 text-right tabular-nums ${ui.muted}`}>{agent.viaQr.toLocaleString("en-IN")}</td>
                          <td className="px-3 py-3"><Status active={agent.active} /></td>
                          <td className="py-3 pl-3 pr-5">
                            <Actions agent={agent} busy={busyId === agent.id} onQr={showQr} onCopy={copyLink} onDeactivate={setDeactivating} onReactivate={(a) => void setActive(a, true)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Phones: cards */}
                  <ul className="divide-y divide-[#eef3f0] md:hidden dark:divide-[#16291e]">
                    {shown.map((agent) => (
                      <li key={agent.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <AgentName agent={agent} />
                          <Status active={agent.active} />
                        </div>
                        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f6f8f7] p-3 text-center dark:bg-[#08150f]">
                          <div><dt className={`text-[11px] ${ui.muted}`}>Referred</dt><dd className="font-semibold tabular-nums">{agent.referrals}</dd></div>
                          <div><dt className={`text-[11px] ${ui.muted}`}>Via QR</dt><dd className="font-semibold tabular-nums">{agent.viaQr}</dd></div>
                          <div><dt className={`text-[11px] ${ui.muted}`}>Code</dt><dd className="truncate text-xs font-medium tabular-nums leading-6">{agent.mobile}</dd></div>
                        </dl>
                        <div className="mt-3"><Actions agent={agent} busy={busyId === agent.id} onQr={showQr} onCopy={copyLink} onDeactivate={setDeactivating} onReactivate={(a) => void setActive(a, true)} wide /></div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>

        <p className={`flex items-start gap-2 text-xs ${ui.muted}`}>
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          Sign-ins and every change on this page are recorded. Deactivated agents keep their past referrals.
        </p>
      </main>

      {adding && (
        <AddAgentsDialog tab={adding} fail={fail} onClose={() => setAdding(null)} onAdded={(id) => void afterAdd(id)} onImported={() => void load()} />
      )}
      {qr && <QrDialog qr={qr} onClose={() => setQr(null)} />}
      {changingPassword && <ChangePasswordDialog fail={fail} onClose={() => setChangingPassword(false)} />}
      {deactivating && <DeactivateDialog agent={deactivating} onClose={() => setDeactivating(null)} onConfirm={() => setActive(deactivating, false)} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, small }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string; small?: boolean }) {
  return (
    <div className={`${CARD} min-w-0 p-4 sm:p-5`}>
      <dt className={`flex items-center justify-between gap-2 text-xs ${ui.muted}`}>
        {label}
        <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"><Icon className="size-3.5" /></span>
      </dt>
      <dd className={`mt-2 truncate font-semibold tracking-tight tabular-nums ${small ? "text-base sm:text-lg" : "text-2xl"}`} title={value}>{value}</dd>
      <p className="mt-0.5 truncate text-xs text-[#8aa094] dark:text-[#688274]">{hint}</p>
    </div>
  );
}

function AgentName({ agent }: { agent: Agent }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${agent.active ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-[#eef3f0] text-[#8aa094] dark:bg-[#16291e]"}`} aria-hidden="true">
        {initials(agent.name)}
      </span>
      <div className="min-w-0">
        <p className={`truncate font-medium ${agent.active ? "" : "text-[#5d7367] dark:text-[#8ba295]"}`}>{agent.name}</p>
        <p className="text-xs text-[#8aa094] dark:text-[#688274]">Added {added(agent.createdAt)}</p>
      </div>
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef3f0] px-2.5 py-1 text-xs font-medium text-[#5d7367] dark:bg-[#16291e] dark:text-[#8ba295]">
      <span className="size-1.5 rounded-full bg-[#9aaea3]" aria-hidden="true" /> Inactive
    </span>
  );
}

function Actions({ agent, busy, onQr, onCopy, onDeactivate, onReactivate, wide }: {
  agent: Agent; busy: boolean; wide?: boolean;
  onQr: (agent: Agent) => void; onCopy: (agent: Agent) => void; onDeactivate: (agent: Agent) => void; onReactivate: (agent: Agent) => void;
}) {
  const item = "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-[#f2f6f4] dark:data-[highlighted]:bg-[#16291e]";
  return (
    <div className={`flex items-center gap-1.5 ${wide ? "" : "justify-end"}`}>
      <button type="button" disabled={busy} onClick={() => onQr(agent)} className={`${ui.secondary} h-9 px-3 text-xs ${wide ? "flex-1" : ""}`}>
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <QrCode className="size-3.5" aria-hidden="true" />} QR code
      </button>
      {!agent.active && (
        <button type="button" onClick={() => onReactivate(agent)} className={`${ui.secondary} h-9 px-3 text-xs ${wide ? "flex-1" : ""}`}>Reactivate</button>
      )}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger aria-label={`More actions for ${agent.name}`} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#5d7367] transition hover:bg-[#eef3f0] hover:text-[#0c1a13] data-[state=open]:bg-[#eef3f0] dark:hover:bg-[#16291e] dark:hover:text-white dark:data-[state=open]:bg-[#16291e]">
          <MoreHorizontal className="size-4" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-xl border border-[#e1e9e4] bg-white p-1 text-[#0c1a13] shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:border-[#1a3526] dark:bg-[#0c1a12] dark:text-white">
            <DropdownMenu.Item className={item} onSelect={() => onQr(agent)}><QrCode className="size-4 text-[#5d7367]" /> Show QR code</DropdownMenu.Item>
            <DropdownMenu.Item className={item} onSelect={() => onCopy(agent)}><Link2 className="size-4 text-[#5d7367]" /> Copy referral link</DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-[#eef3f0] dark:bg-[#16291e]" />
            {agent.active ? (
              <DropdownMenu.Item className={`${item} text-red-700 data-[highlighted]:bg-red-50 dark:text-red-400 dark:data-[highlighted]:bg-red-950/40`} onSelect={() => onDeactivate(agent)}>
                <UserX className="size-4" /> Deactivate
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item className={item} onSelect={() => onReactivate(agent)}><UserCheck className="size-4 text-[#5d7367]" /> Reactivate</DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function SignIn({ phase, onSignedIn }: { phase: "loading" | "login" | "off"; onSignedIn: () => void }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (form: HTMLFormElement) => {
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/login", { password: new FormData(form).get("password") });
      onSignedIn();
    } catch (requestError) {
      setError(apiErrorCode(requestError) === "ADMIN_PASSWORD_WRONG" ? "That password isn't right. Check it and try again." : apiMessage(requestError));
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07130c] px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" aria-hidden="true" />
      <div className="relative w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
        <img src="/relive-logo-light.svg" alt="Relive" width={98} height={28} className="mx-auto h-8 w-auto" />
        <div className="mt-8 rounded-2xl bg-white p-6 text-[#0c1a13] shadow-2xl sm:p-7 dark:bg-[#0c1a12] dark:text-white">
          {phase === "loading" ? (
            <div className="flex h-48 items-center justify-center" aria-busy="true" aria-label="Loading">
              <Loader2 className="size-6 animate-spin text-emerald-600" />
            </div>
          ) : phase === "off" ? (
            <div className="py-2 text-center">
              <h1 className="text-lg font-semibold">No admin password yet</h1>
              <p className={`mt-1.5 text-sm ${ui.muted}`}>
                Ask a developer to set one with <code className="rounded bg-[#eef3f0] px-1 py-0.5 text-xs dark:bg-[#16291e]">npm run admin-password -w backend</code>
              </p>
            </div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Agents admin</h1>
              <p className={`mt-1 text-sm ${ui.muted}`}>Add company agents, share their QR codes and see who they bring to Relive.</p>
              <label htmlFor="password" className="mt-6 block text-sm font-medium">Admin password</label>
              <div className="relative mt-1.5">
                <input
                  id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required autoFocus
                  aria-invalid={error ? true : undefined} aria-describedby={error ? "password-error" : undefined}
                  onChange={() => error && setError("")} className={`${ui.input} pr-11`}
                />
                <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#5d7367] hover:bg-[#f2f6f4] dark:hover:bg-[#12241a]">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {error && <p id="password-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
              <button type="submit" disabled={busy} className={`${ui.primary} mt-5 h-11 w-full`}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-white/40">For Relive staff only. Sign-ins are recorded.</p>
      </div>
    </div>
  );
}
