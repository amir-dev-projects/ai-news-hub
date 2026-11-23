
import { NextRequest, NextResponse } from "next/server";
import { collectNews } from "@/lib/rss-collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const generationSecret = process.env.AI_NEWS_HUB_GENERATION_SECRET;
  const suppliedSecret = request.headers.get("authorization");

  if (!generationSecret) {
    return NextResponse.json(
      {
        success: false,
        error: "Collection endpoint secret is not configured.",
      },
      { status: 500 }
    );
  }

  if (suppliedSecret !== `Bearer ${generationSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

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
