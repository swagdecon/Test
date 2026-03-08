"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  canConnectProvider,
  canCreateEpisode,
  dayKey,
  defaultSchedulerState,
  exportEpisodesToIcs,
  formatPlanPrice,
  parseIcsEvents,
  parseStoredState,
  supportsPremiumTheme,
  THEME_ACCENTS,
} from "@/lib/scheduler";
import {
  BillingCycle,
  CalendarProvider,
  Episode,
  EpisodeStatus,
  PlanTier,
  SchedulerState,
  ThemePreset,
} from "@/types/scheduler";

const STORAGE_KEY = "podflow.scheduler.v1";

const providerLabels: Record<CalendarProvider, string> = {
  google: "Google Calendar",
  outlook: "Microsoft Outlook",
  apple: "Apple Calendar",
};

const statusOptions: EpisodeStatus[] = ["idea", "scheduled", "recorded", "published"];
const planOptions: BillingCycle[] = ["monthly", "yearly"];
const themeOptions: ThemePreset[] = ["indigo", "emerald", "rose", "amber"];

interface CalendarEventItem {
  id: string;
  title: string;
  start: Date;
  kind: "episode" | "external";
  subtitle: string;
}

export function SchedulerApp() {
  const [state, setState] = useState<SchedulerState>(defaultSchedulerState);
  const [hydrated, setHydrated] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [episodeDraft, setEpisodeDraft] = useState({
    title: "",
    guest: "",
    description: "",
    publishAt: formatDateTimeInput(new Date(Date.now() + 86_400_000)),
    durationMinutes: String(defaultSchedulerState.customization.defaultDurationMinutes),
    status: "scheduled" as EpisodeStatus,
    platforms: "Spotify,Apple Podcasts",
  });
  const [integrationDrafts, setIntegrationDrafts] = useState<
    Record<CalendarProvider, { accountLabel: string; icsUrl: string }>
  >({
    google: { accountLabel: "", icsUrl: "" },
    outlook: { accountLabel: "", icsUrl: "" },
    apple: { accountLabel: "", icsUrl: "" },
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
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || !state.notificationPreferences.browserEnabled) {
      return;
    }
    if (!("Notification" in window) || window.Notification.permission !== "granted") {
      return;
    }

    const timer = window.setInterval(() => {
      const now = Date.now();
      const newKeys: string[] = [];

      for (const episode of state.episodes) {
        const publishTime = new Date(episode.publishAt).getTime();
        if (publishTime <= now) {
          continue;
        }

        const diffMinutes = Math.floor((publishTime - now) / 60_000);
        for (const lead of state.notificationPreferences.leadTimesMinutes) {
          const reminderKey = `${episode.id}:${lead}`;
          if (state.sentReminderKeys.includes(reminderKey)) {
            continue;
          }
          if (diffMinutes <= lead && diffMinutes >= lead - 1) {
            window.Notification.requestPermission().then(() => {
              new window.Notification("Upcoming podcast slot", {
                body: `${episode.title} starts in ${lead} minutes`,
              });
            });
            newKeys.push(reminderKey);
          }
        }
      }

      if (newKeys.length > 0) {
        setState((prev) => ({
          ...prev,
          sentReminderKeys: [...prev.sentReminderKeys, ...newKeys],
        }));
      }
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [hydrated, state]);

  const accentColor = THEME_ACCENTS[state.customization.theme];
  const canCreate = canCreateEpisode(state.plan, state.episodes);
  const calendarDays = buildCalendarDays(currentMonth, state.customization.weekStartsOn);
  const weekdayLabels =
    state.customization.weekStartsOn === 1
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarEventsByDay = useMemo(() => {
    const items: CalendarEventItem[] = [
      ...state.episodes.map((episode) => ({
        id: episode.id,
        title: episode.title,
        start: new Date(episode.publishAt),
        kind: "episode" as const,
        subtitle: `${episode.status} · ${episode.guest || "No guest yet"}`,
      })),
      ...state.importedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        start: new Date(event.start),
        kind: "external" as const,
        subtitle: `${providerLabels[event.source]} sync`,
      })),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());

    const map = new Map<string, CalendarEventItem[]>();
    for (const item of items) {
      const key = dayKey(item.start);
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return map;
  }, [state.episodes, state.importedEvents]);

  function updatePlan(plan: PlanTier) {
    setState((prev) => ({ ...prev, plan }));
  }

  async function handleCheckout(cycle: BillingCycle) {
    try {
      setIsCheckingOut(true);
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle }),
      });

      if (!response.ok) {
        throw new Error("Unable to start checkout.");
      }

      const data = (await response.json()) as { mode: "stripe" | "demo"; url?: string };
      if (data.mode === "stripe" && data.url) {
        window.location.href = data.url;
        return;
      }

      setState((prev) => ({ ...prev, plan: "pro", billingCycle: cycle }));
      setStatusMessage(`Pro plan unlocked in demo mode (${formatPlanPrice(cycle)}).`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function connectCalendar(provider: CalendarProvider) {
    const draft = integrationDrafts[provider];
    const canConnect = canConnectProvider(state.plan, state.integrations);
    const existing = state.integrations.find((integration) => integration.provider === provider);
    const isConnected = existing?.connected ?? false;

    if (!isConnected && !canConnect) {
      setStatusMessage("Free plan supports 1 calendar integration. Upgrade to unlock all providers.");
      return;
    }

    let importedCount = 0;
    if (draft.icsUrl.trim()) {
      const response = await fetch("/api/calendar/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draft.icsUrl.trim() }),
      });
      if (!response.ok) {
        setStatusMessage("Could not import ICS feed from that URL.");
        return;
      }
      const payload = (await response.json()) as { content: string };
      const importedEvents = parseIcsEvents(payload.content, provider);
      importedCount = importedEvents.length;
      setState((prev) => ({
        ...prev,
        importedEvents: [...prev.importedEvents.filter((event) => event.source !== provider), ...importedEvents],
      }));
    }

    const account = draft.accountLabel.trim() || providerLabels[provider];
    setState((prev) => ({
      ...prev,
      integrations: prev.integrations.map((integration) =>
        integration.provider === provider
          ? {
              ...integration,
              connected: true,
              accountLabel: account,
              lastSyncAt: new Date().toISOString(),
            }
          : integration,
      ),
    }));
    setStatusMessage(
      importedCount > 0
        ? `Connected ${providerLabels[provider]} and imported ${importedCount} events.`
        : `Connected ${providerLabels[provider]}.`,
    );
  }

  function disconnectCalendar(provider: CalendarProvider) {
    setState((prev) => ({
      ...prev,
      integrations: prev.integrations.map((integration) =>
        integration.provider === provider
          ? { ...integration, connected: false, accountLabel: "", lastSyncAt: undefined }
          : integration,
      ),
      importedEvents: prev.importedEvents.filter((event) => event.source !== provider),
    }));
  }

  function exportIcs() {
    const ics = exportEpisodesToIcs(state.episodes);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "podflow-schedule.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleEpisodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) {
      setStatusMessage("You reached the free limit of 5 episodes. Upgrade to Pro for unlimited scheduling.");
      return;
    }

    const publishDate = new Date(episodeDraft.publishAt);
    if (Number.isNaN(publishDate.getTime())) {
      setStatusMessage("Please provide a valid publish time.");
      return;
    }

    const newEpisode: Episode = {
      id: `ep_${crypto.randomUUID()}`,
      showId: "show_default",
      title: episodeDraft.title.trim(),
      guest: episodeDraft.guest.trim(),
      description: episodeDraft.description.trim(),
      publishAt: publishDate.toISOString(),
      durationMinutes: Number(episodeDraft.durationMinutes) || state.customization.defaultDurationMinutes,
      status: episodeDraft.status,
      platforms: episodeDraft.platforms
        .split(",")
        .map((platform) => platform.trim())
        .filter(Boolean),
      tags: [],
      notes: "",
    };

    if (!newEpisode.title) {
      setStatusMessage("Episode title is required.");
      return;
    }

    setState((prev) => ({ ...prev, episodes: [...prev.episodes, newEpisode] }));
    setEpisodeDraft((prev) => ({
      ...prev,
      title: "",
      guest: "",
      description: "",
      publishAt: formatDateTimeInput(new Date(Date.now() + 86_400_000)),
    }));
    setStatusMessage("Episode scheduled.");
  }

  function requestNotifications() {
    if (!("Notification" in window)) {
      setStatusMessage("This browser does not support notifications.");
      return;
    }
    window.Notification.requestPermission().then((permission) => {
      const isEnabled = permission === "granted";
      setState((prev) => ({
        ...prev,
        notificationPreferences: {
          ...prev.notificationPreferences,
          browserEnabled: isEnabled,
        },
      }));
      setStatusMessage(
        isEnabled ? "Browser notifications enabled." : "Browser notifications remain disabled.",
      );
    });
  }

  function updateTheme(theme: ThemePreset) {
    if (!supportsPremiumTheme(state.plan, theme)) {
      setStatusMessage("Custom premium themes require a Pro subscription.");
      return;
    }
    setState((prev) => ({
      ...prev,
      customization: { ...prev.customization, theme },
    }));
  }

  const connectedCount = state.integrations.filter((integration) => integration.connected).length;

  if (!hydrated) {
    return <div className="p-10 text-sm text-slate-600">Loading scheduler...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-10" style={{ ["--accent" as string]: accentColor }}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[color:var(--accent)]">PodFlow Scheduler</p>
              <h1 className="text-2xl font-bold">Podcast production & release planner</h1>
              <p className="text-sm text-slate-600">
                Plan episodes, sync external calendars, and automate reminders in one workspace.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase">
                {state.plan} plan
              </span>
              <button
                type="button"
                onClick={exportIcs}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Export ICS
              </button>
            </div>
          </div>
          {statusMessage && <p className="mt-4 text-sm text-[color:var(--accent)]">{statusMessage}</p>}
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Subscription</h2>
            <p className="mt-1 text-sm text-slate-600">
              Free: 5 episodes + 1 calendar. Pro unlocks unlimited scheduling, SMS reminders, and premium themes.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {planOptions.map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => handleCheckout(cycle)}
                  disabled={isCheckingOut}
                  className="rounded-lg bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Upgrade ({formatPlanPrice(cycle)})
                </button>
              ))}
              <button
                type="button"
                onClick={() => updatePlan("free")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                Stay on Free
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="mt-1 text-sm text-slate-600">
              Browser reminders are live. Email/SMS preferences can be synced to your backend queue.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.notificationPreferences.emailEnabled}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      notificationPreferences: {
                        ...prev.notificationPreferences,
                        emailEnabled: event.target.checked,
                      },
                    }))
                  }
                />
                Email
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.notificationPreferences.smsEnabled}
                  onChange={(event) => {
                    if (event.target.checked && state.plan === "free") {
                      setStatusMessage("SMS notifications are available on Pro.");
                      return;
                    }
                    setState((prev) => ({
                      ...prev,
                      notificationPreferences: {
                        ...prev.notificationPreferences,
                        smsEnabled: event.target.checked,
                      },
                    }));
                  }}
                />
                SMS (Pro)
              </label>
            </div>
            <button
              type="button"
              onClick={requestNotifications}
              className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Enable browser reminders
            </button>
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">
              Reminder lead times (minutes)
              <input
                value={state.notificationPreferences.leadTimesMinutes.join(",")}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    notificationPreferences: {
                      ...prev.notificationPreferences,
                      leadTimesMinutes: event.target.value
                        .split(",")
                        .map((value) => Number(value.trim()))
                        .filter((value) => Number.isFinite(value) && value > 0),
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm normal-case"
              />
            </label>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Customization</h2>
            <p className="mt-1 text-sm text-slate-600">Set timezone, visual theme, and default episode duration.</p>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Timezone</span>
                <input
                  value={state.customization.timezone}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, timezone: event.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Default duration (minutes)
                </span>
                <input
                  type="number"
                  value={state.customization.defaultDurationMinutes}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      customization: {
                        ...prev.customization,
                        defaultDurationMinutes: Number(event.target.value) || 45,
                      },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Week starts on</span>
                <select
                  value={String(state.customization.weekStartsOn)}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      customization: {
                        ...prev.customization,
                        weekStartsOn: Number(event.target.value) as 0 | 1,
                      },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.customization.compactMode}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      customization: {
                        ...prev.customization,
                        compactMode: event.target.checked,
                      },
                    }))
                  }
                />
                Compact calendar cells
              </label>
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase text-slate-500">Theme</span>
                <div className="flex gap-2">
                  {themeOptions.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => updateTheme(theme)}
                      className={`h-8 w-8 rounded-full border-2 ${
                        state.customization.theme === theme ? "border-slate-900" : "border-transparent"
                      }`}
                      style={{ backgroundColor: THEME_ACCENTS[theme] }}
                      aria-label={`Switch to ${theme}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_2fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Schedule episode</h2>
            <p className="mt-1 text-sm text-slate-600">
              {canCreate
                ? "Add your next release and production slot."
                : "Free tier limit reached (5 episodes). Upgrade for unlimited entries."}
            </p>
            <form className="mt-4 space-y-3" onSubmit={handleEpisodeSubmit}>
              <input
                required
                value={episodeDraft.title}
                onChange={(event) => setEpisodeDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Episode title"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                value={episodeDraft.guest}
                onChange={(event) => setEpisodeDraft((prev) => ({ ...prev, guest: event.target.value }))}
                placeholder="Guest (optional)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <textarea
                value={episodeDraft.description}
                onChange={(event) => setEpisodeDraft((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Description / talking points"
                className="h-20 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                type="datetime-local"
                required
                value={episodeDraft.publishAt}
                onChange={(event) => setEpisodeDraft((prev) => ({ ...prev, publishAt: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={episodeDraft.durationMinutes}
                  onChange={(event) =>
                    setEpisodeDraft((prev) => ({ ...prev, durationMinutes: event.target.value }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Duration"
                />
                <select
                  value={episodeDraft.status}
                  onChange={(event) =>
                    setEpisodeDraft((prev) => ({ ...prev, status: event.target.value as EpisodeStatus }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={episodeDraft.platforms}
                onChange={(event) => setEpisodeDraft((prev) => ({ ...prev, platforms: event.target.value }))}
                placeholder="Platforms (comma separated)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <button
                type="submit"
                disabled={!canCreate}
                className="w-full rounded-lg bg-[color:var(--accent)] px-3 py-2 font-medium text-white disabled:opacity-50"
              >
                Save episode
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">In-app calendar</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
                >
                  Prev
                </button>
                <p className="w-36 text-center text-sm font-medium">{format(currentMonth, "MMMM yyyy")}</p>
                <button
                  type="button"
                  onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
                >
                  Next
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase text-slate-500">
              {weekdayLabels.map((day) => (
                <div key={day} className="px-2 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const events = calendarEventsByDay.get(dayKey(day)) ?? [];
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-28 rounded-xl border p-2 ${
                      isSameMonth(day, currentMonth) ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
                    } ${isToday(day) ? "ring-2 ring-[color:var(--accent)]" : ""}`}
                  >
                    <p className="text-xs font-semibold">{format(day, "d")}</p>
                    <div className={`mt-1 space-y-1 ${state.customization.compactMode ? "text-[10px]" : "text-xs"}`}>
                      {events.slice(0, 3).map((calendarEvent) => (
                        <div
                          key={calendarEvent.id}
                          className={`rounded px-1 py-0.5 ${
                            calendarEvent.kind === "episode"
                              ? "bg-[color:var(--accent)]/15 text-slate-900"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <p className="truncate">
                            {format(calendarEvent.start, "HH:mm")} {calendarEvent.title}
                          </p>
                        </div>
                      ))}
                      {events.length > 3 && <p className="text-[10px] text-slate-500">+{events.length - 3} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Calendar integrations</h2>
            <p className="mt-1 text-sm text-slate-600">
              Connect Google, Outlook, and Apple calendars using account labels and optional ICS feed URLs.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Connected: {connectedCount} / {state.plan === "pro" ? "3" : "1 (Free plan limit)"}
            </p>

            <div className="mt-4 space-y-4">
              {(Object.keys(providerLabels) as CalendarProvider[]).map((provider) => {
                const integration = state.integrations.find((item) => item.provider === provider);
                return (
                  <div key={provider} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">{providerLabels[provider]}</p>
                      {integration?.connected && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Connected
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        placeholder="Account label"
                        value={integrationDrafts[provider].accountLabel}
                        onChange={(event) =>
                          setIntegrationDrafts((prev) => ({
                            ...prev,
                            [provider]: {
                              ...prev[provider],
                              accountLabel: event.target.value,
                            },
                          }))
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        placeholder="ICS URL (optional)"
                        value={integrationDrafts[provider].icsUrl}
                        onChange={(event) =>
                          setIntegrationDrafts((prev) => ({
                            ...prev,
                            [provider]: {
                              ...prev[provider],
                              icsUrl: event.target.value,
                            },
                          }))
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void connectCalendar(provider)}
                        className="rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Connect
                      </button>
                      <button
                        type="button"
                        onClick={() => disconnectCalendar(provider)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Upcoming timeline</h2>
            <p className="mt-1 text-sm text-slate-600">
              Unified feed of your internal schedule and synced external events.
            </p>
            <div className="mt-4 max-h-[480px] space-y-2 overflow-auto">
              {state.episodes.length === 0 && state.importedEvents.length === 0 && (
                <p className="text-sm text-slate-500">No events yet. Add an episode or connect a calendar feed.</p>
              )}
              {[...state.episodes]
                .sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime())
                .map((episode) => (
                  <div key={episode.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="font-medium">{episode.title}</p>
                    <p className="text-sm text-slate-600">
                      {format(parseISO(episode.publishAt), "EEE, MMM d yyyy HH:mm")} · {episode.durationMinutes} min
                    </p>
                    <p className="text-xs uppercase text-slate-500">{episode.status}</p>
                  </div>
                ))}
              {state.importedEvents
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .map((event) => (
                  <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-slate-600">
                      {format(parseISO(event.start), "EEE, MMM d yyyy HH:mm")} · {providerLabels[event.source]}
                    </p>
                  </div>
                ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

function formatDateTimeInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
