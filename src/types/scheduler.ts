export type PlanTier = "free" | "pro";
export type BillingCycle = "monthly" | "yearly";
export type EpisodeStatus = "idea" | "scheduled" | "recorded" | "published";
export type CalendarProvider = "google" | "outlook" | "apple";
export type ThemePreset = "indigo" | "emerald" | "rose" | "amber";

export interface Episode {
  id: string;
  title: string;
  guest: string;
  description: string;
  publishAt: string;
  durationMinutes: number;
  status: EpisodeStatus;
  platforms: string[];
}

export interface CalendarIntegration {
  provider: CalendarProvider;
  connected: boolean;
  accountLabel: string;
  lastSyncAt?: string;
}

export interface ImportedCalendarEvent {
  id: string;
  source: CalendarProvider;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

export interface NotificationPreferences {
  browserEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  leadTimesMinutes: number[];
}

export interface CustomizationSettings {
  theme: ThemePreset;
  timezone: string;
  weekStartsOn: 0 | 1;
  defaultDurationMinutes: number;
  compactMode: boolean;
}

export interface SchedulerState {
  plan: PlanTier;
  billingCycle: BillingCycle;
  episodes: Episode[];
  integrations: CalendarIntegration[];
  importedEvents: ImportedCalendarEvent[];
  notificationPreferences: NotificationPreferences;
  customization: CustomizationSettings;
  sentReminderKeys: string[];
}
