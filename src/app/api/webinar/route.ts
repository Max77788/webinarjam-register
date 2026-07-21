import { NextResponse } from "next/server";
import { getWebinarDetails, WebinarJamError } from "@/lib/webinarjam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const webinar = await getWebinarDetails();
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
