import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PodFlow Dashboard",
  description: "Manage your podcasts with AI-powered planning, scheduling, and analytics.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
