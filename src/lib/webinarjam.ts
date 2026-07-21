/**
 * Server-side EverWebinar API client.
 *
 * All calls run on the server so the API key is never exposed to the browser.
 * The endpoint shapes below were verified against the live EverWebinar API:
 *
 *   POST /everwebinar/webinar      -> webinar details incl. schedules[]
 *   POST /everwebinar/register     -> registers a person, returns user.live_room_url
 *   POST /everwebinar/registrants  -> paginated list, used to map email -> lead_id
 *   POST /everwebinar/unsubscribe  -> requires lead_id (NOT email); returns HTTP 204
 *
 * EverWebinar expects application/x-www-form-urlencoded bodies and the api_key
 * as a query-string parameter (httpQueryAuth). Both are handled below.
 *
 * KEY BEHAVIOUR: when you pass `timezone` as a GMT offset (e.g. "GMT+2",
 * "GMT+5:30") to /webinar, the API returns every schedule date already
 * localized to that offset AND injects a synthetic "Just in time" slot
 * (schedule id 5) whose date is the next imminent start. So the client does
 * NOT compute timezones or JIT itself — the API does both.
 */

const API_BASE = "https://api.webinarjam.com/everwebinar";

export type WebinarSchedule = {
  /** schedule_id used when registering */
  schedule: number;
  /** e.g. "2026-07-22 19:00" — localized to the requested GMT offset */
  date: string;
  /** e.g. "Every day, 10:00 AM" or "Just in time" */
  comment: string;
};

export type WebinarPresenter = {
  name: string;
  email: string;
  picture: string;
};

export type WebinarDetails = {
  webinar_id: number;
  webinar_hash: string;
  name: string;
  title: string;
  description: string;
  schedules: WebinarSchedule[];
  timezone: string;
  presenters?: WebinarPresenter[];
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

/** Extract a human-readable message from EverWebinar's error payloads. */
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
  return "EverWebinar request failed.";
}

async function post<T>(path: string, params: Record<string, string>): Promise<T> {
  // api_key travels in the query string (httpQueryAuth); everything else in
  // the form-urlencoded body.
  const { api_key, ...rest } = params;
  const url = `${API_BASE}/${path}?api_key=${encodeURIComponent(api_key)}`;
  const body = new URLSearchParams(rest).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new WebinarJamError("Could not reach EverWebinar.", 502);
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
    throw new WebinarJamError("EverWebinar returned a non-JSON response.", 502);
  }

  if (!res.ok || (json as Record<string, unknown>)?.status === "error") {
    throw new WebinarJamError(extractError(json), res.ok ? 400 : res.status, json);
  }

  return json as T;
}

/**
 * Fetch webinar details. When `gmtOffset` (e.g. "GMT+2") is supplied, the API
 * localizes all schedule dates to it and adds the native "Just in time" slot.
 */
export async function getWebinarDetails(
  gmtOffset?: string
): Promise<WebinarDetails> {
  const params: Record<string, string> = {
    api_key: getApiKey(),
    webinar_id: getWebinarId(),
  };
  if (gmtOffset) params.timezone = gmtOffset;

  const data = await post<{ status: string; webinar: WebinarDetails }>(
    "webinar",
    params
  );
  return data.webinar;
}

export type Registrant = {
  id: number;
  lead_id: number;
  email: string;
  schedule_id: number;
  subscribed?: string;
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
 * email. EverWebinar's unsubscribe endpoint keys on lead_id, so we resolve the
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
  /** localized date string of the chosen instance, e.g. "2026-07-22 19:00" */
  date?: string;
  /** GMT offset for the chosen instant, e.g. "GMT+2" */
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
  if (input.date) params.date = input.date;
  if (input.timezone) params.timezone = input.timezone;

  const data = await post<{ status: string; user: RegisteredUser }>("register", params);
  return data.user;
}
