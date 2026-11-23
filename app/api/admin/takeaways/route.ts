import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DOMAINS = [
  "Program Management",
  "Product Management",
  "Both",
] as const;

function getAdminSecret() {
  return process.env.TAKEAWAYS_ADMIN_SECRET?.trim() || null;
}

function isAuthorized(request: NextRequest) {
  const adminSecret = getAdminSecret();

  return Boolean(
    adminSecret &&
      request.headers.get("authorization") === `Bearer ${adminSecret}`
  );
}

function accessError(request: NextRequest) {
  if (!getAdminSecret()) {
    return NextResponse.json(
      {
        success: false,
        error: "Admin access is not configured. Add TAKEAWAYS_ADMIN_SECRET to Vercel Environment Variables and redeploy.",
      },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Check your Admin secret." },
      { status: 401 }
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authError = accessError(request);
  if (authError) return authError;

  try {
    const { data, error } = await supabaseAdmin
      .from("daily_takeaways")
      .select(
        "id, generated_for, title, domain, description, why_it_matters, what_to_learn, practical_application, learning_focus, suggested_resources, evidence, insight_key, status, created_at, published_at"
      )
      .order("generated_for", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json(
      { success: true, takeaways: data || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load takeaways.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();

  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const action = body?.action;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "A takeaway ID is required." },
        { status: 400 }
      );
    }

    if (!["edit", "publish", "discard"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Unsupported review action." },
        { status: 400 }
      );
    }

    let updates: Record<string, unknown> = {};

    if (action === "edit") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const domain = body.domain;
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      const whyItMatters =
        typeof body.why_it_matters === "string"
          ? body.why_it_matters.trim()
          : "";
      const whatToLearn =
        typeof body.what_to_learn === "string"
          ? body.what_to_learn.trim()
          : "";
      const practicalApplication =
        typeof body.practical_application === "string"
          ? body.practical_application.trim()
          : "";
      const learningFocus =
        typeof body.learning_focus === "string"
          ? body.learning_focus.trim()
          : "";
      const resources = Array.isArray(body.suggested_resources)
        ? body.suggested_resources
            .filter((item: unknown) => typeof item === "string")
            .map((item: string) => item.trim())
            .filter(Boolean)
            .slice(0, 5)
        : [];

      if (
        !title ||
        title.length > 180 ||
        !VALID_DOMAINS.includes(domain) ||
        !description ||
        !whyItMatters ||
        !whatToLearn ||
        !practicalApplication ||
        !learningFocus ||
        description.length > 1000
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Please provide a title (up to 180 characters), a valid domain, and all required text fields.",
          },
          { status: 400 }
        );
      }

      updates = {
        title,
        domain,
        description,
        why_it_matters: whyItMatters,
        what_to_learn: whatToLearn,
        practical_application: practicalApplication,
        learning_focus: learningFocus,
        suggested_resources: resources,
        insight_key: title
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 100),
      };
    }

    if (action === "publish") {
      updates = {
        status: "published",
        published_at: new Date().toISOString(),
      };
    }

    if (action === "discard") {
      // Keep the record for history; discarded items are hidden from the public dashboard.
      updates = { status: "discarded" };
    }

    const { data, error } = await supabaseAdmin
      .from("daily_takeaways")
      .update(updates)
      .eq("id", id)
      .select(
        "id, generated_for, title, domain, description, why_it_matters, what_to_learn, practical_application, learning_focus, suggested_resources, evidence, insight_key, status, created_at, published_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, takeaway: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update takeaway.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
