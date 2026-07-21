import { NextResponse } from "next/server";
import {
  registerPerson,
  unsubscribeByEmail,
  WebinarJamError,
  type RegisterInput,
} from "@/lib/webinarjam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isNonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GMT_RE = /^GMT[+-]\d{1,2}(:\d{2})?$/;

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    first_name,
    last_name,
    email,
    phone_country_code,
    phone,
    schedule,
    date,
    timezone,
  } = payload;

  if (!isNonEmpty(first_name) || !isNonEmpty(last_name)) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 }
    );
  }
  if (!isNonEmpty(email) || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 }
    );
  }
  if (!isNonEmpty(schedule)) {
    return NextResponse.json(
      { error: "Please select a session." },
      { status: 400 }
    );
  }

  const input: RegisterInput = {
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    email: email.trim(),
    schedule: schedule.trim(),
    phone_country_code: isNonEmpty(phone_country_code)
      ? phone_country_code.trim()
      : undefined,
    phone: isNonEmpty(phone) ? phone.trim() : undefined,
    date: isNonEmpty(date) ? date.trim() : undefined,
    timezone: isNonEmpty(timezone) && GMT_RE.test(timezone.trim())
      ? timezone.trim()
      : undefined,
  };

  try {
    // Step 1: remove this email from any existing schedules of the webinar.
    let removed = 0;
    try {
      removed = await unsubscribeByEmail(input.email);
    } catch {
      // Non-fatal: proceed with registration even if cleanup fails.
    }

    // Step 2: register for the chosen schedule instance.
    const user = await registerPerson(input);

    return NextResponse.json({
      user,
      cleanup: { removed },
      live_room_url: user.live_room_url,
      thank_you_url: user.thank_you_url,
    });
  } catch (err) {
    if (err instanceof WebinarJamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Unexpected error during registration." },
      { status: 500 }
    );
  }
}
