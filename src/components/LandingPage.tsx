"use client";

import Link from "next/link";
import { useState } from "react";

const FEATURES = [
  { icon: "🤖", title: "AI Episode Planning", desc: "Generate outlines, segment timing, titles, and descriptions from a topic in seconds." },
  { icon: "📅", title: "Smart Scheduling", desc: "AI recommends best publish times based on listener analytics and auto-adjusts your schedule." },
  { icon: "🎙️", title: "Production Pipeline", desc: "Track episodes from Idea → Planned → Recording → Editing → Review → Ready → Published." },
  { icon: "👥", title: "Guest CRM", desc: "Manage guest contacts, booking status, release forms, and interview history in one place." },
  { icon: "📊", title: "Analytics & Insights", desc: "Predict content performance, track consistency scores, and understand listener engagement." },
  { icon: "🌐", title: "One-Click Publishing", desc: "Publish directly to Spotify, Apple Podcasts, and YouTube with a single click." },
  { icon: "📱", title: "Social Auto-Scheduling", desc: "Auto-post episode clips to X, LinkedIn, Instagram, and TikTok on release day." },
  { icon: "🗓️", title: "Season Planner", desc: "Plan entire seasons with themes, story arcs, and guest roadmaps for maximum impact." },
  { icon: "🧠", title: "AI Co-Host Simulator", desc: "Test episode ideas with a simulated co-host conversation before recording." },
  { icon: "🔥", title: "Viral Topic Radar", desc: "Discover trending podcast topics from Reddit, Google, and TikTok in real-time." },
  { icon: "💚", title: "Burnout Monitor", desc: "Detect inconsistent scheduling, overproduction, and missed tasks before they become problems." },
  { icon: "🕸️", title: "Content Graph", desc: "Visual map of connections between guests, topics, and episodes for deeper content strategy." },
];

const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for getting started",
    features: ["5 episodes", "1 calendar integration", "Basic scheduling", "Production pipeline", "Equipment checklist", "AI Episode Planning"],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    desc: "Everything you need to grow",
    features: [
      "Unlimited episodes", "Unlimited calendar integrations", "Multi-show management", "Guest CRM",
      "Season planner", "AI Co-Host Simulator", "Advanced analytics", "One-click publishing",
      "Social media scheduling", "Content graph", "Viral topic radar", "Burnout monitor",
      "SMS notifications", "Premium themes", "Priority support",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
];

export function LandingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">P</div>
            <span className="text-lg font-bold">PodFlow</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900">Features</a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">Pricing</a>
            <a href="#faq" className="text-sm text-slate-600 hover:text-slate-900">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-sm font-medium text-slate-600 hover:text-slate-900">Log in</Link>
            <Link href="/app" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-100/50 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-100/40 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            AI-Powered Podcast Management
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
            Plan, Produce & Publish<br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Your Best Podcasts</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 md:text-xl">
            The all-in-one scheduler with AI episode planning, production pipeline, guest CRM, 
            analytics, and one-click publishing to every platform.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/app" className="rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
              Start Free — No Credit Card
            </Link>
            <a href="#features" className="rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
              See All Features
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Free forever plan</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> No credit card required</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> AI-powered features</span>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-6xl px-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-2 text-xs text-slate-400">PodFlow Scheduler — Dashboard</span>
            </div>
            <div className="grid grid-cols-12 gap-0">
              <div className="col-span-3 border-r border-slate-100 bg-slate-50 p-4">
                {["Overview", "Episodes", "Calendar", "Pipeline", "AI Studio", "Guests", "Seasons", "Analytics"].map((item, i) => (
                  <div key={item} className={`mb-1 rounded-lg px-3 py-2 text-sm ${i === 0 ? "bg-indigo-100 font-medium text-indigo-700" : "text-slate-600"}`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="col-span-9 p-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[{ label: "Episodes", value: "24", sub: "+3 this week" }, { label: "Downloads", value: "12.4K", sub: "+18% MoM" }, { label: "Consistency", value: "94%", sub: "12-week streak" }].map((s) => (
                    <div key={s.label} className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs text-emerald-600">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg border border-slate-100 bg-slate-50 p-1">
                      <div className="text-[10px] text-slate-400">{i + 1}</div>
                      {i % 3 === 0 && <div className="mt-0.5 h-2 rounded bg-indigo-200" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-4xl">Everything You Need to Podcast Like a Pro</h2>
            <p className="mt-4 text-lg text-slate-600">22+ features designed to save time, add intelligence, and create a wow factor.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-lg text-slate-600">Start free, upgrade when you&apos;re ready to go pro.</p>
            <div className="mt-6 inline-flex items-center rounded-full bg-slate-100 p-1">
              <button onClick={() => setBillingCycle("monthly")} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                Monthly
              </button>
              <button onClick={() => setBillingCycle("yearly")} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${billingCycle === "yearly" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                Yearly <span className="text-emerald-600 text-xs">Save 17%</span>
              </button>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.name} className={`rounded-2xl border p-8 ${tier.highlighted ? "border-indigo-200 bg-indigo-50/50 shadow-lg ring-2 ring-indigo-600" : "border-slate-200 bg-white"}`}>
                {tier.highlighted && <div className="mb-4 inline-block rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">Most Popular</div>}
                <h3 className="text-xl font-bold">{tier.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{tier.desc}</p>
                <div className="mt-4">
                  <span className="text-4xl font-extrabold">{tier.name === "Pro" && billingCycle === "yearly" ? "$10" : tier.price}</span>
                  <span className="text-slate-500">{tier.name === "Pro" ? (billingCycle === "yearly" ? "/month billed yearly" : tier.period) : ""}</span>
                </div>
                <Link href="/app" className={`mt-6 block rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all ${tier.highlighted ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {tier.cta}
                </Link>
                <ul className="mt-6 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 text-emerald-500">✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 bg-slate-50">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold mb-12">Frequently Asked Questions</h2>
          {[
            { q: "Is PodFlow really free to start?", a: "Yes! The free plan includes 5 episodes, 1 calendar integration, AI planning tools, and the full production pipeline. No credit card required." },
            { q: "Can I manage multiple podcasts?", a: "Absolutely. Pro users can create unlimited shows with a shared guest pool and publishing calendar." },
            { q: "How does the AI work?", a: "Our AI generates episode outlines, guest research, title suggestions, and clip recommendations based on your topic and content. It runs entirely in-app." },
            { q: "Can I publish directly to platforms?", a: "Pro users can connect Spotify, Apple Podcasts, and YouTube for one-click publishing. Free users can export ICS and manage scheduling manually." },
          ].map(({ q, a }) => (
            <div key={q} className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold">{q}</h3>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Ready to Level Up Your Podcast?</h2>
          <p className="mt-4 text-lg text-slate-600">Join thousands of podcasters who plan, produce, and publish with PodFlow.</p>
          <Link href="/app" className="mt-8 inline-block rounded-xl bg-indigo-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
            Get Started for Free
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-xs font-bold text-white">P</div>
            <span className="text-sm font-semibold">PodFlow Scheduler</span>
          </div>
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} PodFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
