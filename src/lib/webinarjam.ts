/**
 * Server-side WebinarJam API client.
 *
 * All calls run on the server so the API key is never exposed to the browser.
 * The endpoint shapes below were verified against the live WebinarJam API:
 *
 *   POST /webinarjam/webinar      -> webinar details incl. schedules[]
 *   POST /webinarjam/register     -> registers a person, returns user.live_room_url
 *   POST /webinarjam/registrants  -> paginated list, used to map email -> lead_id
 *   POST /webinarjam/unsubscribe  -> requires lead_id (NOT email); returns HTTP 204
 *
 * WebinarJam expects application/x-www-form-urlencoded bodies.
 */

const API_BASE = "https://api.webinarjam.com/webinarjam";

export type WebinarSchedule = {
  /** schedule_id used when registering */
  schedule: number;
  /** e.g. "2026-07-20 22:23" (in the webinar's own timezone) */
  date: string;
  /** e.g. "Right now" */
  comment: string;
};

export type WebinarDetails = {
  webinar_id: number;
  webinar_hash: string;
  name: string;
  title: string;
  description: string;
  type: string;
  schedules: WebinarSchedule[];
  timezone: string;
  registration_url?: string;
};

export type RegisteredUser = {
  webinar_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  schedule: string;
  date: string;
  timezone: string;
  live_room_url: string;
  replay_room_url: string;
  thank_you_url: string;
};

export class WebinarJamError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status = 500, details: unknown = null) {
    super(message);
    this.name = "WebinarJamError";
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const key = process.env.WEBINARJAM_API_KEY;
  if (!key || key === "{api_key_here_later}") {
    throw new WebinarJamError(
      "WEBINARJAM_API_KEY is not configured on the server.",
      500
    );
  }
  return key;
}

export function getWebinarId(): string {
  return process.env.WEBINARJAM_WEBINAR_ID || "2";
}

/** Extract a human-readable message from WebinarJam's error payloads. */
function extractError(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const errors = (payload as Record<string, unknown>).errors;
    if (typeof errors === "string") return errors;
    if (errors && typeof errors === "object") {
      const e = errors as Record<string, unknown>;
      if (typeof e.message === "string") return e.message;
      // field-level errors: { field: ["msg", ...] }
      const first = Object.values(e)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
  }
  return "WebinarJam request failed.";
}

async function post<T>(path: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new WebinarJamError("Could not reach WebinarJam.", 502);
  }

  // Unsubscribe returns 204 with an empty body.
  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new WebinarJamError("WebinarJam returned a non-JSON response.", 502);
  }

  if (!res.ok || (json as Record<string, unknown>)?.status === "error") {
    throw new WebinarJamError(extractError(json), res.ok ? 400 : res.status, json);
  }

  return json as T;
}

export async function getWebinarDetails(): Promise<WebinarDetails> {
  const data = await post<{ status: string; webinar: WebinarDetails }>("webinar", {
    api_key: getApiKey(),
    webinar_id: getWebinarId(),
  });
  return data.webinar;
}

export type Registrant = {
  id: number;
  lead_id: number;
  email: string;
  schedule_id: number;
  subscribed: string;
};

/** Fetch every registrant across all pages (used to resolve email -> lead_id). */
export async function listRegistrants(): Promise<Registrant[]> {
  const all: Registrant[] = [];
  let page = 1;
  // Cap pages defensively so a large list can never loop forever.
  for (; page <= 50; page++) {
    const data = await post<{
      status: string;
      registrants: {
        current_page: number;
        last_page?: number;
        data: Registrant[];
      };
    }>("registrants", {
      api_key: getApiKey(),
      webinar_id: getWebinarId(),
      page: String(page),
    });

    const chunk = data.registrants?.data ?? [];
    all.push(...chunk);

    const lastPage = data.registrants?.last_page ?? page;
    if (page >= lastPage || chunk.length === 0) break;
  }
  return all;
}

/**
 * Remove a registrant from every schedule of the target webinar, matched by
 * email. WebinarJam's unsubscribe endpoint keys on lead_id, so we resolve the
 * ids first. Safe to call for emails that were never registered.
 */
export async function unsubscribeByEmail(email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const registrants = await listRegistrants();
  const matches = registrants.filter(
    (r) => (r.email || "").trim().toLowerCase() === normalized
  );

  let removed = 0;
  for (const r of matches) {
    try {
      await post("unsubscribe", {
        api_key: getApiKey(),
        webinar_id: getWebinarId(),
        lead_id: String(r.lead_id),
      });
      removed++;
    } catch {
      // Best-effort cleanup: one failure shouldn't block registration.
    }
  }
  return removed;
}

export type RegisterInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone_country_code?: string;
  phone?: string;
  schedule: string;
  timezone?: string;
};

export async function registerPerson(input: RegisterInput): Promise<RegisteredUser> {
  const params: Record<string, string> = {
    api_key: getApiKey(),
    webinar_id: getWebinarId(),
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    schedule: input.schedule,
  };
  if (input.phone_country_code) params.phone_country_code = input.phone_country_code;
  if (input.phone) params.phone = input.phone;
  if (input.timezone) params.timezone = input.timezone;

  const data = await post<{ status: string; user: RegisteredUser }>("register", params);
  return data.user;
}
