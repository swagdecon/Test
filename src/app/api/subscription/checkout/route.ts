import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const monthlyPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
const yearlyPriceId = process.env.STRIPE_PRICE_PRO_YEARLY;

type CheckoutBody = {
  cycle?: "monthly" | "yearly";
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CheckoutBody;
  const cycle = body.cycle === "yearly" ? "yearly" : "monthly";

  if (!stripeSecretKey || !monthlyPriceId || !yearlyPriceId) {
    return NextResponse.json({ mode: "demo" as const });
  }

  try {
    const stripe = new Stripe(stripeSecretKey);
    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const price = cycle === "yearly" ? yearlyPriceId : monthlyPriceId;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${origin}/?checkout=success&plan=pro`,
      cancel_url: `${origin}/?checkout=cancelled`,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: {
        app: "podflow-scheduler",
        cycle,
      },
    });

    return NextResponse.json({
      mode: "stripe" as const,
      url: session.url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        mode: "demo" as const,
        error: error instanceof Error ? error.message : "Checkout unavailable",
      },
      { status: 200 },
    );
  }
}
