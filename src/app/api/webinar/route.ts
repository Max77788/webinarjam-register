import { NextResponse } from "next/server";
import { getWebinarDetails, WebinarJamError } from "@/lib/webinarjam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/webinar?gmt=GMT%2B2
 *
 * Passing the caller's GMT offset lets EverWebinar return schedule dates
 * already localized to that offset AND inject the native "Just in time" slot.
 * The offset is validated to a strict GMT±H[:MM] shape before forwarding.
 */
const GMT_RE = /^GMT[+-]\d{1,2}(:\d{2})?$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const gmtRaw = url.searchParams.get("gmt");
    const gmt = gmtRaw && GMT_RE.test(gmtRaw) ? gmtRaw : undefined;
    const webinar = await getWebinarDetails(gmt);
    return NextResponse.json({ webinar });
  } catch (err) {
    if (err instanceof WebinarJamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Unexpected error fetching webinar." },
      { status: 500 }
    );
  }
}
