import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keep a rolling news archive. Saved/bookmarked articles are never deleted.
const RETENTION_DAYS = 90;
const TAKEAWAY_RETENTION_DAYS = 30;
const BATCH_SIZE = 250;
const MAX_ROWS_SCANNED_PER_RUN = 5000;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`
  );
}

async function cleanupOldArticles() {
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  let scanned = 0;
  let deleted = 0;
  let preservedBookmarked = 0;
  let lastId: string | null = null;

  while (scanned < MAX_ROWS_SCANNED_PER_RUN) {
    const batchLimit = Math.min(
      BATCH_SIZE,
      MAX_ROWS_SCANNED_PER_RUN - scanned
    );

    let query = supabaseAdmin
      .from("articles")
      .select("id")
      .not("published_at", "is", null)
      .lt("published_at", cutoff)
      .order("id", { ascending: true })
      .limit(batchLimit);

    if (lastId) query = query.gt("id", lastId);

    const { data: candidates, error: candidateError } = await query;
    if (candidateError) throw candidateError;
    if (!candidates?.length) break;

    scanned += candidates.length;
    lastId = candidates[candidates.length - 1].id;

    const candidateIds = candidates.map((item) => item.id);

    // Stop safely if the bookmarks table cannot be checked. Never risk
    // deleting a saved article because of an incomplete lookup.
    const { data: bookmarks, error: bookmarkError } = await supabaseAdmin
      .from("bookmarks")
      .select("article_id")
      .in("article_id", candidateIds);

    if (bookmarkError) {
      throw new Error(
        `Unable to verify saved articles; cleanup stopped without deleting this batch. ${bookmarkError.message}`
      );
    }

    const bookmarkedIds = new Set(
      (bookmarks || []).map((item) => item.article_id)
    );
    preservedBookmarked += bookmarkedIds.size;

    const deletableIds = candidateIds.filter(
      (id) => !bookmarkedIds.has(id)
    );

    if (deletableIds.length > 0) {
      const { data: deletedRows, error: deleteError } = await supabaseAdmin
        .from("articles")
        .delete()
        .in("id", deletableIds)
        .select("id");

      if (deleteError) throw deleteError;
      deleted += deletedRows?.length || 0;
    }

    if (candidates.length < batchLimit) break;
  }

  return {
    success: true,
    retention_days: RETENTION_DAYS,
    cutoff,
    scanned,
    deleted,
    preserved_bookmarked: preservedBookmarked,
    scan_limit_reached: scanned >= MAX_ROWS_SCANNED_PER_RUN,
  };
}

async function cleanupOldTakeaways() {
  const cutoffDate = new Date(
    Date.now() - TAKEAWAY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  // Keep the Admin history for 30 days. Never auto-delete drafts that
  // are still waiting for review.
  const { data, error } = await supabaseAdmin
    .from("daily_takeaways")
    .delete()
    .lt("generated_for", cutoffDate)
    .in("status", ["published", "discarded"])
    .select("id");

  if (error) throw error;

  return {
    retention_days: TAKEAWAY_RETENTION_DAYS,
    cutoff_date: cutoffDate,
    deleted: data?.length || 0,
    drafts_preserved: true,
  };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const [articleCleanup, takeawayCleanup] = await Promise.all([
      cleanupOldArticles(),
      cleanupOldTakeaways(),
    ]);

    return NextResponse.json(
      {
        success: true,
        article_cleanup: articleCleanup,
        takeaway_cleanup: takeawayCleanup,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to clean up old news.";
    console.error("[cleanup-news] Cleanup failed:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
