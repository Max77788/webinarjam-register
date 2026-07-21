import type { WebinarSchedule } from "@/lib/webinarjam";

/**
 * A schedule option ready to render in the UI. Either a real WebinarJam
 * schedule or the synthetic "Just In Time" slot.
 */
export type ScheduleOption = {
  /** value sent back as `schedule` on registration */
  id: string;
  /** primary label, e.g. "Fri, Jul 24, 2026" */
  label: string;
  /** secondary label, e.g. "2:30 PM GMT+2" */
  sublabel: string;
  /** true for the synthetic next-available slot */
  jit: boolean;
  /** ms since epoch for sorting; JIT sorts first */
  sortKey: number;
};

/**
 * WebinarJam schedule dates look like "2026-07-20 22:23" and are expressed in
 * the webinar's own timezone (details.timezone, e.g. "America/New_York").
 * We build a real Date for that wall-clock time in that zone, then render it in
 * the user's selected timezone.
 */
function zonedWallClockToUtc(dateStr: string, sourceTz: string): Date | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];

  // Interpret the wall-clock components as if they were UTC, then correct by
  // the source zone's offset at that instant.
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offset = tzOffsetMs(new Date(asUtc), sourceTz);
  return new Date(asUtc - offset);
}

/** Offset (ms) of a timezone at a given instant: localZone - UTC. */
function tzOffsetMs(date: Date, tz: string): number {
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
    const asUtc = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      map.hour,
      map.minute,
      map.second
    );
    return asUtc - date.getTime();
  } catch {
    return 0;
  }
}

function formatInTz(date: Date, tz: string) {
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);

  return { dateLabel, timeLabel };
}

/**
 * Build the "Just In Time" slot: the next quarter-hour boundary at least ~5
 * minutes out, so a registrant always has a session about to start.
 */
export function buildJitOption(tz: string, now = new Date()): ScheduleOption {
  const target = new Date(now.getTime());
  target.setSeconds(0, 0);
  const step = 15;
  const minutes = target.getMinutes();
  let next = Math.ceil((minutes + 5) / step) * step;
  target.setMinutes(next);

  const { timeLabel } = formatInTz(target, tz);
  return {
    id: "jit",
    label: "Just In Time — starts soon",
    sublabel: `Next session at ${timeLabel}`,
    jit: true,
    sortKey: 0,
  };
}

/** Convert real WebinarJam schedules into localized, sorted options. */
export function buildScheduleOptions(
  schedules: WebinarSchedule[],
  sourceTz: string,
  userTz: string
): ScheduleOption[] {
  const opts: ScheduleOption[] = [];
  for (const s of schedules) {
    const utc = zonedWallClockToUtc(s.date, sourceTz);
    if (!utc) continue;
    const { dateLabel, timeLabel } = formatInTz(utc, userTz);
    const isRightNow = /right now/i.test(s.comment || "");
    opts.push({
      id: String(s.schedule),
      label: isRightNow ? "Live Now" : dateLabel,
      sublabel: isRightNow ? "Join the ongoing session" : timeLabel,
      jit: false,
      sortKey: utc.getTime(),
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
