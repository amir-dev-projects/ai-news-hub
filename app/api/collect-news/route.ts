import { NextRequest, NextResponse } from "next/server";
import { collectNews } from "@/lib/rss-collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function hasBearerSecret(request: NextRequest, secret: string | undefined) {
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runCollection() {
  try {
    const result = await collectNews();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[collect-news] Collection failed:", error);

    const errorDetails =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);

    return NextResponse.json(
      {
        success: false,
        error: errorDetails || "Unknown collection error.",
      },
      { status: 500 }
    );
  }
}

// Used by scheduled jobs. The secret is supplied by GitHub Actions.
export async function GET(request: NextRequest) {
  if (!hasBearerSecret(request, process.env.CRON_SECRET)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  return runCollection();
}

// Manual requests may continue using AI_NEWS_HUB_GENERATION_SECRET.
// Scheduled POST requests may use CRON_SECRET.
export async function POST(request: NextRequest) {
  const isAuthorized =
    hasBearerSecret(request, process.env.CRON_SECRET) ||
    hasBearerSecret(request, process.env.AI_NEWS_HUB_GENERATION_SECRET);

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  return runCollection();
}
