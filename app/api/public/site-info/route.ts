import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function firstText(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function safeUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function mapDirectory(rows: Row[]) {
  return rows
    .filter((row) => row.is_active !== false)
    .map((row, index) => ({
      id: String(row.id ?? index),
      name:
        firstText(row, [
          "name",
          "provider_name",
          "source_name",
          "display_name",
          "title",
          "provider",
        ]) || "Unnamed provider",
      url: safeUrl(
        firstText(row, [
          "website_url",
          "homepage_url",
          "provider_url",
          "source_url",
          "website",
          "url",
        ])
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
  try {
    const [sourcesResult, providersResult, collectionResult, draftsResult, latestArticleResult] =
      await Promise.all([
        supabaseAdmin
          .from("news_sources")
          .select("*")
          .eq("is_active", true),
        supabaseAdmin
          .from("training_providers")
          .select("*"),
        supabaseAdmin
          .from("collection_runs")
          .select(
            "collection_time, success, sources_failed, sources_checked, total_fetched, total_inserted"
          )
          .order("collection_time", { ascending: false })
          .limit(1),
        supabaseAdmin
          .from("daily_takeaways")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft"),
        supabaseAdmin
          .from("articles")
          .select("published_at")
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(1),
      ]);

    if (sourcesResult.error) throw sourcesResult.error;
    if (providersResult.error) throw providersResult.error;

    const latestRun = collectionResult.error
      ? null
      : collectionResult.data?.[0] || null;
    const latestArticle = latestArticleResult.error
      ? null
      : latestArticleResult.data?.[0] || null;

    return NextResponse.json(
      {
        success: true,
        siteInfo: {
          newsSources: mapDirectory((sourcesResult.data || []) as Row[]),
          trainingProviders: mapDirectory((providersResult.data || []) as Row[]),
          lastCollectionAt: latestRun?.collection_time || null,
          lastCollectionSuccess:
            typeof latestRun?.success === "boolean"
              ? latestRun.success
              : null,
          sourcesFailed:
            typeof latestRun?.sources_failed === "number"
              ? latestRun.sources_failed
              : null,
          collectionLogAvailable: !collectionResult.error,
          pendingTakeawaysCount: draftsResult.error ? null : draftsResult.count ?? 0,
          lastCollectionSourcesChecked:
            typeof latestRun?.sources_checked === "number" ? latestRun.sources_checked : null,
          lastCollectionTotalFetched:
            typeof latestRun?.total_fetched === "number" ? latestRun.total_fetched : null,
          lastCollectionTotalInserted:
            typeof latestRun?.total_inserted === "number" ? latestRun.total_inserted : null,
          latestArticlePublishedAt: latestArticle?.published_at || null,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load site information.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
