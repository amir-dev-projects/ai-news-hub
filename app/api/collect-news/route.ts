import { NextRequest, NextResponse } from "next/server";
import { collectNews } from "@/lib/rss-collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const isVercelSchedule =
    request.headers.get("ce-type") === "com.vercel.schedule.v1beta";

  const expectedSecret = isVercelSchedule
    ? process.env.CRON_SECRET
    : process.env.AI_NEWS_HUB_GENERATION_SECRET;

  const suppliedSecret = request.headers.get("authorization");

  return Boolean(
    expectedSecret && suppliedSecret === `Bearer ${expectedSecret}`
  );
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

// Vercel Schedules calls this route using POST.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  return runCollection();
}
