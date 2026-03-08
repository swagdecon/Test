import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  BillingCycle,
  CalendarIntegration,
  CalendarProvider,
  CustomizationSettings,
  Episode,
  ImportedCalendarEvent,
  NotificationPreferences,
  PlanTier,
  SchedulerState,
  ThemePreset,
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

export const FREE_TIER_LIMITS = {
  maxEpisodes: 5,
  maxCalendarConnections: 1,
} as const;

export const THEME_ACCENTS: Record<ThemePreset, string> = {
  indigo: "#4f46e5",
  emerald: "#059669",
  rose: "#e11d48",
  amber: "#d97706",
};

export const defaultSchedulerState: SchedulerState = {
  plan: "free",
  billingCycle: "monthly",
  episodes: [],
  integrations: defaultIntegrations,
  importedEvents: [],
  notificationPreferences: defaultNotificationPreferences,
  customization: defaultCustomization,
  sentReminderKeys: [],
};

export function makeEpisodeId(): string {
  return `ep_${crypto.randomUUID()}`;
}

export function parseStoredState(raw: string | null): SchedulerState {
  if (!raw) {
    return defaultSchedulerState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SchedulerState>;
    return {
      ...defaultSchedulerState,
      ...parsed,
      integrations: parsed.integrations ?? defaultIntegrations,
      customization: {
        ...defaultCustomization,
        ...parsed.customization,
      },
      notificationPreferences: {
        ...defaultNotificationPreferences,
        ...parsed.notificationPreferences,
      },
      episodes: parsed.episodes ?? [],
      importedEvents: parsed.importedEvents ?? [],
      sentReminderKeys: parsed.sentReminderKeys ?? [],
    };
  } catch {
    return defaultSchedulerState;
  }
}

export function supportsPremiumTheme(plan: PlanTier, theme: ThemePreset): boolean {
  if (theme === "indigo") {
    return true;
  }
  return plan === "pro";
}

export function canConnectProvider(
  plan: PlanTier,
  integrations: CalendarIntegration[],
): boolean {
  if (plan === "pro") {
    return true;
  }

  return integrations.filter((integration) => integration.connected).length < FREE_TIER_LIMITS.maxCalendarConnections;
}

export function canCreateEpisode(plan: PlanTier, episodes: Episode[]): boolean {
  if (plan === "pro") {
    return true;
  }
  return episodes.length < FREE_TIER_LIMITS.maxEpisodes;
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
  const normalized = value.replace("Z", "");
  const year = normalized.slice(0, 4);
  const month = normalized.slice(4, 6);
  const day = normalized.slice(6, 8);
  const hour = normalized.slice(9, 11);
  const minute = normalized.slice(11, 13);
  const second = normalized.slice(13, 15) || "00";
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

export function exportEpisodesToIcs(episodes: Episode[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PodFlow//Podcast Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const episode of episodes) {
    const start = new Date(episode.publishAt);
    const end = new Date(start.getTime() + episode.durationMinutes * 60_000);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${episode.id}@podflow.app`);
    lines.push(`SUMMARY:${escapeIcsText(`Podcast: ${episode.title}`)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(episode.description || "Podcast release slot")}`);
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

    if (!dtStartRaw || !dtEndRaw) {
      continue;
    }

    const allDay = dtStartRaw.length === 8;
    const start = allDay ? `${dtStartRaw.slice(0, 4)}-${dtStartRaw.slice(4, 6)}-${dtStartRaw.slice(6, 8)}T00:00:00.000Z` : fromIcsTimestamp(dtStartRaw);
    const end = allDay
      ? `${dtEndRaw.slice(0, 4)}-${dtEndRaw.slice(4, 6)}-${dtEndRaw.slice(6, 8)}T00:00:00.000Z`
      : fromIcsTimestamp(dtEndRaw);

    events.push({
      id: `ext_${source}_${crypto.randomUUID()}`,
      source,
      title: summary,
      start,
      end,
      allDay,
    });
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
