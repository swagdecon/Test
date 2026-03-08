import { NextRequest, NextResponse } from "next/server";

type ImportBody = {
  url?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ImportBody;
  if (!body.url) {
    return NextResponse.json({ error: "Missing ICS URL." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.url);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Only HTTP(S) URLs are supported." }, { status: 400 });
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "podflow-scheduler/1.0",
        Accept: "text/calendar,text/plain,*/*",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch ICS feed." }, { status: 502 });
    }

    const content = await response.text();
    return NextResponse.json({ content: content.slice(0, 750_000) });
  } catch {
    return NextResponse.json({ error: "Unable to import feed." }, { status: 500 });
  }
}
