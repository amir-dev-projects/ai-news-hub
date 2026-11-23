
import "server-only";
import Parser from "rss-parser";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MAX_ITEMS_PER_FEED = 15;

type NewsSource = {
  id: string;
  name: string;
  feed_url: string | null;
  source_type: string | null;
  is_active: boolean;
};

type Category = {
  id: string;
  name: string;
};

type FeedItem = {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  author?: string;
  enclosure?: { url?: string };
};

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "AI-News-Hub/1.0 (+RSS news aggregator)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
});

function cleanText(value?: string): string | null {
  if (!value) return null;

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000) || null;
}

function validHttpUrl(value?: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function categoryForArticle(
  title: string,
  summary: string,
  categories: Category[]
): string | null {
  const text = `${title} ${summary}`.toLowerCase();

  const rules: Array<{ category: string; terms: string[] }> = [
    {
      category: "AI Models",
      terms: ["foundation model", "language model", "llm", "model release", "model update", "gemini", "gpt-", "claude", "multimodal model", "open model"],
    },
    {
      category: "Open Source",
      terms: ["open source", "open-source", "github", "open weights", "hugging face", "license", "repository"],
    },
    {
      category: "AI Tools",
      terms: ["developer tool", "api", "sdk", "agent platform", "plugin", "workflow tool", "copilot", "coding assistant"],
    },
    {
      category: "Business",
      terms: ["funding", "investment", "acquisition", "partnership", "revenue", "enterprise", "business", "market"],
    },
    {
      category: "Research",
      terms: ["research", "paper", "study", "benchmark", "arxiv", "scientists", "evaluation", "experiment"],
    },
    {
      category: "Generative AI",
      terms: ["generative ai", "image generation", "video generation", "text-to-image", "text-to-video", "synthetic media", "diffusion"],
    },
  ];

  for (const rule of rules) {
    if (rule.terms.some((term) => text.includes(term))) {
      return categories.find((item) => item.name === rule.category)?.id || null;
    }
  }

  return categories.find((item) => item.name === "Generative AI")?.id || null;
}

async function collectOneSource(
  source: NewsSource,
  categories: Category[]
) {
  const feedUrl = validHttpUrl(source.feed_url || undefined);

  if (!feedUrl) {
    return {
      source: source.name,
      status: "skipped",
      reason: "No valid RSS feed URL is configured.",
      fetched: 0,
      inserted: 0,
    };
  }

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "AI-News-Hub/1.0 (+RSS news aggregator)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Feed returned HTTP ${response.status}`);
    }

    const xml = await response.text();
    const feed = await parser.parseString(xml);
    const items = (feed.items || []).slice(0, MAX_ITEMS_PER_FEED) as FeedItem[];

    const rows = items
      .map((item) => {
        const title = cleanText(item.title || undefined);
        const articleUrl = validHttpUrl(item.link || undefined);

        if (!title || !articleUrl) return null;

        const summary = cleanText(
          item.contentSnippet || item.summary || item.content || undefined
        );

        const rawDate = item.isoDate || item.pubDate;
        const parsedDate = rawDate ? new Date(rawDate) : null;

        const publishedAt =
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : null;

        const imageUrl = validHttpUrl(item.enclosure?.url);
        const categoryId = categoryForArticle(
          title,
          summary || "",
          categories
        );

        return {
          source_id: source.id,
          category_id: categoryId,
          title,
          article_url: articleUrl,
          summary,
          author: cleanText(item.creator || item.author || undefined),
          image_url: imageUrl,
          published_at: publishedAt,
          is_published: true,
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (rows.length === 0) {
      return {
        source: source.name,
        status: "success",
        fetched: items.length,
        inserted: 0,
        message: "No usable article entries were found.",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("articles")
      .upsert(rows, {
        onConflict: "article_url",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) throw error;

    return {
      source: source.name,
      status: "success",
      fetched: items.length,
      usable: rows.length,
      inserted: data?.length || 0,
    };
  } catch (error) {
    return {
      source: source.name,
      status: "error",
      fetched: 0,
      inserted: 0,
      error:
        error instanceof Error
          ? error.message
          : "Unknown feed collection error.",
    };
  }
}

export async function collectNews() {
  const { data: sources, error: sourcesError } = await supabaseAdmin
    .from("news_sources")
    .select("id, name, feed_url, source_type, is_active")
    .eq("is_active", true)
    .eq("source_type", "rss")
    .not("feed_url", "is", null);

  if (sourcesError) throw sourcesError;

  const { data: categories, error: categoriesError } = await supabaseAdmin
    .from("categories")
    .select("id, name");

  if (categoriesError) throw categoriesError;

  const activeSources = (sources || []) as NewsSource[];
  const availableCategories = (categories || []) as Category[];

  const results = await Promise.all(
    activeSources.map((source) =>
      collectOneSource(source, availableCategories)
    )
  );

  const totalFetched = results.reduce(
    (sum, item) => sum + item.fetched,
    0
  );

  const totalInserted = results.reduce(
    (sum, item) => sum + item.inserted,
    0
  );

  const failedSources = results.filter(
    (item) => item.status === "error"
  );

  return {
    success: failedSources.length === 0,
    collection_time: new Date().toISOString(),
    sources_checked: activeSources.length,
    sources_failed: failedSources.length,
    total_fetched: totalFetched,
    total_inserted: totalInserted,
    results,
  };
}
