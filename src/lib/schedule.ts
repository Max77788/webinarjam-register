import type { WebinarSchedule } from "@/lib/webinarjam";

/**
 * A schedule option ready to render in the UI. Every option is a real
 * EverWebinar schedule instance — including the API-native "Just in time"
 * slot (schedule id 5). No synthetic client-side slots.
 */
export type ScheduleOption = {
  /** value sent back as `schedule` on registration */
  id: string;
  /** the localized date string for this instance, e.g. "2026-07-22 19:00" */
  date: string;
  /** primary label, e.g. "Wed, Jul 22, 2026" */
  label: string;
  /** secondary label, e.g. "7:00 PM" */
  sublabel: string;
  /** true for the API's "Just in time" slot */
  jit: boolean;
  /** ms since epoch for sorting; JIT sorts first */
  sortKey: number;
};

/**
 * Compute the GMT offset string EverWebinar expects (e.g. "GMT+2", "GMT-7",
 * "GMT+5:30") for an IANA timezone at the current instant. Mirrors the n8n
 * expression `DateTime.fromFormat(...).toFormat("'GMT'Z")`.
 */
export function gmtOffsetForTz(tz: string, at = new Date()): string {
  const offsetMin = tzOffsetMinutes(at, tz);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return mins === 0
    ? `GMT${sign}${hours}`
    : `GMT${sign}${hours}:${String(mins).padStart(2, "0")}`;
}

/** Offset (minutes) of a timezone at a given instant: localZone - UTC. */
function tzOffsetMinutes(date: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = Number(p.value);
    }
    // Intl may return hour "24" for midnight; normalize.
    if (map.hour === 24) map.hour = 0;
    const asUtc = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      map.hour,
      map.minute,
      map.second
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/** Parse "GMT+2" / "GMT-5:30" into minutes east of UTC. */
export function parseGmtOffsetMinutes(gmt: string): number | null {
  const m = gmt.trim().match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/i);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2]);
  const mins = Number(m[3] || "0");
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || mins >= 60) return null;
  return sign * (hours * 60 + mins);
}

function parseWallParts(dateStr: string): {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
} | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    h: Number(m[4]),
    mi: Number(m[5]),
  };
}

/**
 * Convert a wall-clock "YYYY-MM-DD HH:mm" from an IANA zone into the same
 * instant expressed as a wall clock under a GMT±H[:MM] offset.
 */
export function convertWallClockToGmtOffset(
  dateStr: string,
  sourceTz: string,
  targetGmt: string
): string {
  const parts = parseWallParts(dateStr);
  const targetOffset = parseGmtOffsetMinutes(targetGmt);
  if (!parts || targetOffset == null) return dateStr;

  // Resolve the UTC instant for this wall time in the source zone.
  let utcMs = Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi);
  for (let i = 0; i < 3; i++) {
    const offsetMin = tzOffsetMinutes(new Date(utcMs), sourceTz);
    utcMs =
      Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi) -
      offsetMin * 60000;
  }

  const local = new Date(utcMs + targetOffset * 60000);
  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  const h = String(local.getUTCHours()).padStart(2, "0");
  const mi = String(local.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

function isJustInTimeSchedule(s: WebinarSchedule): boolean {
  return /just in time/i.test(s.comment || "") || Number(s.schedule) === 5;
}

/**
 * EverWebinar only injects the native "Just in time" slot when /webinar is
 * called WITHOUT a timezone. Localized fetches (timezone=GMT±H) drop it.
 * Merge the base JIT entry into the localized list and re-express its date
 * under the caller's GMT offset so the UI always has a real schedule id 5.
 */
export function mergeJustInTimeSchedule(
  localizedSchedules: WebinarSchedule[],
  baseSchedules: WebinarSchedule[],
  baseTimezone: string,
  targetGmt?: string
): WebinarSchedule[] {
  if ((localizedSchedules || []).some(isJustInTimeSchedule)) {
    return localizedSchedules;
  }

  const jit = (baseSchedules || []).find(isJustInTimeSchedule);
  if (!jit) return localizedSchedules;

  let date = jit.date;
  if (targetGmt && baseTimezone) {
    date = convertWallClockToGmtOffset(jit.date, baseTimezone, targetGmt);
  }

  return [
    {
      schedule: jit.schedule,
      comment: jit.comment || "Just in time",
      date,
    },
    ...localizedSchedules,
  ];
}

/**
 * Parse a localized "YYYY-MM-DD HH:mm" string into a sortable epoch. The value
 * is already localized by the API, so we only need a monotonic key — parsing
 * the components as UTC is sufficient for ordering.
 */
function parseSortKey(dateStr: string): number {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  return Date.UTC(y, mo - 1, d, h, mi);
}

/** Human-friendly labels from a localized "YYYY-MM-DD HH:mm" string. */
function formatLocalized(dateStr: string): { label: string; sublabel: string } {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return { label: dateStr, sublabel: "" };
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  // Build a UTC date purely for formatting the already-localized wall clock.
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));

  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);

  const sublabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);

  return { label, sublabel };
}

/**
 * Format a localized "YYYY-MM-DD HH:mm" instant into the display shapes the n8n
 * reminders flow expects: FINAL_DATE like "July 23, 2026" and FINAL_TIME like
 * "7pm" (or "7:30pm" when there are minutes). The wall-clock is already
 * localized, so we format the components as UTC to avoid re-shifting.
 */
export function formatFinalDateTime(dateStr: string): {
  date: string;
  time: string;
} {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return { date: dateStr, time: "" };
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));

  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(dt);

  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "am" : "pm";
  const time =
    mi === 0
      ? `${hour12}${ampm}`
      : `${hour12}:${String(mi).padStart(2, "0")}${ampm}`;

  return { date, time };
}

/**
 * Convert API schedules (already localized to the user's GMT offset) into
 * sorted UI options. The API repeats recurring schedule ids across days, so
 * each option is keyed by id+date to keep instances distinct. The "Just in
 * time" entry is flagged and sorted first.
 */
export function buildScheduleOptions(
  schedules: WebinarSchedule[]
): ScheduleOption[] {
  const opts: ScheduleOption[] = [];
  const seen = new Set<string>();

  for (const s of schedules) {
    const isJit = /just in time/i.test(s.comment || "");
    const key = `${s.schedule}|${s.date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { label, sublabel } = formatLocalized(s.date);
    opts.push({
      id: String(s.schedule),
      date: s.date,
      label: isJit ? "Just in time - starts now" : label,
      sublabel: isJit ? "Jump into the next session" : sublabel,
      jit: isJit,
      sortKey: isJit ? 0 : parseSortKey(s.date),
    });
  }

  opts.sort((a, b) => a.sortKey - b.sortKey);
  return opts;
}

/** Common IANA timezones for the manual override dropdown. */
export const COMMON_TIMEZONES: string[] = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];
