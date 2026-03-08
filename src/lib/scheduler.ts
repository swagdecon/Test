import {
  addDays,
  differenceInDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type {
  BillingCycle,
  BurnoutMetrics,
  CalendarIntegration,
  CalendarProvider,
  ConsistencyScore,
  CustomizationSettings,
  Episode,
  EpisodeAnalytics,
  EquipmentItem,
  ImportedCalendarEvent,
  NotificationPreferences,
  PlanTier,
  PublishingTarget,
  ScheduleConflict,
  SchedulerState,
  Show,
  ThemePreset,
  TimeBlock,
} from "@/types/scheduler";

const PROVIDERS: CalendarProvider[] = ["google", "outlook", "apple"];

const defaultIntegrations: CalendarIntegration[] = PROVIDERS.map((provider) => ({
  provider,
  connected: false,
  accountLabel: "",
}));

const defaultCustomization: CustomizationSettings = {
  theme: "indigo",
  timezone: "UTC",
  weekStartsOn: 1,
  defaultDurationMinutes: 45,
  compactMode: false,
};

const defaultNotificationPreferences: NotificationPreferences = {
  browserEnabled: false,
  emailEnabled: true,
  smsEnabled: false,
  leadTimesMinutes: [60, 15],
};

const defaultShow: Show = {
  id: "show_default",
  name: "My Podcast",
  description: "My first podcast show",
  coverColor: "#4f46e5",
  createdAt: new Date().toISOString(),
};

const defaultEquipment: EquipmentItem[] = [
  { id: "eq_1", name: "Microphone connected", checked: false, category: "audio" },
  { id: "eq_2", name: "Audio levels tested", checked: false, category: "audio" },
  { id: "eq_3", name: "Backup recording ready", checked: false, category: "audio" },
  { id: "eq_4", name: "Headphones working", checked: false, category: "audio" },
  { id: "eq_5", name: "Camera positioned", checked: false, category: "video" },
  { id: "eq_6", name: "Lighting adjusted", checked: false, category: "video" },
  { id: "eq_7", name: "Recording software open", checked: false, category: "software" },
  { id: "eq_8", name: "Show notes prepared", checked: false, category: "misc" },
  { id: "eq_9", name: "Guest briefed on format", checked: false, category: "misc" },
  { id: "eq_10", name: "Quiet environment confirmed", checked: false, category: "misc" },
];

const defaultPublishingTargets: PublishingTarget[] = [
  { platform: "spotify", connected: false },
  { platform: "apple_podcasts", connected: false },
  { platform: "youtube", connected: false },
];

export const FREE_TIER_LIMITS = {
  maxEpisodes: 5,
  maxCalendarConnections: 1,
  maxShows: 1,
} as const;

export const THEME_ACCENTS: Record<ThemePreset, string> = {
  indigo: "#4f46e5",
  emerald: "#059669",
  rose: "#e11d48",
  amber: "#d97706",
};

export const PIPELINE_STAGES: Episode["status"][] = [
  "idea", "planned", "scheduled", "recording", "editing", "review", "ready", "published",
];

export const STAGE_COLORS: Record<string, string> = {
  idea: "#94a3b8",
  planned: "#6366f1",
  scheduled: "#3b82f6",
  recording: "#ef4444",
  editing: "#f59e0b",
  review: "#8b5cf6",
  ready: "#10b981",
  recorded: "#10b981",
  published: "#059669",
};

export const defaultSchedulerState: SchedulerState = {
  plan: "free",
  billingCycle: "monthly",
  activeShowId: "show_default",
  shows: [defaultShow],
  episodes: [],
  guests: [],
  seasons: [],
  timeBlocks: [],
  socialPosts: [],
  publishingTargets: defaultPublishingTargets,
  equipmentChecklist: defaultEquipment,
  integrations: defaultIntegrations,
  importedEvents: [],
  notificationPreferences: defaultNotificationPreferences,
  customization: defaultCustomization,
  sentReminderKeys: [],
  coHostMessages: [],
};

export function makeEpisodeId(): string {
  return `ep_${crypto.randomUUID()}`;
}

export function parseStoredState(raw: string | null): SchedulerState {
  if (!raw) return defaultSchedulerState;
  try {
    const parsed = JSON.parse(raw) as Partial<SchedulerState>;
    return {
      ...defaultSchedulerState,
      ...parsed,
      shows: parsed.shows?.length ? parsed.shows : [defaultShow],
      activeShowId: parsed.activeShowId || "show_default",
      integrations: parsed.integrations ?? defaultIntegrations,
      customization: { ...defaultCustomization, ...parsed.customization },
      notificationPreferences: { ...defaultNotificationPreferences, ...parsed.notificationPreferences },
      episodes: (parsed.episodes ?? []).map((ep) => ({
        ...ep,
        showId: ep.showId || "show_default",
        tags: ep.tags || [],
        notes: ep.notes || "",
      })),
      guests: parsed.guests ?? [],
      seasons: parsed.seasons ?? [],
      timeBlocks: parsed.timeBlocks ?? [],
      socialPosts: parsed.socialPosts ?? [],
      publishingTargets: parsed.publishingTargets ?? defaultPublishingTargets,
      equipmentChecklist: parsed.equipmentChecklist ?? defaultEquipment,
      importedEvents: parsed.importedEvents ?? [],
      sentReminderKeys: parsed.sentReminderKeys ?? [],
      coHostMessages: parsed.coHostMessages ?? [],
    };
  } catch {
    return defaultSchedulerState;
  }
}

export function supportsPremiumTheme(plan: PlanTier, theme: ThemePreset): boolean {
  return theme === "indigo" || plan === "pro";
}

export function canConnectProvider(plan: PlanTier, integrations: CalendarIntegration[]): boolean {
  if (plan === "pro") return true;
  return integrations.filter((i) => i.connected).length < FREE_TIER_LIMITS.maxCalendarConnections;
}

export function canCreateEpisode(plan: PlanTier, episodes: Episode[]): boolean {
  if (plan === "pro") return true;
  return episodes.length < FREE_TIER_LIMITS.maxEpisodes;
}

export function canCreateShow(plan: PlanTier, shows: Show[]): boolean {
  if (plan === "pro") return true;
  return shows.length < FREE_TIER_LIMITS.maxShows;
}

export function formatPlanPrice(cycle: BillingCycle): string {
  return cycle === "monthly" ? "$12 / month" : "$120 / year";
}

export function buildCalendarDays(month: Date, weekStartsOn: 0 | 1): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn });
  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function toIcsTimestamp(isoDate: string): string {
  return isoDate.replace(/[-:]/g, "").split(".")[0].replace("Z", "") + "Z";
}

function fromIcsTimestamp(value: string): string {
  const n = value.replace("Z", "");
  return `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6, 8)}T${n.slice(9, 11)}:${n.slice(11, 13)}:${n.slice(13, 15) || "00"}.000Z`;
}

export function exportEpisodesToIcs(episodes: Episode[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PodFlow//Podcast Scheduler//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ];
  for (const ep of episodes) {
    const start = new Date(ep.publishAt);
    const end = new Date(start.getTime() + ep.durationMinutes * 60_000);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ep.id}@podflow.app`);
    lines.push(`SUMMARY:${escapeIcsText(`Podcast: ${ep.title}`)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(ep.description || "Podcast release slot")}`);
    lines.push(`DTSTART:${toIcsTimestamp(start.toISOString())}`);
    lines.push(`DTEND:${toIcsTimestamp(end.toISOString())}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcsText(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export function parseIcsEvents(content: string, source: CalendarProvider): ImportedCalendarEvent[] {
  const events: ImportedCalendarEvent[] = [];
  const chunks = content.split("BEGIN:VEVENT").slice(1);
  for (const chunk of chunks) {
    const section = chunk.split("END:VEVENT")[0] ?? "";
    const summary = section.match(/SUMMARY:(.+)/)?.[1]?.trim() ?? "External event";
    const dtStartRaw = section.match(/DTSTART(?:;[^:]+)?:([0-9TZ]+)/)?.[1]?.trim();
    const dtEndRaw = section.match(/DTEND(?:;[^:]+)?:([0-9TZ]+)/)?.[1]?.trim();
    if (!dtStartRaw || !dtEndRaw) continue;
    const allDay = dtStartRaw.length === 8;
    const start = allDay ? `${dtStartRaw.slice(0, 4)}-${dtStartRaw.slice(4, 6)}-${dtStartRaw.slice(6, 8)}T00:00:00.000Z` : fromIcsTimestamp(dtStartRaw);
    const end = allDay ? `${dtEndRaw.slice(0, 4)}-${dtEndRaw.slice(4, 6)}-${dtEndRaw.slice(6, 8)}T00:00:00.000Z` : fromIcsTimestamp(dtEndRaw);
    events.push({ id: `ext_${source}_${crypto.randomUUID()}`, source, title: summary, start, end, allDay });
  }
  return events;
}

export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDayLabel(date: Date, month: Date): string {
  const marker = isSameMonth(date, month) ? "" : " (adjacent)";
  return `${format(date, "EEE d")}${marker}`;
}

export function generateTimeBlocks(episode: Episode): TimeBlock[] {
  const publishDate = new Date(episode.publishAt);
  const blocks: TimeBlock[] = [];
  const recStart = new Date(publishDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  blocks.push({
    id: `tb_rec_${episode.id}`,
    episodeId: episode.id,
    type: "recording",
    startAt: recStart.toISOString(),
    endAt: new Date(recStart.getTime() + episode.durationMinutes * 60_000 * 1.5).toISOString(),
  });
  const editStart = new Date(publishDate.getTime() - 5 * 24 * 60 * 60 * 1000);
  blocks.push({
    id: `tb_edit_${episode.id}`,
    episodeId: episode.id,
    type: "editing",
    startAt: editStart.toISOString(),
    endAt: new Date(editStart.getTime() + 3 * 60 * 60 * 1000).toISOString(),
  });
  const reviewStart = new Date(publishDate.getTime() - 2 * 24 * 60 * 60 * 1000);
  blocks.push({
    id: `tb_rev_${episode.id}`,
    episodeId: episode.id,
    type: "review",
    startAt: reviewStart.toISOString(),
    endAt: new Date(reviewStart.getTime() + 1 * 60 * 60 * 1000).toISOString(),
  });
  blocks.push({
    id: `tb_pub_${episode.id}`,
    episodeId: episode.id,
    type: "publishing",
    startAt: publishDate.toISOString(),
    endAt: new Date(publishDate.getTime() + 30 * 60_000).toISOString(),
  });
  return blocks;
}

export function detectConflicts(episodes: Episode[], timeBlocks: TimeBlock[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const sorted = [...episodes].sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime());

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    const gap = differenceInDays(new Date(next.publishAt), new Date(curr.publishAt));
    if (gap < 2 && gap >= 0) {
      conflicts.push({
        type: "publishing_too_close",
        message: `"${curr.title}" and "${next.title}" are only ${gap} day(s) apart`,
        episodeIds: [curr.id, next.id],
        severity: gap === 0 ? "error" : "warning",
      });
    }
  }

  for (let i = 0; i < timeBlocks.length; i++) {
    for (let j = i + 1; j < timeBlocks.length; j++) {
      const a = timeBlocks[i];
      const b = timeBlocks[j];
      if (a.episodeId === b.episodeId) continue;
      const aStart = new Date(a.startAt).getTime();
      const aEnd = new Date(a.endAt).getTime();
      const bStart = new Date(b.startAt).getTime();
      const bEnd = new Date(b.endAt).getTime();
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({
          type: "time_block_overlap",
          message: `${a.type} and ${b.type} blocks overlap`,
          episodeIds: [a.episodeId, b.episodeId],
          severity: "warning",
        });
      }
    }
  }
  return conflicts;
}

export function calculateConsistencyScore(episodes: Episode[]): ConsistencyScore {
  const published = episodes
    .filter((ep) => ep.status === "published")
    .sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime());

  if (published.length < 2) {
    return { overall: published.length ? 50 : 0, scheduleGaps: 0, missedUploads: 0, publishingStreak: published.length, longestStreak: published.length };
  }

  let gaps = 0;
  let streak = 1;
  let longestStreak = 1;
  let currentStreak = 1;
  const avgGap = 7;

  for (let i = 1; i < published.length; i++) {
    const gap = differenceInDays(new Date(published[i].publishAt), new Date(published[i - 1].publishAt));
    if (gap > avgGap * 2) {
      gaps++;
      currentStreak = 1;
    } else {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    }
  }
  streak = currentStreak;

  const overall = Math.min(100, Math.round((1 - gaps / Math.max(published.length - 1, 1)) * 80 + streak * 4));
  return { overall, scheduleGaps: gaps, missedUploads: gaps, publishingStreak: streak, longestStreak };
}

export function calculateBurnoutMetrics(episodes: Episode[]): BurnoutMetrics {
  const now = new Date();
  const recent = episodes.filter((ep) => differenceInDays(now, new Date(ep.publishAt)) <= 30);
  const overproduction = recent.length > 8;
  const missed = episodes.filter((ep) => ep.status !== "published" && new Date(ep.publishAt) < now).length;

  const published = episodes.filter((ep) => ep.status === "published").sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime());
  let totalGap = 0;
  for (let i = 1; i < published.length; i++) {
    totalGap += differenceInDays(new Date(published[i].publishAt), new Date(published[i - 1].publishAt));
  }
  const avgGapDays = published.length > 1 ? Math.round(totalGap / (published.length - 1)) : 0;

  const consistency = calculateConsistencyScore(episodes);
  const recommendations: string[] = [];
  if (overproduction) recommendations.push("You're producing many episodes per month. Consider batch recording to reduce burnout.");
  if (missed > 2) recommendations.push(`You have ${missed} overdue episodes. Consider rescheduling to reduce pressure.`);
  if (avgGapDays > 14) recommendations.push("Your publishing gaps are inconsistent. Try setting a regular cadence.");
  if (avgGapDays < 3 && recent.length > 4) recommendations.push("You're publishing very frequently. Make sure to take breaks!");
  if (recommendations.length === 0) recommendations.push("You're doing great! Consistent schedule with manageable workload.");

  return {
    consistencyScore: consistency.overall,
    publishingStreak: consistency.publishingStreak,
    missedDeadlines: missed,
    overproductionRisk: overproduction,
    avgGapDays,
    recommendations,
  };
}

export function generateEpisodeAnalytics(episode: Episode): EpisodeAnalytics {
  const seed = episode.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (min: number, max: number) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);
  return {
    episodeId: episode.id,
    downloads: Math.round(r(200, 5000)),
    avgListenMinutes: Math.round(r(10, episode.durationMinutes)),
    completionRate: Math.round(r(40, 95)),
    dropOffMinute: Math.round(r(5, episode.durationMinutes * 0.8)),
    peakListeners: Math.round(r(50, 2000)),
    rating: Math.round(r(35, 50)) / 10,
  };
}
