export type PlanTier = "free" | "pro";
export type BillingCycle = "monthly" | "yearly";
export type EpisodeStatus = "idea" | "planned" | "scheduled" | "recording" | "editing" | "review" | "ready" | "recorded" | "published";
export type CalendarProvider = "google" | "outlook" | "apple";
export type ThemePreset = "indigo" | "emerald" | "rose" | "amber";

export interface Episode {
  id: string;
  showId: string;
  seasonId?: string;
  title: string;
  guest: string;
  guestId?: string;
  description: string;
  publishAt: string;
  durationMinutes: number;
  status: EpisodeStatus;
  platforms: string[];
  recordingDate?: string;
  editingDeadline?: string;
  reviewDeadline?: string;
  tags: string[];
  notes: string;
}

export interface Show {
  id: string;
  name: string;
  description: string;
  coverColor: string;
  createdAt: string;
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  company: string;
  role: string;
  notes: string;
  bookingStatus: "potential" | "contacted" | "confirmed" | "declined";
  episodeIds: string[];
  tags: string[];
  socialLinks: { platform: string; url: string }[];
  releaseFormSigned: boolean;
  createdAt: string;
}

export interface Season {
  id: string;
  showId: string;
  number: number;
  name: string;
  theme: string;
  description: string;
  storyArc: string;
  startDate: string;
  endDate: string;
  episodeIds: string[];
  guestRoadmap: string[];
}

export interface TimeBlock {
  id: string;
  episodeId: string;
  type: "recording" | "editing" | "review" | "publishing";
  startAt: string;
  endAt: string;
}

export interface ScheduleConflict {
  type: "guest_unavailable" | "editing_overlap" | "publishing_too_close" | "time_block_overlap";
  message: string;
  episodeIds: string[];
  severity: "warning" | "error";
}

export interface EquipmentItem {
  id: string;
  name: string;
  checked: boolean;
  category: "audio" | "video" | "software" | "misc";
}

export interface SocialPost {
  id: string;
  episodeId: string;
  platform: "x" | "linkedin" | "instagram" | "tiktok";
  content: string;
  scheduledAt: string;
  status: "draft" | "scheduled" | "posted";
}

export interface PublishingTarget {
  platform: "spotify" | "apple_podcasts" | "youtube";
  connected: boolean;
  lastPublishedAt?: string;
}

export interface AIEpisodeOutline {
  title: string;
  description: string;
  segments: { name: string; durationMinutes: number; notes: string }[];
  talkingPoints: string[];
  suggestedTitles: string[];
}

export interface GuestResearch {
  bio: string;
  interviewQuestions: string[];
  talkingPoints: string[];
  relatedTopics: string[];
}

export interface TranscriptClip {
  id: string;
  timestamp: string;
  duration: string;
  quote: string;
  suggestedPlatform: string;
  type: "social_clip" | "highlight" | "quote_card";
}

export interface EpisodeAnalytics {
  episodeId: string;
  downloads: number;
  avgListenMinutes: number;
  completionRate: number;
  dropOffMinute: number;
  peakListeners: number;
  rating: number;
}

export interface TrendingTopic {
  id: string;
  topic: string;
  source: "reddit" | "google" | "tiktok";
  score: number;
  trend: "rising" | "stable" | "declining";
  relatedKeywords: string[];
}

export interface CoHostMessage {
  id: string;
  role: "user" | "cohost";
  content: string;
  timestamp: string;
}

export interface ContentNode {
  id: string;
  type: "episode" | "guest" | "topic";
  label: string;
  x: number;
  y: number;
}

export interface ContentEdge {
  from: string;
  to: string;
  label?: string;
}

export interface BurnoutMetrics {
  consistencyScore: number;
  publishingStreak: number;
  missedDeadlines: number;
  overproductionRisk: boolean;
  avgGapDays: number;
  recommendations: string[];
}

export interface ConsistencyScore {
  overall: number;
  scheduleGaps: number;
  missedUploads: number;
  publishingStreak: number;
  longestStreak: number;
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

export type DashboardView =
  | "overview"
  | "episodes"
  | "calendar"
  | "pipeline"
  | "ai-studio"
  | "guests"
  | "seasons"
  | "analytics"
  | "integrations"
  | "content-graph"
  | "trending"
  | "health"
  | "settings";

export interface SchedulerState {
  plan: PlanTier;
  billingCycle: BillingCycle;
  activeShowId: string;
  shows: Show[];
  episodes: Episode[];
  guests: Guest[];
  seasons: Season[];
  timeBlocks: TimeBlock[];
  socialPosts: SocialPost[];
  publishingTargets: PublishingTarget[];
  equipmentChecklist: EquipmentItem[];
  integrations: CalendarIntegration[];
  importedEvents: ImportedCalendarEvent[];
  notificationPreferences: NotificationPreferences;
  customization: CustomizationSettings;
  sentReminderKeys: string[];
  coHostMessages: CoHostMessage[];
}
