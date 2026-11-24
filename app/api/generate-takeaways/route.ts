import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "gpt-6-luna";
const MAX_TAKEAWAYS = 3;
const ARTICLE_LOOKBACK_HOURS = 36;
const PREVIOUS_LOOKBACK_DAYS = 30;

type Article = {
  id: string;
  title: string;
  summary: string | null;
  ai_summary: string | null;
  article_url: string;
  published_at: string | null;
  source: { name: string } | null;
  category: { name: string } | null;
};

type GeneratedTakeaway = {
  title: string;
  domain: "Program Management" | "Product Management" | "Both";
  description: string;
  why_it_matters: string;
  what_to_learn: string;
  practical_application: string;
  learning_focus: string;
  suggested_resources: string[];
  supporting_article_ids: string[];
};

function getOutputText(result: any): string {
  if (typeof result.output_text === "string") return result.output_text;

  for (const item of result.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("The model response did not contain output text.");
}

function makeInsightKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function isValidTakeaway(item: any): item is GeneratedTakeaway {
  const validDomains = [
    "Program Management",
    "Product Management",
    "Both",
  ];

  return (
    item &&
    typeof item.title === "string" &&
    item.title.trim().length > 0 &&
    validDomains.includes(item.domain) &&
    typeof item.description === "string" &&
    item.description.trim().length > 0 &&
    typeof item.why_it_matters === "string" &&
    typeof item.what_to_learn === "string" &&
    typeof item.practical_application === "string" &&
    typeof item.learning_focus === "string" &&
    Array.isArray(item.suggested_resources) &&
    Array.isArray(item.supporting_article_ids)
  );
}

export async function POST(request: NextRequest) {
  const generationSecret = process.env.AI_NEWS_HUB_GENERATION_SECRET;
  const suppliedSecret = request.headers.get("authorization");
  const isAuthorized =
    (Boolean(generationSecret) && suppliedSecret === `Bearer ${generationSecret}`) ||
    (Boolean(process.env.CRON_SECRET) &&
      suppliedSecret === `Bearer ${process.env.CRON_SECRET}`);

  if (!generationSecret && !process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: "Generation endpoint secret is not configured." },
      { status: 500 }
    );
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const openAiKey = process.env.OPENAI_API_KEY;

  if (!openAiKey) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const articleCutoff = new Date(
      now.getTime() - ARTICLE_LOOKBACK_HOURS * 60 * 60 * 1000
    ).toISOString();
    const previousCutoff = new Date(
      now.getTime() - PREVIOUS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);

    // Prevent accidental duplicate generation for the same day.
    const { data: todaysTakeaways, error: todaysError } = await supabaseAdmin
      .from("daily_takeaways")
      .select("id")
      .eq("generated_for", today)
      .limit(1);

    if (todaysError) throw todaysError;

    if (todaysTakeaways && todaysTakeaways.length > 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Takeaways have already been generated for today.",
        generated_for: today,
      });
    }

    const { data: articles, error: articlesError } = await supabaseAdmin
      .from("articles")
      .select(`
        id,
        title,
        summary,
        ai_summary,
        article_url,
        published_at,
        source:news_sources(name),
        category:categories(name)
      `)
      .eq("is_published", true)
      .gte("published_at", articleCutoff)
      .order("published_at", { ascending: false })
      .limit(40);

    if (articlesError) throw articlesError;

    const recentArticles = (articles || []) as unknown as Article[];

    if (recentArticles.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        reason: "No recent published articles were available for analysis.",
        generated_for: today,
      });
    }

    const { data: previousTakeaways, error: previousError } =
      await supabaseAdmin
        .from("daily_takeaways")
        .select("title, domain, description, insight_key, generated_for")
        .gte("generated_for", previousCutoff)
        .order("generated_for", { ascending: false })
        .limit(100);

    if (previousError) throw previousError;

    const articleContext = recentArticles.map((article) => ({
      id: article.id,
      title: article.title,
      source: article.source?.name || "Unknown source",
      category: article.category?.name || "Uncategorized",
      published_at: article.published_at,
      summary: article.ai_summary || article.summary || "",
      url: article.article_url,
    }));

    const previousContext = (previousTakeaways || []).map((item) => ({
      title: item.title,
      domain: item.domain,
      description: item.description,
      insight_key: item.insight_key,
      generated_for: item.generated_for,
    }));

    const instructions = `
You are the learning-intelligence editor for AI News Hub.
Your audience is experienced Program Managers and Product Managers.

Your task is to identify practical learning opportunities from the supplied
recent AI news. Do not write another news summary. Translate meaningful
developments into useful knowledge, skills, or management practices.

SELECTION RULES:
- Return zero to ${MAX_TAKEAWAYS} takeaways. There is no minimum.
- Never invent or pad the list. Return fewer when fewer qualify.
- Select only insights supported by the supplied articles.
- Prefer practical, durable learning value over general industry commentary.
- Classify each item as exactly one of:
  "Program Management", "Product Management", or "Both".
- Avoid repeating the previous takeaways.
- A familiar topic may return only if the new articles show a material
  development, a new capability, a meaningful change, or a new application.
- Do not claim an article proves something that its supplied summary does not say.
- Use only supporting article IDs from the supplied article list.
- Suggested resources should be useful resource types or known learning
  materials. Do not invent URLs.
- Write in clear, practical English. Avoid hype and generic advice.

ROLE-SPECIFIC LEARNING SUMMARY — REQUIRED:
- The "description" is the visible, collapsed summary on the AI News Hub
  dashboard. It must do more than repeat or paraphrase the news headline.
  It must explicitly explain what the relevant manager can learn from the
  development and how that lesson could inform their work.
- If domain is "Program Management", explicitly name "Program Managers" or
  "a Program Manager" and state the specific program-management lesson.
- If domain is "Product Management", explicitly name "Product Managers" or
  "a Product Manager" and state the specific product-management lesson.
- If domain is "Both", use two concise parts or sentences: one explicitly
  naming the Program Manager lesson and one explicitly naming the Product
  Manager lesson. Do not use one vague statement that could apply to anyone.
- Keep the description to no more than two sentences. Make the learning
  practical and specific to the supplied article evidence. Do not force a
  role-specific lesson when the article does not support one; in that case,
  do not select the article as a takeaway.
- The "what_to_learn" field must expand on the summary with the concrete
  capability, method, decision skill, or management practice the relevant
  manager should develop. For "Both", distinguish the two role perspectives.
- The "practical_application" must show how the relevant manager could use
  that learning in a realistic work situation. Avoid generic advice.

OUTPUT:
Return valid JSON only, with this exact shape:
{
  "takeaways": [
    {
      "title": "Short learning-focused title",
      "domain": "Program Management | Product Management | Both",
      "description": "One or two sentences explicitly stating what the relevant Program Manager and/or Product Manager can learn from this story.",
      "why_it_matters": "Explain the professional or business relevance for the named role or roles.",
      "what_to_learn": "Describe the specific capability or practice to develop, distinguishing roles when domain is Both.",
      "practical_application": "Give a realistic example of applying the lesson in that role.",
      "learning_focus": "Short subject label.",
      "suggested_resources": ["Resource suggestion"],
      "supporting_article_ids": ["exact article UUID"]
    }
  ]
}
If no insight qualifies, return {"takeaways": []}.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input: `Return the result as a JSON object using the requested structure.

${JSON.stringify({
  recent_articles: articleContext,
  previous_takeaways: previousContext,
})}`,
        text: { format: { type: "json_object" } },
        max_output_tokens: 3500,
        store: false,
      }),
      cache: "no-store",
    });

    const modelResult = await response.json();

    if (!response.ok) {
      const message =
        modelResult?.error?.message ||
        `OpenAI returned HTTP ${response.status}.`;
      return NextResponse.json(
        { success: false, error: message },
        { status: response.status }
      );
    }

    const parsed = JSON.parse(getOutputText(modelResult));
    const proposed: any[] = Array.isArray(parsed.takeaways)
      ? parsed.takeaways.slice(0, MAX_TAKEAWAYS)
      : [];

    const valid = proposed.filter(isValidTakeaway);
    const articleById = new Map(recentArticles.map((item) => [item.id, item]));

    const rows = valid
      .map((item) => {
        const supportingArticles = item.supporting_article_ids
          .map((id) => articleById.get(id))
          .filter((article): article is Article => Boolean(article));

        // Evidence is mandatory: discard unsupported model suggestions.
        if (supportingArticles.length === 0) return null;

        return {
          generated_for: today,
          title: item.title.trim().slice(0, 180),
          domain: item.domain,
          description: item.description.trim(),
          why_it_matters: item.why_it_matters.trim(),
          what_to_learn: item.what_to_learn.trim(),
          practical_application: item.practical_application.trim(),
          learning_focus: item.learning_focus.trim(),
          suggested_resources: item.suggested_resources
            .filter((resource: unknown) => typeof resource === "string")
            .slice(0, 5),
          evidence: supportingArticles.map((article) => ({
            article_id: article.id,
            title: article.title,
            source: article.source?.name || "Unknown source",
            url: article.article_url,
            published_at: article.published_at,
          })),
          insight_key: makeInsightKey(item.title),
          status: "draft",
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        reason:
          "The analysis found no takeaways that passed validation and evidence checks.",
        generated_for: today,
        articles_reviewed: recentArticles.length,
      });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("daily_takeaways")
      .insert(rows)
      .select("id, title, domain, status");

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      model: MODEL,
      generated: inserted?.length || 0,
      status: "draft",
      generated_for: today,
      articles_reviewed: recentArticles.length,
      takeaways: inserted || [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown generation error.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
