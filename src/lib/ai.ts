import type {
  AIEpisodeOutline,
  CoHostMessage,
  GuestResearch,
  TranscriptClip,
  TrendingTopic,
} from "@/types/scheduler";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function generateEpisodeOutline(topic: string): AIEpisodeOutline {
  const base = topic.trim() || "Untitled Topic";
  const titleVariations = [
    `Deep Dive: ${base}`,
    `${base} — What You Need to Know`,
    `The Ultimate Guide to ${base}`,
    `Exploring ${base} in ${new Date().getFullYear()}`,
    `${base}: Myths vs Reality`,
  ];
  const segmentTemplates = [
    { name: "Intro & Hook", durationMinutes: 3, notes: `Open with a compelling question about ${base}` },
    { name: "Context & Background", durationMinutes: 8, notes: `Set the stage — why ${base} matters now` },
    { name: "Main Discussion", durationMinutes: 15, notes: `Core deep-dive into ${base} with examples` },
    { name: "Guest Spotlight", durationMinutes: 10, notes: "Guest shares personal experience and insights" },
    { name: "Listener Q&A", durationMinutes: 5, notes: "Address top audience questions" },
    { name: "Ad Break", durationMinutes: 2, notes: "Sponsor message" },
    { name: "Key Takeaways", durationMinutes: 4, notes: "Summarize 3-5 actionable takeaways" },
    { name: "Outro & CTA", durationMinutes: 3, notes: "Subscribe, review, share — next episode teaser" },
  ];
  const talkingPoints = [
    `What is ${base} and why is it gaining traction?`,
    `Common misconceptions about ${base}`,
    `Real-world examples of ${base} in action`,
    `How beginners can get started with ${base}`,
    `The future outlook for ${base}`,
    `Tools and resources for mastering ${base}`,
    `Expert opinions and contrarian views on ${base}`,
  ];

  return {
    title: pick(titleVariations),
    description: `In this episode, we explore ${base} from every angle. From foundational concepts to advanced strategies, discover what makes ${base} one of the most talked-about topics today. Featuring expert insights, real-world examples, and actionable takeaways.`,
    segments: segmentTemplates,
    talkingPoints: pickN(talkingPoints, 5),
    suggestedTitles: titleVariations,
  };
}

export function generateGuestResearch(guestName: string): GuestResearch {
  const name = guestName.trim() || "Guest";
  return {
    bio: `${name} is a recognized thought leader and industry expert with over a decade of experience. Known for their innovative approach and insightful perspectives, ${name} has been featured in major publications and spoken at leading conferences worldwide. Their work focuses on bridging the gap between theory and practice, making complex topics accessible to broad audiences.`,
    interviewQuestions: [
      `${name}, what first drew you to this field, and how has your perspective evolved over the years?`,
      `Can you share a pivotal moment in your career that shaped who you are today?`,
      `What's the biggest misconception people have about your area of expertise?`,
      `If you could give one piece of advice to someone just starting out, what would it be?`,
      `What trends are you most excited about for the coming year?`,
      `How do you balance innovation with practical, real-world application?`,
      `What project or achievement are you most proud of, and why?`,
      `Where can our listeners connect with you and follow your work?`,
    ],
    talkingPoints: [
      `${name}'s journey and origin story`,
      "Key lessons learned from failures and successes",
      "Industry trends and future predictions",
      "Practical tips for the audience",
      "Behind-the-scenes of their latest project",
      "Rapid-fire fun questions to show personality",
    ],
    relatedTopics: [
      "Leadership & Innovation",
      "Personal Growth & Productivity",
      "Industry Disruption",
      "Technology & Future Trends",
      "Entrepreneurship",
      "Work-Life Balance",
    ],
  };
}

export function generateTranscriptClips(episodeTitle: string): TranscriptClip[] {
  const title = episodeTitle.trim() || "Episode";
  return [
    {
      id: `clip_${crypto.randomUUID()}`,
      timestamp: "02:15",
      duration: "45s",
      quote: `"The most important thing about ${title} is that it changes how we think about the problem entirely."`,
      suggestedPlatform: "X / Twitter",
      type: "quote_card",
    },
    {
      id: `clip_${crypto.randomUUID()}`,
      timestamp: "08:30",
      duration: "60s",
      quote: `"I learned this the hard way — you can't shortcut the fundamentals."`,
      suggestedPlatform: "LinkedIn",
      type: "social_clip",
    },
    {
      id: `clip_${crypto.randomUUID()}`,
      timestamp: "15:45",
      duration: "90s",
      quote: `"Here's the three-step framework that changed everything for me..."`,
      suggestedPlatform: "Instagram Reels",
      type: "highlight",
    },
    {
      id: `clip_${crypto.randomUUID()}`,
      timestamp: "22:10",
      duration: "30s",
      quote: `"If you remember nothing else from this episode, remember this one thing..."`,
      suggestedPlatform: "TikTok",
      type: "social_clip",
    },
    {
      id: `clip_${crypto.randomUUID()}`,
      timestamp: "35:00",
      duration: "120s",
      quote: `"The audience reaction to this was incredible — let me tell you what happened next."`,
      suggestedPlatform: "YouTube Shorts",
      type: "highlight",
    },
  ];
}

export function generateCoHostResponse(userMessage: string): CoHostMessage {
  const topic = userMessage.toLowerCase();
  let response: string;

  if (topic.includes("what do you think") || topic.includes("opinion")) {
    response = pick([
      "That's a great angle! I think our audience would really connect with this because it's relatable. We could open with a personal story to hook them in.",
      "Interesting idea! I'd push back a little though — have we considered the counterargument? Playing devil's advocate could make for a much more engaging discussion.",
      "Love it. My take is we should frame this as a journey — start with the problem, build tension, then reveal the solution. Classic storytelling.",
    ]);
  } else if (topic.includes("topic") || topic.includes("episode") || topic.includes("idea")) {
    response = pick([
      "Ooh, that's a hot topic right now. We could tie it into current events and make it a two-parter if the discussion goes deep enough. Season finale material!",
      "I can see this resonating with our core audience. Let's make sure we include actionable takeaways — that's what keeps people coming back.",
      "This has viral potential! We should plan some quote-worthy moments and prep social clips in advance. Let me suggest some angles...",
    ]);
  } else if (topic.includes("guest") || topic.includes("interview")) {
    response = pick([
      "Great guest pick! I'd suggest we do a pre-interview call to find their best stories. The magic happens when guests feel comfortable enough to go off-script.",
      "I know their work — they're excellent on camera. Let's prepare some unexpected questions to get past their usual talking points and into genuinely new territory.",
      "Perfect choice. We should research their recent projects so we can ask informed questions. Nothing impresses a guest more than a well-prepared host.",
    ]);
  } else if (topic.includes("schedule") || topic.includes("plan") || topic.includes("when")) {
    response = pick([
      "Based on our usual cadence, I'd say we should aim for a Tuesday release. Our analytics show that's when engagement peaks. Should I block out the recording time?",
      "Let's be realistic about the timeline. If we record this week, we need 3 days for editing and 1 day for review. That puts us at a next Thursday release.",
      "Good timing question! I'd recommend batching this with the other episode we have planned. Record both in one session to save setup time.",
    ]);
  } else {
    response = pick([
      "That's a solid point. Let me build on that — what if we also explored the practical applications? Our listeners love actionable content they can implement right away.",
      "I hear you. Here's my thought: we should validate this idea with a quick audience poll first. We can use our social channels to gauge interest before committing.",
      "Totally agree. And here's something to consider — we could turn this into a recurring segment. It's the kind of topic that evolves, so we'd never run out of material.",
      "Interesting perspective! I'd add that we should think about the narrative arc. Every great episode tells a story — what's the transformation we want the listener to experience?",
    ]);
  }

  return {
    id: `msg_${crypto.randomUUID()}`,
    role: "cohost",
    content: response,
    timestamp: new Date().toISOString(),
  };
}

export function generateTrendingTopics(): TrendingTopic[] {
  const topics: Omit<TrendingTopic, "id">[] = [
    { topic: "AI in Content Creation", source: "google", score: 95, trend: "rising", relatedKeywords: ["ChatGPT", "automation", "AI writing", "content strategy"] },
    { topic: "Podcast Monetization Strategies", source: "reddit", score: 88, trend: "rising", relatedKeywords: ["sponsorships", "Patreon", "premium content", "merch"] },
    { topic: "Solo Podcasting vs Co-Hosting", source: "tiktok", score: 82, trend: "stable", relatedKeywords: ["solo shows", "chemistry", "interview format", "panel"] },
    { topic: "Video Podcasting Growth", source: "google", score: 91, trend: "rising", relatedKeywords: ["YouTube podcasts", "video first", "clips", "shorts"] },
    { topic: "Niche Podcast Communities", source: "reddit", score: 76, trend: "stable", relatedKeywords: ["micro audiences", "community building", "Discord", "memberships"] },
    { topic: "Podcast SEO & Discoverability", source: "google", score: 84, trend: "rising", relatedKeywords: ["transcripts", "show notes", "keywords", "Apple rankings"] },
    { topic: "Creator Economy Burnout", source: "tiktok", score: 79, trend: "rising", relatedKeywords: ["sustainability", "mental health", "batch recording", "breaks"] },
    { topic: "Live Podcast Events", source: "reddit", score: 71, trend: "stable", relatedKeywords: ["live shows", "tour", "meetups", "hybrid events"] },
    { topic: "Short-Form Audio Content", source: "tiktok", score: 87, trend: "rising", relatedKeywords: ["micro episodes", "daily drops", "snackable content", "audiograms"] },
    { topic: "Cross-Platform Distribution", source: "google", score: 73, trend: "declining", relatedKeywords: ["RSS", "Spotify exclusives", "multi-platform", "syndication"] },
    { topic: "Podcast Accessibility & Inclusion", source: "reddit", score: 68, trend: "rising", relatedKeywords: ["transcripts", "multilingual", "diverse voices", "captioning"] },
    { topic: "AI Voice Cloning for Podcasts", source: "tiktok", score: 93, trend: "rising", relatedKeywords: ["ElevenLabs", "voice synthesis", "dubbing", "translations"] },
  ];

  return topics.map((t) => ({ ...t, id: `trend_${crypto.randomUUID()}` }));
}

export function suggestBestPublishTimes(): { day: string; time: string; score: number; reason: string }[] {
  return [
    { day: "Tuesday", time: "6:00 AM", score: 94, reason: "Peak commute listening — highest download rates" },
    { day: "Wednesday", time: "12:00 PM", score: 89, reason: "Lunch break listening spike" },
    { day: "Thursday", time: "5:00 PM", score: 85, reason: "End-of-workday wind-down audience" },
    { day: "Monday", time: "7:00 AM", score: 82, reason: "Fresh week, high intent listeners" },
    { day: "Friday", time: "3:00 PM", score: 75, reason: "Weekend prep — moderate engagement" },
    { day: "Sunday", time: "9:00 AM", score: 70, reason: "Relaxed morning audience, longer listen times" },
  ];
}

export function predictContentPerformance(
  topic: string,
  durationMinutes: number,
  hasGuest: boolean
): { predictedDownloads: number; engagementScore: number; viralPotential: number; tips: string[] } {
  let base = 500 + Math.floor(Math.random() * 1500);
  let engagement = 60 + Math.floor(Math.random() * 25);
  let viral = 20 + Math.floor(Math.random() * 40);

  if (hasGuest) { base += 300; engagement += 10; viral += 15; }
  if (durationMinutes >= 30 && durationMinutes <= 60) { engagement += 5; }
  if (topic.toLowerCase().includes("ai") || topic.toLowerCase().includes("tech")) { viral += 20; base += 200; }

  return {
    predictedDownloads: Math.min(base, 5000),
    engagementScore: Math.min(engagement, 100),
    viralPotential: Math.min(viral, 100),
    tips: [
      hasGuest ? "Guest episodes average 40% more downloads — great choice!" : "Consider adding a guest to boost reach by ~40%",
      durationMinutes > 60 ? "Episodes over 60 min see higher drop-off. Consider splitting into parts." : "Duration is in the sweet spot for retention.",
      "Add timestamps in show notes to improve discoverability",
      "Prepare 2-3 social clips before publishing for maximum launch impact",
      viral > 50 ? "High viral potential! Prepare extra social content for this one." : "Steady performer — focus on audience retention strategies.",
    ],
  };
}
