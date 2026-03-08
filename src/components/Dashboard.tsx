"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
} from "date-fns";
import {
  buildCalendarDays,
  calculateBurnoutMetrics,
  calculateConsistencyScore,
  canConnectProvider,
  canCreateEpisode,
  canCreateShow,
  dayKey,
  defaultSchedulerState,
  detectConflicts,
  exportEpisodesToIcs,
  formatPlanPrice,
  generateEpisodeAnalytics,
  generateTimeBlocks,
  parseIcsEvents,
  parseStoredState,
  PIPELINE_STAGES,
  STAGE_COLORS,
  supportsPremiumTheme,
  THEME_ACCENTS,
} from "@/lib/scheduler";
import {
  generateCoHostResponse,
  generateEpisodeOutline,
  generateGuestResearch,
  generateTranscriptClips,
  generateTrendingTopics,
  predictContentPerformance,
  suggestBestPublishTimes,
} from "@/lib/ai";
import type {
  AIEpisodeOutline,
  BillingCycle,
  CalendarProvider,
  CoHostMessage,
  ContentEdge,
  ContentNode,
  DashboardView,
  Episode,
  EpisodeStatus,
  Guest,
  GuestResearch,
  PlanTier,
  SchedulerState,
  Season,
  Show,
  SocialPost,
  ThemePreset,
  TranscriptClip,
  TrendingTopic,
} from "@/types/scheduler";

const STORAGE_KEY = "podflow.scheduler.v2";

const providerLabels: Record<CalendarProvider, string> = {
  google: "Google Calendar",
  outlook: "Microsoft Outlook",
  apple: "Apple Calendar",
};

const NAV_ITEMS: { key: DashboardView; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "episodes", label: "Episodes", icon: "🎙️" },
  { key: "calendar", label: "Calendar", icon: "📅" },
  { key: "pipeline", label: "Pipeline", icon: "🔄" },
  { key: "ai-studio", label: "AI Studio", icon: "🤖" },
  { key: "guests", label: "Guests", icon: "👥" },
  { key: "seasons", label: "Seasons", icon: "🗓️" },
  { key: "analytics", label: "Analytics", icon: "📈" },
  { key: "integrations", label: "Integrations", icon: "🌐" },
  { key: "content-graph", label: "Content Graph", icon: "🕸️" },
  { key: "trending", label: "Trending", icon: "🔥" },
  { key: "health", label: "Health", icon: "💚" },
  { key: "settings", label: "Settings", icon: "⚙️" },
];

const themeOptions: ThemePreset[] = ["indigo", "emerald", "rose", "amber"];
const statusOptions: EpisodeStatus[] = ["idea", "planned", "scheduled", "recording", "editing", "review", "ready", "published"];

function formatDateTimeInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function Dashboard() {
  const [state, setState] = useState<SchedulerState>(defaultSchedulerState);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<DashboardView>("overview");
  const [statusMessage, setStatusMessage] = useState("");
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [episodeDraft, setEpisodeDraft] = useState({
    title: "", guest: "", description: "",
    publishAt: formatDateTimeInput(new Date(Date.now() + 86_400_000)),
    durationMinutes: "45", status: "scheduled" as EpisodeStatus,
    platforms: "Spotify,Apple Podcasts", tags: "", notes: "",
  });

  const [aiTopic, setAiTopic] = useState("");
  const [aiOutline, setAiOutline] = useState<AIEpisodeOutline | null>(null);
  const [guestSearchName, setGuestSearchName] = useState("");
  const [guestResearch, setGuestResearch] = useState<GuestResearch | null>(null);
  const [clipEpisodeId, setClipEpisodeId] = useState("");
  const [clips, setClips] = useState<TranscriptClip[]>([]);
  const [coHostInput, setCoHostInput] = useState("");
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);

  const [guestDraft, setGuestDraft] = useState({ name: "", email: "", phone: "", bio: "", company: "", role: "", notes: "", tags: "" });
  const [showDraft, setShowDraft] = useState({ name: "", description: "", coverColor: "#4f46e5" });
  const [seasonDraft, setSeasonDraft] = useState({ name: "", theme: "", description: "", storyArc: "", startDate: "", endDate: "", number: "1" });
  const [socialDraft, setSocialDraft] = useState({ episodeId: "", platform: "x" as SocialPost["platform"], content: "", scheduledAt: formatDateTimeInput(new Date(Date.now() + 86_400_000)) });

  const [draggedEpisodeId, setDraggedEpisodeId] = useState<string | null>(null);

  const [integrationDrafts, setIntegrationDrafts] = useState<Record<CalendarProvider, { accountLabel: string; icsUrl: string }>>({
    google: { accountLabel: "", icsUrl: "" }, outlook: { accountLabel: "", icsUrl: "" }, apple: { accountLabel: "", icsUrl: "" },
  });

  useEffect(() => {
    const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
    if (stored.customization.timezone === "UTC") {
      stored.customization.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const accentColor = THEME_ACCENTS[state.customization.theme];
  const activeShow = state.shows.find((s) => s.id === state.activeShowId) || state.shows[0];
  const showEpisodes = useMemo(() => state.episodes.filter((ep) => ep.showId === state.activeShowId), [state.episodes, state.activeShowId]);
  const canCreate = canCreateEpisode(state.plan, state.episodes);
  const calendarDays = buildCalendarDays(currentMonth, state.customization.weekStartsOn);
  const weekdayLabels = state.customization.weekStartsOn === 1
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarEventsByDay = useMemo(() => {
    const items = [
      ...state.episodes.map((ep) => ({ id: ep.id, title: ep.title, start: new Date(ep.publishAt), kind: "episode" as const, status: ep.status })),
      ...state.importedEvents.map((ev) => ({ id: ev.id, title: ev.title, start: new Date(ev.start), kind: "external" as const, status: "" as EpisodeStatus })),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = dayKey(item.start);
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [state.episodes, state.importedEvents]);

  const conflicts = useMemo(() => detectConflicts(state.episodes, state.timeBlocks), [state.episodes, state.timeBlocks]);
  const consistency = useMemo(() => calculateConsistencyScore(state.episodes), [state.episodes]);
  const burnout = useMemo(() => calculateBurnoutMetrics(state.episodes), [state.episodes]);

  const contentGraph = useMemo(() => {
    const nodes: ContentNode[] = [];
    const edges: ContentEdge[] = [];
    const topicSet = new Set<string>();

    state.episodes.forEach((ep, i) => {
      const angle = (i / Math.max(state.episodes.length, 1)) * 2 * Math.PI;
      nodes.push({ id: ep.id, type: "episode", label: ep.title || "Untitled", x: 400 + Math.cos(angle) * 200, y: 300 + Math.sin(angle) * 200 });
      ep.tags.forEach((tag) => {
        if (!topicSet.has(tag)) {
          topicSet.add(tag);
          const ta = (topicSet.size / 10) * 2 * Math.PI;
          nodes.push({ id: `topic_${tag}`, type: "topic", label: tag, x: 400 + Math.cos(ta) * 120, y: 300 + Math.sin(ta) * 120 });
        }
        edges.push({ from: ep.id, to: `topic_${tag}` });
      });
    });
    state.guests.forEach((g, i) => {
      const angle = (i / Math.max(state.guests.length, 1)) * 2 * Math.PI + 0.5;
      nodes.push({ id: g.id, type: "guest", label: g.name, x: 400 + Math.cos(angle) * 280, y: 300 + Math.sin(angle) * 280 });
      g.episodeIds.forEach((eid) => edges.push({ from: g.id, to: eid }));
    });
    return { nodes, edges };
  }, [state.episodes, state.guests]);

  function flash(msg: string) { setStatusMessage(msg); setTimeout(() => setStatusMessage(""), 4000); }

  function updatePlan(plan: PlanTier) { setState((prev) => ({ ...prev, plan })); }

  async function handleCheckout(cycle: BillingCycle) {
    try {
      setIsCheckingOut(true);
      const res = await fetch("/api/subscription/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycle }),
      });
      if (!res.ok) throw new Error("Unable to start checkout.");
      const data = (await res.json()) as { mode: "stripe" | "demo"; url?: string };
      if (data.mode === "stripe" && data.url) { window.location.href = data.url; return; }
      setState((prev) => ({ ...prev, plan: "pro", billingCycle: cycle }));
      flash(`Pro plan unlocked in demo mode (${formatPlanPrice(cycle)}).`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Checkout failed.");
    } finally { setIsCheckingOut(false); }
  }

  function handleEpisodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) { flash("Free limit reached. Upgrade to Pro for unlimited."); return; }
    const publishDate = new Date(episodeDraft.publishAt);
    if (Number.isNaN(publishDate.getTime())) { flash("Invalid publish date."); return; }
    if (!episodeDraft.title.trim()) { flash("Title is required."); return; }

    const newEp: Episode = {
      id: `ep_${crypto.randomUUID()}`, showId: state.activeShowId,
      title: episodeDraft.title.trim(), guest: episodeDraft.guest.trim(),
      description: episodeDraft.description.trim(), publishAt: publishDate.toISOString(),
      durationMinutes: Number(episodeDraft.durationMinutes) || 45,
      status: episodeDraft.status, platforms: episodeDraft.platforms.split(",").map((p) => p.trim()).filter(Boolean),
      tags: episodeDraft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: episodeDraft.notes.trim(),
    };

    const blocks = generateTimeBlocks(newEp);
    setState((prev) => ({
      ...prev, episodes: [...prev.episodes, newEp],
      timeBlocks: [...prev.timeBlocks, ...blocks],
    }));
    setEpisodeDraft((prev) => ({ ...prev, title: "", guest: "", description: "", tags: "", notes: "", publishAt: formatDateTimeInput(new Date(Date.now() + 86_400_000)) }));
    flash("Episode scheduled with auto time blocks.");
  }

  function deleteEpisode(id: string) {
    setState((prev) => ({
      ...prev, episodes: prev.episodes.filter((ep) => ep.id !== id),
      timeBlocks: prev.timeBlocks.filter((tb) => tb.episodeId !== id),
    }));
    flash("Episode deleted.");
  }

  function updateEpisodeStatus(id: string, status: EpisodeStatus) {
    setState((prev) => ({
      ...prev, episodes: prev.episodes.map((ep) => ep.id === id ? { ...ep, status } : ep),
    }));
  }

  function moveEpisodeToDate(episodeId: string, newDateKey: string) {
    setState((prev) => ({
      ...prev,
      episodes: prev.episodes.map((ep) => {
        if (ep.id !== episodeId) return ep;
        const old = new Date(ep.publishAt);
        const parts = newDateKey.split("-");
        const newDate = new Date(old);
        newDate.setFullYear(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return { ...ep, publishAt: newDate.toISOString() };
      }),
    }));
    flash("Episode moved.");
  }

  function addGuest(e: FormEvent) {
    e.preventDefault();
    if (!guestDraft.name.trim()) { flash("Guest name required."); return; }
    const g: Guest = {
      id: `guest_${crypto.randomUUID()}`, name: guestDraft.name.trim(),
      email: guestDraft.email.trim(), phone: guestDraft.phone.trim(),
      bio: guestDraft.bio.trim(), company: guestDraft.company.trim(),
      role: guestDraft.role.trim(), notes: guestDraft.notes.trim(),
      bookingStatus: "potential", episodeIds: [],
      tags: guestDraft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      socialLinks: [], releaseFormSigned: false, createdAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, guests: [...prev.guests, g] }));
    setGuestDraft({ name: "", email: "", phone: "", bio: "", company: "", role: "", notes: "", tags: "" });
    flash("Guest added.");
  }

  function updateGuestBooking(id: string, status: Guest["bookingStatus"]) {
    setState((prev) => ({ ...prev, guests: prev.guests.map((g) => g.id === id ? { ...g, bookingStatus: status } : g) }));
  }

  function toggleReleaseForm(id: string) {
    setState((prev) => ({ ...prev, guests: prev.guests.map((g) => g.id === id ? { ...g, releaseFormSigned: !g.releaseFormSigned } : g) }));
  }

  function addShow(e: FormEvent) {
    e.preventDefault();
    if (!canCreateShow(state.plan, state.shows)) { flash("Upgrade to Pro for multi-show management."); return; }
    if (!showDraft.name.trim()) { flash("Show name required."); return; }
    const s: Show = {
      id: `show_${crypto.randomUUID()}`, name: showDraft.name.trim(),
      description: showDraft.description.trim(), coverColor: showDraft.coverColor, createdAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, shows: [...prev.shows, s], activeShowId: s.id }));
    setShowDraft({ name: "", description: "", coverColor: "#4f46e5" });
    flash("Show created.");
  }

  function addSeason(e: FormEvent) {
    e.preventDefault();
    if (!seasonDraft.name.trim()) { flash("Season name required."); return; }
    const s: Season = {
      id: `season_${crypto.randomUUID()}`, showId: state.activeShowId,
      number: Number(seasonDraft.number) || 1, name: seasonDraft.name.trim(),
      theme: seasonDraft.theme.trim(), description: seasonDraft.description.trim(),
      storyArc: seasonDraft.storyArc.trim(), startDate: seasonDraft.startDate, endDate: seasonDraft.endDate,
      episodeIds: [], guestRoadmap: [],
    };
    setState((prev) => ({ ...prev, seasons: [...prev.seasons, s] }));
    setSeasonDraft({ name: "", theme: "", description: "", storyArc: "", startDate: "", endDate: "", number: String((state.seasons.length || 0) + 1) });
    flash("Season created.");
  }

  function addSocialPost(e: FormEvent) {
    e.preventDefault();
    if (!socialDraft.content.trim()) { flash("Content required."); return; }
    const p: SocialPost = {
      id: `social_${crypto.randomUUID()}`, episodeId: socialDraft.episodeId,
      platform: socialDraft.platform, content: socialDraft.content.trim(),
      scheduledAt: new Date(socialDraft.scheduledAt).toISOString(), status: "scheduled",
    };
    setState((prev) => ({ ...prev, socialPosts: [...prev.socialPosts, p] }));
    setSocialDraft((prev) => ({ ...prev, content: "" }));
    flash("Social post scheduled.");
  }

  function toggleEquipment(id: string) {
    setState((prev) => ({
      ...prev, equipmentChecklist: prev.equipmentChecklist.map((eq) => eq.id === id ? { ...eq, checked: !eq.checked } : eq),
    }));
  }

  function togglePublishingTarget(platform: string) {
    setState((prev) => ({
      ...prev, publishingTargets: prev.publishingTargets.map((t) =>
        t.platform === platform ? { ...t, connected: !t.connected } : t
      ),
    }));
  }

  function publishToTarget(platform: string, episodeId: string) {
    setState((prev) => ({
      ...prev, publishingTargets: prev.publishingTargets.map((t) =>
        t.platform === platform ? { ...t, lastPublishedAt: new Date().toISOString() } : t
      ),
      episodes: prev.episodes.map((ep) => ep.id === episodeId ? { ...ep, status: "published" as EpisodeStatus } : ep),
    }));
    flash(`Published to ${platform}!`);
  }

  function exportIcs() {
    const ics = exportEpisodesToIcs(state.episodes);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "podflow-schedule.ics"; a.click();
    URL.revokeObjectURL(url);
  }

  async function connectCalendar(provider: CalendarProvider) {
    const draft = integrationDrafts[provider];
    if (!canConnectProvider(state.plan, state.integrations)) {
      flash("Free plan supports 1 calendar. Upgrade to unlock all.");
      return;
    }
    let importedCount = 0;
    if (draft.icsUrl.trim()) {
      const res = await fetch("/api/calendar/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: draft.icsUrl.trim() }),
      });
      if (!res.ok) { flash("Could not import ICS feed."); return; }
      const payload = (await res.json()) as { content: string };
      const imported = parseIcsEvents(payload.content, provider);
      importedCount = imported.length;
      setState((prev) => ({ ...prev, importedEvents: [...prev.importedEvents.filter((ev) => ev.source !== provider), ...imported] }));
    }
    const account = draft.accountLabel.trim() || providerLabels[provider];
    setState((prev) => ({
      ...prev, integrations: prev.integrations.map((i) =>
        i.provider === provider ? { ...i, connected: true, accountLabel: account, lastSyncAt: new Date().toISOString() } : i
      ),
    }));
    flash(importedCount > 0 ? `Connected ${providerLabels[provider]} with ${importedCount} events.` : `Connected ${providerLabels[provider]}.`);
  }

  function sendCoHostMessage(e: FormEvent) {
    e.preventDefault();
    if (!coHostInput.trim()) return;
    const userMsg: CoHostMessage = { id: `msg_${crypto.randomUUID()}`, role: "user", content: coHostInput.trim(), timestamp: new Date().toISOString() };
    const response = generateCoHostResponse(coHostInput);
    setState((prev) => ({ ...prev, coHostMessages: [...prev.coHostMessages, userMsg, response] }));
    setCoHostInput("");
  }

  const coHostEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { coHostEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state.coHostMessages]);

  function requestNotifications() {
    if (!("Notification" in window)) { flash("Browser doesn't support notifications."); return; }
    window.Notification.requestPermission().then((p) => {
      setState((prev) => ({ ...prev, notificationPreferences: { ...prev.notificationPreferences, browserEnabled: p === "granted" } }));
      flash(p === "granted" ? "Notifications enabled." : "Notifications denied.");
    });
  }

  if (!hydrated) return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading PodFlow...</div>;

  const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const btnPrimary = "rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
  const btnSecondary = "rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50";
  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
  const labelCls = "block text-xs font-semibold uppercase text-slate-500 mb-1";

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900" style={{ ["--accent" as string]: accentColor }}>
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-14"} shrink-0 border-r border-slate-200 bg-white transition-all duration-200 flex flex-col`}>
        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--accent)] text-sm font-bold text-white shrink-0">P</div>
          {sidebarOpen && <span className="text-sm font-bold truncate">PodFlow</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto text-slate-400 hover:text-slate-700 text-xs shrink-0">{sidebarOpen ? "◀" : "▶"}</button>
        </div>
        {sidebarOpen && state.shows.length > 1 && (
          <div className="border-b border-slate-100 p-2">
            <select value={state.activeShowId} onChange={(e) => setState((prev) => ({ ...prev, activeShowId: e.target.value }))} className="w-full rounded border border-slate-200 px-2 py-1 text-xs">
              {state.shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button key={item.key} onClick={() => setView(item.key)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${view === item.key ? "bg-[color:var(--accent)]/10 font-medium text-[color:var(--accent)]" : "text-slate-600 hover:bg-slate-50"}`}>
              <span className="text-base shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="border-t border-slate-100 p-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold uppercase">{state.plan}</span> plan
              {state.plan === "free" && <button onClick={() => setView("settings")} className="ml-1 text-[color:var(--accent)] underline">Upgrade</button>}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold capitalize">{view.replace("-", " ")}</h1>
            {activeShow && <p className="text-xs text-slate-500">{activeShow.name}</p>}
          </div>
          <div className="flex items-center gap-3">
            {statusMessage && <p className="text-sm text-[color:var(--accent)] animate-pulse">{statusMessage}</p>}
            <button onClick={exportIcs} className={btnSecondary}>Export ICS</button>
          </div>
        </header>

        <div className="p-6 max-w-[1400px] mx-auto">
          {view === "overview" && <OverviewPanel state={state} showEpisodes={showEpisodes} consistency={consistency} burnout={burnout} conflicts={conflicts} setView={setView} />}
          {view === "episodes" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">Schedule Episode</h2>
                <p className="text-sm text-slate-500 mb-4">{canCreate ? "Add a new episode." : "Free limit reached."}</p>
                <form className="space-y-3" onSubmit={handleEpisodeSubmit}>
                  <input required value={episodeDraft.title} onChange={(e) => setEpisodeDraft((p) => ({ ...p, title: e.target.value }))} placeholder="Episode title" className={inputCls} />
                  <input value={episodeDraft.guest} onChange={(e) => setEpisodeDraft((p) => ({ ...p, guest: e.target.value }))} placeholder="Guest (optional)" className={inputCls} />
                  <textarea value={episodeDraft.description} onChange={(e) => setEpisodeDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Description / talking points" className={`${inputCls} h-20`} />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="datetime-local" required value={episodeDraft.publishAt} onChange={(e) => setEpisodeDraft((p) => ({ ...p, publishAt: e.target.value }))} className={inputCls} />
                    <input type="number" value={episodeDraft.durationMinutes} onChange={(e) => setEpisodeDraft((p) => ({ ...p, durationMinutes: e.target.value }))} className={inputCls} placeholder="Duration (min)" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={episodeDraft.status} onChange={(e) => setEpisodeDraft((p) => ({ ...p, status: e.target.value as EpisodeStatus }))} className={inputCls}>
                      {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input value={episodeDraft.platforms} onChange={(e) => setEpisodeDraft((p) => ({ ...p, platforms: e.target.value }))} placeholder="Platforms" className={inputCls} />
                  </div>
                  <input value={episodeDraft.tags} onChange={(e) => setEpisodeDraft((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma separated)" className={inputCls} />
                  <textarea value={episodeDraft.notes} onChange={(e) => setEpisodeDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Internal notes" className={`${inputCls} h-16`} />
                  <button type="submit" disabled={!canCreate} className={`w-full ${btnPrimary}`}>Save Episode</button>
                </form>
              </div>
              <div className={card}>
                <h2 className="text-lg font-semibold mb-4">All Episodes ({showEpisodes.length})</h2>
                <div className="max-h-[600px] space-y-2 overflow-auto">
                  {showEpisodes.length === 0 && <p className="text-sm text-slate-500">No episodes yet.</p>}
                  {[...showEpisodes].sort((a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime()).map((ep) => (
                    <div key={ep.id} className="rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{ep.title}</p>
                          <p className="text-xs text-slate-500">{format(parseISO(ep.publishAt), "MMM d, yyyy HH:mm")} · {ep.durationMinutes}min</p>
                          {ep.guest && <p className="text-xs text-slate-400">Guest: {ep.guest}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase text-white" style={{ backgroundColor: STAGE_COLORS[ep.status] || "#94a3b8" }}>{ep.status}</span>
                          <button onClick={() => deleteEpisode(ep.id)} className="text-xs text-red-400 hover:text-red-600 ml-1">✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === "calendar" && (
            <div className={card}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Calendar</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentMonth((p) => addMonths(p, -1))} className={btnSecondary}>Prev</button>
                  <p className="w-36 text-center text-sm font-medium">{format(currentMonth, "MMMM yyyy")}</p>
                  <button onClick={() => setCurrentMonth((p) => addMonths(p, 1))} className={btnSecondary}>Next</button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">Drag and drop episodes between days to reschedule.</p>
              <div className="grid grid-cols-7 gap-1 text-xs font-semibold uppercase text-slate-500 mb-1">
                {weekdayLabels.map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const key = dayKey(day);
                  const events = calendarEventsByDay.get(key) ?? [];
                  return (
                    <div key={day.toISOString()}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-[color:var(--accent)]"); }}
                      onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-[color:var(--accent)]"); }}
                      onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("ring-2", "ring-[color:var(--accent)]"); if (draggedEpisodeId) { moveEpisodeToDate(draggedEpisodeId, key); setDraggedEpisodeId(null); } }}
                      className={`min-h-24 rounded-xl border p-1.5 transition-all ${isSameMonth(day, currentMonth) ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"} ${isToday(day) ? "ring-2 ring-[color:var(--accent)]" : ""}`}>
                      <p className="text-xs font-semibold text-slate-500">{format(day, "d")}</p>
                      <div className="mt-0.5 space-y-0.5">
                        {events.slice(0, 3).map((ev) => (
                          <div key={ev.id} draggable={ev.kind === "episode"}
                            onDragStart={() => { if (ev.kind === "episode") setDraggedEpisodeId(ev.id); }}
                            className={`rounded px-1 py-0.5 text-[10px] truncate cursor-move ${ev.kind === "episode" ? "bg-[color:var(--accent)]/15 text-slate-900 font-medium" : "bg-slate-100 text-slate-600"}`}>
                            {format(ev.start, "HH:mm")} {ev.title}
                          </div>
                        ))}
                        {events.length > 3 && <p className="text-[9px] text-slate-400">+{events.length - 3} more</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "pipeline" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Production Pipeline</h2>
              <p className="text-sm text-slate-500 mb-4">Drag episodes across stages or use the dropdown to update status.</p>
              <div className="flex gap-3 overflow-x-auto pb-4">
                {PIPELINE_STAGES.map((stage) => {
                  const eps = showEpisodes.filter((ep) => ep.status === stage);
                  return (
                    <div key={stage} className="min-w-[200px] flex-1 rounded-2xl border border-slate-200 bg-white p-3"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); if (draggedEpisodeId) { updateEpisodeStatus(draggedEpisodeId, stage); setDraggedEpisodeId(null); } }}>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                        <h3 className="text-sm font-semibold capitalize">{stage}</h3>
                        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium">{eps.length}</span>
                      </div>
                      <div className="space-y-2">
                        {eps.map((ep) => (
                          <div key={ep.id} draggable onDragStart={() => setDraggedEpisodeId(ep.id)}
                            className="cursor-move rounded-xl border border-slate-200 bg-slate-50 p-2.5 hover:shadow-sm transition-shadow">
                            <p className="text-sm font-medium truncate">{ep.title}</p>
                            <p className="text-[10px] text-slate-500">{format(parseISO(ep.publishAt), "MMM d")} · {ep.durationMinutes}m</p>
                            {ep.guest && <p className="text-[10px] text-slate-400">{ep.guest}</p>}
                          </div>
                        ))}
                        {eps.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Drop here</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "ai-studio" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* AI Episode Planning */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">AI Episode Planning</h2>
                <p className="text-xs text-slate-500 mb-3">Enter a topic to generate an outline, segments, and title suggestions.</p>
                <div className="flex gap-2 mb-4">
                  <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Future of Remote Work" className={inputCls} />
                  <button onClick={() => { if (aiTopic.trim()) setAiOutline(generateEpisodeOutline(aiTopic)); }} className={btnPrimary}>Generate</button>
                </div>
                {aiOutline && (
                  <div className="space-y-3 text-sm">
                    <div><p className={labelCls}>Suggested Title</p><p className="font-medium">{aiOutline.title}</p></div>
                    <div><p className={labelCls}>Description</p><p className="text-slate-600">{aiOutline.description}</p></div>
                    <div><p className={labelCls}>Segments</p>
                      {aiOutline.segments.map((seg, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
                          <span className="text-xs font-medium text-[color:var(--accent)] w-12">{seg.durationMinutes}min</span>
                          <span className="font-medium">{seg.name}</span>
                          <span className="text-xs text-slate-500 ml-auto truncate max-w-[200px]">{seg.notes}</span>
                        </div>
                      ))}
                    </div>
                    <div><p className={labelCls}>Talking Points</p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">{aiOutline.talkingPoints.map((tp, i) => <li key={i}>{tp}</li>)}</ul>
                    </div>
                    <div><p className={labelCls}>Alternative Titles</p>
                      <div className="flex flex-wrap gap-1">{aiOutline.suggestedTitles.map((t, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{t}</span>)}</div>
                    </div>
                    <button onClick={() => { setEpisodeDraft((p) => ({ ...p, title: aiOutline!.title, description: aiOutline!.description })); setView("episodes"); flash("Applied AI outline to episode form."); }} className={btnPrimary}>Use This Outline</button>
                  </div>
                )}
              </div>

              {/* Guest Research */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">Guest Research Assistant</h2>
                <p className="text-xs text-slate-500 mb-3">Enter a guest name to generate bio, questions, and talking points.</p>
                <div className="flex gap-2 mb-4">
                  <input value={guestSearchName} onChange={(e) => setGuestSearchName(e.target.value)} placeholder="e.g. Jane Smith" className={inputCls} />
                  <button onClick={() => { if (guestSearchName.trim()) setGuestResearch(generateGuestResearch(guestSearchName)); }} className={btnPrimary}>Research</button>
                </div>
                {guestResearch && (
                  <div className="space-y-3 text-sm">
                    <div><p className={labelCls}>Bio</p><p className="text-slate-600">{guestResearch.bio}</p></div>
                    <div><p className={labelCls}>Interview Questions</p>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-600">{guestResearch.interviewQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol>
                    </div>
                    <div><p className={labelCls}>Talking Points</p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">{guestResearch.talkingPoints.map((tp, i) => <li key={i}>{tp}</li>)}</ul>
                    </div>
                    <div><p className={labelCls}>Related Topics</p>
                      <div className="flex flex-wrap gap-1">{guestResearch.relatedTopics.map((t, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{t}</span>)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Transcript & Clips */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">Transcript & Clip Suggestions</h2>
                <p className="text-xs text-slate-500 mb-3">Select an episode to get AI-suggested social clips and highlights.</p>
                <select value={clipEpisodeId} onChange={(e) => { setClipEpisodeId(e.target.value); if (e.target.value) { const ep = state.episodes.find((ep) => ep.id === e.target.value); setClips(generateTranscriptClips(ep?.title || "")); } }} className={inputCls}>
                  <option value="">Select episode...</option>
                  {state.episodes.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
                </select>
                {clips.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {clips.map((clip) => (
                      <div key={clip.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-[color:var(--accent)]">{clip.timestamp} · {clip.duration}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize">{clip.type.replace("_", " ")}</span>
                        </div>
                        <p className="text-sm italic text-slate-700">{clip.quote}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Best for: {clip.suggestedPlatform}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Co-Host Simulator */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">AI Co-Host Simulator</h2>
                <p className="text-xs text-slate-500 mb-3">Test episode ideas with a simulated co-host conversation.</p>
                <div className="h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3 space-y-2">
                  {state.coHostMessages.length === 0 && <p className="text-xs text-slate-400 text-center pt-16">Start a conversation with your AI co-host...</p>}
                  {state.coHostMessages.map((msg) => (
                    <div key={msg.id} className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${msg.role === "user" ? "ml-auto bg-[color:var(--accent)] text-white" : "mr-auto bg-white border border-slate-200 text-slate-700"}`}>
                      {msg.content}
                    </div>
                  ))}
                  <div ref={coHostEndRef} />
                </div>
                <form onSubmit={sendCoHostMessage} className="flex gap-2">
                  <input value={coHostInput} onChange={(e) => setCoHostInput(e.target.value)} placeholder="Discuss an episode idea..." className={inputCls} />
                  <button type="submit" className={btnPrimary}>Send</button>
                </form>
              </div>

              {/* Smart Scheduling */}
              <div className={`${card} lg:col-span-2`}>
                <h2 className="text-lg font-semibold mb-1">Smart Scheduling</h2>
                <p className="text-xs text-slate-500 mb-3">AI-recommended best publish times based on listener analytics.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestBestPublishTimes().map((slot) => (
                    <div key={slot.day + slot.time} className="rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{slot.day} at {slot.time}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${slot.score >= 90 ? "bg-emerald-100 text-emerald-700" : slot.score >= 80 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{slot.score}%</span>
                      </div>
                      <p className="text-xs text-slate-500">{slot.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === "guests" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Add Guest</h2>
                <form onSubmit={addGuest} className="space-y-2">
                  <input required value={guestDraft.name} onChange={(e) => setGuestDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" className={inputCls} />
                  <input type="email" value={guestDraft.email} onChange={(e) => setGuestDraft((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className={inputCls} />
                  <input value={guestDraft.phone} onChange={(e) => setGuestDraft((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className={inputCls} />
                  <input value={guestDraft.company} onChange={(e) => setGuestDraft((p) => ({ ...p, company: e.target.value }))} placeholder="Company" className={inputCls} />
                  <input value={guestDraft.role} onChange={(e) => setGuestDraft((p) => ({ ...p, role: e.target.value }))} placeholder="Role / Title" className={inputCls} />
                  <textarea value={guestDraft.bio} onChange={(e) => setGuestDraft((p) => ({ ...p, bio: e.target.value }))} placeholder="Bio" className={`${inputCls} h-16`} />
                  <input value={guestDraft.tags} onChange={(e) => setGuestDraft((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma separated)" className={inputCls} />
                  <textarea value={guestDraft.notes} onChange={(e) => setGuestDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" className={`${inputCls} h-16`} />
                  <button type="submit" className={`w-full ${btnPrimary}`}>Add Guest</button>
                </form>
              </div>
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Guest CRM ({state.guests.length})</h2>
                <div className="max-h-[600px] overflow-auto space-y-2">
                  {state.guests.length === 0 && <p className="text-sm text-slate-500">No guests yet. Add your first guest.</p>}
                  {state.guests.map((g) => (
                    <div key={g.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{g.name}</p>
                          <p className="text-xs text-slate-500">{g.role}{g.company ? ` at ${g.company}` : ""}</p>
                          {g.email && <p className="text-xs text-slate-400">{g.email}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select value={g.bookingStatus} onChange={(e) => updateGuestBooking(g.id, e.target.value as Guest["bookingStatus"])} className="rounded border border-slate-200 px-1 py-0.5 text-[10px]">
                            <option value="potential">Potential</option>
                            <option value="contacted">Contacted</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="declined">Declined</option>
                          </select>
                          <button onClick={() => toggleReleaseForm(g.id)} className={`text-xs px-2 py-0.5 rounded-full ${g.releaseFormSigned ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {g.releaseFormSigned ? "✓ Signed" : "✗ Unsigned"}
                          </button>
                        </div>
                      </div>
                      {g.bio && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{g.bio}</p>}
                      {g.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{g.tags.map((t) => <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{t}</span>)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === "seasons" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Create Season</h2>
                <form onSubmit={addSeason} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input required value={seasonDraft.name} onChange={(e) => setSeasonDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Season name" className={inputCls} />
                    <input type="number" value={seasonDraft.number} onChange={(e) => setSeasonDraft((p) => ({ ...p, number: e.target.value }))} placeholder="#" className={inputCls} />
                  </div>
                  <input value={seasonDraft.theme} onChange={(e) => setSeasonDraft((p) => ({ ...p, theme: e.target.value }))} placeholder="Theme (e.g. Innovation)" className={inputCls} />
                  <textarea value={seasonDraft.description} onChange={(e) => setSeasonDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Description" className={`${inputCls} h-16`} />
                  <textarea value={seasonDraft.storyArc} onChange={(e) => setSeasonDraft((p) => ({ ...p, storyArc: e.target.value }))} placeholder="Story arc / narrative direction" className={`${inputCls} h-16`} />
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className={labelCls}>Start</p><input type="date" value={seasonDraft.startDate} onChange={(e) => setSeasonDraft((p) => ({ ...p, startDate: e.target.value }))} className={inputCls} /></div>
                    <div><p className={labelCls}>End</p><input type="date" value={seasonDraft.endDate} onChange={(e) => setSeasonDraft((p) => ({ ...p, endDate: e.target.value }))} className={inputCls} /></div>
                  </div>
                  <button type="submit" className={`w-full ${btnPrimary}`}>Create Season</button>
                </form>
              </div>
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Season Planner</h2>
                {state.seasons.length === 0 && <p className="text-sm text-slate-500">No seasons planned yet.</p>}
                <div className="space-y-4">
                  {state.seasons.filter((s) => s.showId === state.activeShowId).map((season) => (
                    <div key={season.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">S{season.number}: {season.name}</h3>
                        {season.theme && <span className="rounded-full bg-[color:var(--accent)]/10 px-2 py-0.5 text-xs text-[color:var(--accent)]">{season.theme}</span>}
                      </div>
                      {season.description && <p className="text-sm text-slate-600 mb-2">{season.description}</p>}
                      {season.storyArc && <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className={labelCls}>Story Arc</p><p className="text-slate-600">{season.storyArc}</p></div>}
                      {(season.startDate || season.endDate) && <p className="text-xs text-slate-500 mt-2">{season.startDate} → {season.endDate}</p>}
                      <p className="text-xs text-slate-400 mt-1">{season.episodeIds.length} episodes assigned</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === "analytics" && (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total Episodes" value={String(showEpisodes.length)} sub="all statuses" />
                <StatCard label="Published" value={String(showEpisodes.filter((e) => e.status === "published").length)} sub="completed" />
                <StatCard label="Consistency" value={`${consistency.overall}%`} sub={`${consistency.publishingStreak} episode streak`} />
                <StatCard label="Avg Duration" value={showEpisodes.length > 0 ? `${Math.round(showEpisodes.reduce((a, e) => a + e.durationMinutes, 0) / showEpisodes.length)}m` : "—"} sub="per episode" />
              </div>

              {/* Content Performance Prediction */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Content Performance Prediction</h2>
                {showEpisodes.length === 0 ? <p className="text-sm text-slate-500">Add episodes to see predictions.</p> : (
                  <div className="space-y-3">
                    {showEpisodes.slice(0, 5).map((ep) => {
                      const pred = predictContentPerformance(ep.title, ep.durationMinutes, !!ep.guest);
                      return (
                        <div key={ep.id} className="rounded-xl border border-slate-200 p-3">
                          <p className="font-medium text-sm mb-2">{ep.title}</p>
                          <div className="grid grid-cols-3 gap-3 mb-2">
                            <div><p className="text-[10px] text-slate-500">Est. Downloads</p><p className="text-lg font-bold">{pred.predictedDownloads.toLocaleString()}</p></div>
                            <div><p className="text-[10px] text-slate-500">Engagement</p><p className="text-lg font-bold">{pred.engagementScore}%</p></div>
                            <div><p className="text-[10px] text-slate-500">Viral Potential</p><p className="text-lg font-bold">{pred.viralPotential}%</p></div>
                          </div>
                          <div className="space-y-1">{pred.tips.slice(0, 2).map((tip, i) => <p key={i} className="text-xs text-slate-500">💡 {tip}</p>)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Episode Analytics */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Listener Engagement Insights</h2>
                {showEpisodes.length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                        <th className="py-2 pr-4">Episode</th><th className="py-2 pr-4">Downloads</th><th className="py-2 pr-4">Avg Listen</th><th className="py-2 pr-4">Completion</th><th className="py-2 pr-4">Drop-off</th><th className="py-2">Rating</th>
                      </tr></thead>
                      <tbody>
                        {showEpisodes.slice(0, 10).map((ep) => {
                          const a = generateEpisodeAnalytics(ep);
                          return (
                            <tr key={ep.id} className="border-b border-slate-100">
                              <td className="py-2 pr-4 font-medium truncate max-w-[200px]">{ep.title}</td>
                              <td className="py-2 pr-4">{a.downloads.toLocaleString()}</td>
                              <td className="py-2 pr-4">{a.avgListenMinutes}m</td>
                              <td className="py-2 pr-4">{a.completionRate}%</td>
                              <td className="py-2 pr-4">{a.dropOffMinute}m</td>
                              <td className="py-2">{a.rating}/5</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Consistency Score */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Episode Consistency Score</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Overall Score" value={`${consistency.overall}%`} sub="consistency rating" />
                  <StatCard label="Schedule Gaps" value={String(consistency.scheduleGaps)} sub="missed windows" />
                  <StatCard label="Current Streak" value={String(consistency.publishingStreak)} sub="consecutive episodes" />
                  <StatCard label="Longest Streak" value={String(consistency.longestStreak)} sub="all-time best" />
                </div>
              </div>
            </div>
          )}

          {view === "integrations" && (
            <div className="space-y-6">
              {/* One-Click Publishing */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">One-Click Publishing</h2>
                <p className="text-xs text-slate-500 mb-4">Connect platforms and publish episodes with one click.</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {state.publishingTargets.map((target) => (
                    <div key={target.platform} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium text-sm capitalize">{target.platform.replace("_", " ")}</p>
                        <button onClick={() => togglePublishingTarget(target.platform)} className={`text-xs px-2 py-1 rounded-full ${target.connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {target.connected ? "Connected" : "Connect"}
                        </button>
                      </div>
                      {target.connected && showEpisodes.filter((ep) => ep.status === "ready").length > 0 && (
                        <div className="space-y-1">
                          {showEpisodes.filter((ep) => ep.status === "ready").map((ep) => (
                            <button key={ep.id} onClick={() => publishToTarget(target.platform, ep.id)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50 text-left truncate">
                              Publish: {ep.title}
                            </button>
                          ))}
                        </div>
                      )}
                      {target.lastPublishedAt && <p className="text-[10px] text-slate-400 mt-2">Last: {format(parseISO(target.lastPublishedAt), "MMM d, HH:mm")}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Media Scheduling */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">Social Media Auto-Scheduling</h2>
                <p className="text-xs text-slate-500 mb-4">Schedule episode clips across social platforms.</p>
                <form onSubmit={addSocialPost} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                  <select value={socialDraft.episodeId} onChange={(e) => setSocialDraft((p) => ({ ...p, episodeId: e.target.value }))} className={inputCls}>
                    <option value="">Episode (optional)</option>
                    {state.episodes.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
                  </select>
                  <select value={socialDraft.platform} onChange={(e) => setSocialDraft((p) => ({ ...p, platform: e.target.value as SocialPost["platform"] }))} className={inputCls}>
                    <option value="x">X / Twitter</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                  </select>
                  <input type="datetime-local" value={socialDraft.scheduledAt} onChange={(e) => setSocialDraft((p) => ({ ...p, scheduledAt: e.target.value }))} className={inputCls} />
                  <button type="submit" className={btnPrimary}>Schedule</button>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <textarea value={socialDraft.content} onChange={(e) => setSocialDraft((p) => ({ ...p, content: e.target.value }))} placeholder="Post content..." className={`${inputCls} h-16`} />
                  </div>
                </form>
                {state.socialPosts.length > 0 && (
                  <div className="space-y-2">
                    {state.socialPosts.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                        <span className="text-xs font-medium uppercase text-slate-500 w-16">{p.platform}</span>
                        <p className="text-sm truncate flex-1">{p.content}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${p.status === "posted" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Calendar Integrations */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">Calendar & Notion Sync</h2>
                <p className="text-xs text-slate-500 mb-4">Connect external calendars via ICS feed.</p>
                <div className="space-y-3">
                  {(Object.keys(providerLabels) as CalendarProvider[]).map((provider) => {
                    const integ = state.integrations.find((i) => i.provider === provider);
                    return (
                      <div key={provider} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm">{providerLabels[provider]}</p>
                          {integ?.connected && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">Connected</span>}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 mb-2">
                          <input placeholder="Account label" value={integrationDrafts[provider].accountLabel}
                            onChange={(e) => setIntegrationDrafts((p) => ({ ...p, [provider]: { ...p[provider], accountLabel: e.target.value } }))} className={inputCls} />
                          <input placeholder="ICS URL (optional)" value={integrationDrafts[provider].icsUrl}
                            onChange={(e) => setIntegrationDrafts((p) => ({ ...p, [provider]: { ...p[provider], icsUrl: e.target.value } }))} className={inputCls} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => void connectCalendar(provider)} className={btnPrimary}>Connect</button>
                          <button onClick={() => setState((prev) => ({ ...prev, integrations: prev.integrations.map((i) => i.provider === provider ? { ...i, connected: false, accountLabel: "" } : i), importedEvents: prev.importedEvents.filter((e) => e.source !== provider) }))} className={btnSecondary}>Disconnect</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Equipment Checklist */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-1">Pre-Recording Equipment Checklist</h2>
                <p className="text-xs text-slate-500 mb-3">Confirm everything is ready before recording.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {state.equipmentChecklist.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" checked={item.checked} onChange={() => toggleEquipment(item.id)} className="accent-[color:var(--accent)]" />
                      <span className={`text-sm ${item.checked ? "line-through text-slate-400" : ""}`}>{item.name}</span>
                      <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] capitalize text-slate-500">{item.category}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">{state.equipmentChecklist.filter((i) => i.checked).length}/{state.equipmentChecklist.length} completed</p>
              </div>
            </div>
          )}

          {view === "content-graph" && (
            <div className={card}>
              <h2 className="text-lg font-semibold mb-1">Podcast Content Graph</h2>
              <p className="text-xs text-slate-500 mb-4">Visual map of connections between episodes, guests, and topics. Add tags to episodes and guests to see connections.</p>
              {contentGraph.nodes.length === 0 ? (
                <p className="text-sm text-slate-500 py-10 text-center">Add episodes with tags and guests to see your content graph.</p>
              ) : (
                <svg viewBox="0 0 800 600" className="w-full rounded-xl border border-slate-200 bg-slate-50" style={{ minHeight: 400 }}>
                  {contentGraph.edges.map((edge, i) => {
                    const from = contentGraph.nodes.find((n) => n.id === edge.from);
                    const to = contentGraph.nodes.find((n) => n.id === edge.to);
                    if (!from || !to) return null;
                    return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#94a3b8" strokeWidth="1" opacity="0.5" />;
                  })}
                  {contentGraph.nodes.map((node) => (
                    <g key={node.id}>
                      <circle cx={node.x} cy={node.y} r={node.type === "episode" ? 20 : node.type === "guest" ? 16 : 12}
                        fill={node.type === "episode" ? accentColor : node.type === "guest" ? "#10b981" : "#f59e0b"} opacity="0.85" />
                      <text x={node.x} y={node.y + (node.type === "episode" ? 32 : 28)} textAnchor="middle" className="text-[10px] fill-slate-600">{node.label.slice(0, 15)}</text>
                    </g>
                  ))}
                  <g transform="translate(20, 560)">
                    <circle cx="0" cy="0" r="6" fill={accentColor} /><text x="12" y="4" className="text-[10px] fill-slate-600">Episode</text>
                    <circle cx="80" cy="0" r="6" fill="#10b981" /><text x="92" y="4" className="text-[10px] fill-slate-600">Guest</text>
                    <circle cx="140" cy="0" r="6" fill="#f59e0b" /><text x="152" y="4" className="text-[10px] fill-slate-600">Topic</text>
                  </g>
                </svg>
              )}
            </div>
          )}

          {view === "trending" && (
            <div className={card}>
              <h2 className="text-lg font-semibold mb-1">Viral Topic Radar</h2>
              <p className="text-xs text-slate-500 mb-3">Trending podcast topics from Reddit, Google, and TikTok.</p>
              <button onClick={() => setTrendingTopics(generateTrendingTopics())} className={`${btnPrimary} mb-4`}>Refresh Topics</button>
              {trendingTopics.length === 0 && <p className="text-sm text-slate-500">Click refresh to load trending topics.</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trendingTopics.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-200 p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium uppercase text-slate-400">{t.source}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.trend === "rising" ? "bg-emerald-100 text-emerald-700" : t.trend === "stable" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                        {t.trend === "rising" ? "↑" : t.trend === "stable" ? "→" : "↓"} {t.trend}
                      </span>
                    </div>
                    <p className="font-medium text-sm">{t.topic}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-[color:var(--accent)]" style={{ width: `${t.score}%` }} /></div>
                      <span className="text-xs font-semibold text-slate-600">{t.score}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">{t.relatedKeywords.map((kw) => <span key={kw} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{kw}</span>)}</div>
                    <button onClick={() => { setAiTopic(t.topic); setView("ai-studio"); }} className="mt-2 text-xs text-[color:var(--accent)] hover:underline">Plan episode about this →</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "health" && (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Consistency Score" value={`${burnout.consistencyScore}%`} sub={burnout.consistencyScore >= 70 ? "Healthy" : "Needs attention"} />
                <StatCard label="Publishing Streak" value={String(burnout.publishingStreak)} sub="consecutive episodes" />
                <StatCard label="Missed Deadlines" value={String(burnout.missedDeadlines)} sub="overdue episodes" />
                <StatCard label="Avg Gap" value={`${burnout.avgGapDays}d`} sub="between episodes" />
              </div>
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Burnout Monitor</h2>
                <div className="grid gap-4 sm:grid-cols-2 mb-4">
                  <div className={`rounded-xl p-4 ${burnout.overproductionRisk ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"}`}>
                    <p className="text-sm font-medium">{burnout.overproductionRisk ? "⚠️ Overproduction Risk" : "✓ Workload OK"}</p>
                    <p className="text-xs text-slate-600 mt-1">{burnout.overproductionRisk ? "High output detected. Consider reducing to prevent burnout." : "Your production pace looks sustainable."}</p>
                  </div>
                  <div className={`rounded-xl p-4 ${burnout.missedDeadlines > 2 ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
                    <p className="text-sm font-medium">{burnout.missedDeadlines > 2 ? "⚠️ Deadline Issues" : "✓ On Schedule"}</p>
                    <p className="text-xs text-slate-600 mt-1">{burnout.missedDeadlines > 2 ? `${burnout.missedDeadlines} episodes past due. Reschedule to reduce stress.` : "All deadlines are manageable."}</p>
                  </div>
                </div>
                <h3 className="font-semibold text-sm mb-2">Recommendations</h3>
                <div className="space-y-2">
                  {burnout.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
                      <span className="text-base shrink-0">💡</span>
                      <p className="text-sm text-slate-700">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
              {conflicts.length > 0 && (
                <div className={card}>
                  <h2 className="text-lg font-semibold mb-3">Conflict Detection</h2>
                  <div className="space-y-2">
                    {conflicts.map((c, i) => (
                      <div key={i} className={`flex items-start gap-2 rounded-lg p-3 ${c.severity === "error" ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
                        <span className="text-base shrink-0">{c.severity === "error" ? "🚨" : "⚠️"}</span>
                        <p className="text-sm">{c.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "settings" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Subscription */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Subscription</h2>
                <p className="text-sm text-slate-500 mb-4">Current: <span className="font-semibold uppercase">{state.plan}</span></p>
                <div className="flex flex-wrap gap-2">
                  {(["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
                    <button key={cycle} onClick={() => handleCheckout(cycle)} disabled={isCheckingOut} className={btnPrimary}>
                      Upgrade ({formatPlanPrice(cycle)})
                    </button>
                  ))}
                  <button onClick={() => updatePlan("free")} className={btnSecondary}>Stay on Free</button>
                </div>
              </div>

              {/* Multi-Show */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Multi-Show Management</h2>
                <div className="space-y-2 mb-4">
                  {state.shows.map((s) => (
                    <div key={s.id} className={`rounded-lg border p-2 flex items-center gap-2 cursor-pointer ${s.id === state.activeShowId ? "border-[color:var(--accent)] bg-[color:var(--accent)]/5" : "border-slate-200"}`}
                      onClick={() => setState((prev) => ({ ...prev, activeShowId: s.id }))}>
                      <div className="h-8 w-8 rounded-lg shrink-0" style={{ backgroundColor: s.coverColor }} />
                      <div><p className="text-sm font-medium">{s.name}</p><p className="text-[10px] text-slate-500">{s.description}</p></div>
                    </div>
                  ))}
                </div>
                <form onSubmit={addShow} className="space-y-2 border-t border-slate-200 pt-3">
                  <input value={showDraft.name} onChange={(e) => setShowDraft((p) => ({ ...p, name: e.target.value }))} placeholder="New show name" className={inputCls} />
                  <input value={showDraft.description} onChange={(e) => setShowDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Description" className={inputCls} />
                  <div className="flex gap-2 items-center">
                    <input type="color" value={showDraft.coverColor} onChange={(e) => setShowDraft((p) => ({ ...p, coverColor: e.target.value }))} className="h-8 w-10 rounded" />
                    <button type="submit" className={btnPrimary}>Create Show</button>
                  </div>
                </form>
              </div>

              {/* Customization */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Customization</h2>
                <div className="space-y-3">
                  <label className="block"><p className={labelCls}>Timezone</p>
                    <input value={state.customization.timezone} onChange={(e) => setState((p) => ({ ...p, customization: { ...p.customization, timezone: e.target.value } }))} className={inputCls} /></label>
                  <label className="block"><p className={labelCls}>Default Duration (min)</p>
                    <input type="number" value={state.customization.defaultDurationMinutes} onChange={(e) => setState((p) => ({ ...p, customization: { ...p.customization, defaultDurationMinutes: Number(e.target.value) || 45 } }))} className={inputCls} /></label>
                  <label className="block"><p className={labelCls}>Week Starts On</p>
                    <select value={String(state.customization.weekStartsOn)} onChange={(e) => setState((p) => ({ ...p, customization: { ...p.customization, weekStartsOn: Number(e.target.value) as 0 | 1 } }))} className={inputCls}>
                      <option value="0">Sunday</option><option value="1">Monday</option>
                    </select></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={state.customization.compactMode} onChange={(e) => setState((p) => ({ ...p, customization: { ...p.customization, compactMode: e.target.checked } }))} /> <span className="text-sm">Compact calendar cells</span></label>
                  <div><p className={labelCls}>Theme</p>
                    <div className="flex gap-2">{themeOptions.map((t) => (
                      <button key={t} onClick={() => { if (supportsPremiumTheme(state.plan, t)) setState((p) => ({ ...p, customization: { ...p.customization, theme: t } })); else flash("Premium themes require Pro."); }}
                        className={`h-8 w-8 rounded-full border-2 ${state.customization.theme === t ? "border-slate-900" : "border-transparent"}`} style={{ backgroundColor: THEME_ACCENTS[t] }} />
                    ))}</div>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className={card}>
                <h2 className="text-lg font-semibold mb-3">Notifications & Reminders</h2>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={state.notificationPreferences.emailEnabled} onChange={(e) => setState((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, emailEnabled: e.target.checked } }))} /> Email</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={state.notificationPreferences.smsEnabled} onChange={(e) => { if (e.target.checked && state.plan === "free") { flash("SMS requires Pro."); return; } setState((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, smsEnabled: e.target.checked } })); }} /> SMS (Pro)</label>
                  </div>
                  <button onClick={requestNotifications} className={btnSecondary}>Enable Browser Reminders</button>
                  <label className="block"><p className={labelCls}>Lead Times (min, comma separated)</p>
                    <input value={state.notificationPreferences.leadTimesMinutes.join(",")} onChange={(e) => setState((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, leadTimesMinutes: e.target.value.split(",").map((v) => Number(v.trim())).filter((v) => Number.isFinite(v) && v > 0) } }))} className={inputCls} /></label>
                  <p className="text-xs text-slate-500">Reminders are sent to hosts, guests, and editors based on episode schedule and lead times configured above.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function OverviewPanel({ state, showEpisodes, consistency, burnout, conflicts, setView }: {
  state: SchedulerState; showEpisodes: Episode[]; consistency: ReturnType<typeof calculateConsistencyScore>;
  burnout: ReturnType<typeof calculateBurnoutMetrics>; conflicts: ReturnType<typeof detectConflicts>; setView: (v: DashboardView) => void;
}) {
  const upcoming = [...showEpisodes].filter((ep) => new Date(ep.publishAt) > new Date()).sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime()).slice(0, 5);
  const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Episodes" value={String(showEpisodes.length)} sub="across all stages" />
        <StatCard label="Guests" value={String(state.guests.length)} sub="in CRM" />
        <StatCard label="Consistency" value={`${consistency.overall}%`} sub={`${consistency.publishingStreak} streak`} />
        <StatCard label="Health" value={burnout.overproductionRisk ? "⚠️" : "✓"} sub={burnout.overproductionRisk ? "At risk" : "Healthy"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Upcoming Episodes</h2>
            <button onClick={() => setView("episodes")} className="text-xs text-[color:var(--accent)] hover:underline">View all →</button>
          </div>
          {upcoming.length === 0 && <p className="text-sm text-slate-500">No upcoming episodes.</p>}
          {upcoming.map((ep) => (
            <div key={ep.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STAGE_COLORS[ep.status] }} />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{ep.title}</p><p className="text-[10px] text-slate-500">{format(parseISO(ep.publishAt), "MMM d, HH:mm")}</p></div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase text-white shrink-0" style={{ backgroundColor: STAGE_COLORS[ep.status] }}>{ep.status}</span>
            </div>
          ))}
        </div>

        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Pipeline Summary</h2>
            <button onClick={() => setView("pipeline")} className="text-xs text-[color:var(--accent)] hover:underline">Open pipeline →</button>
          </div>
          <div className="space-y-2">
            {PIPELINE_STAGES.map((stage) => {
              const count = showEpisodes.filter((ep) => ep.status === stage).length;
              return (
                <div key={stage} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                  <span className="text-sm capitalize flex-1">{stage}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className={card}>
          <h2 className="font-semibold mb-2">⚠️ Active Conflicts ({conflicts.length})</h2>
          <div className="space-y-1">
            {conflicts.slice(0, 3).map((c, i) => <p key={i} className="text-sm text-amber-700">{c.message}</p>)}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <button onClick={() => setView("ai-studio")} className={`${card} text-left hover:shadow-md transition-shadow`}>
          <p className="text-2xl mb-2">🤖</p><h3 className="font-semibold">AI Studio</h3><p className="text-xs text-slate-500 mt-1">Generate outlines, research guests, simulate co-host</p>
        </button>
        <button onClick={() => setView("trending")} className={`${card} text-left hover:shadow-md transition-shadow`}>
          <p className="text-2xl mb-2">🔥</p><h3 className="font-semibold">Trending Topics</h3><p className="text-xs text-slate-500 mt-1">Discover what&apos;s hot on Reddit, Google, TikTok</p>
        </button>
        <button onClick={() => setView("analytics")} className={`${card} text-left hover:shadow-md transition-shadow`}>
          <p className="text-2xl mb-2">📊</p><h3 className="font-semibold">Analytics</h3><p className="text-xs text-slate-500 mt-1">Performance predictions and listener insights</p>
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
