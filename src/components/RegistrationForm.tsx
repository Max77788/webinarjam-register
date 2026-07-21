"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Clock,
  Globe,
  Loader2,
  Mail,
  Phone,
  User,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { SuccessCard } from "@/components/SuccessCard";
import { COUNTRY_CODES } from "@/lib/countryCodes";
import {
  buildScheduleOptions,
  gmtOffsetForTz,
  COMMON_TIMEZONES,
  type ScheduleOption,
} from "@/lib/schedule";
import type { RegisteredUser, WebinarDetails } from "@/lib/webinarjam";
import { cn } from "@/lib/utils";

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function RegistrationForm() {
  const toast = useToast();

  const [webinar, setWebinar] = useState<WebinarDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState<string>("UTC");
  const [scheduleId, setScheduleId] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisteredUser | null>(null);

  // Detect the user's timezone on mount.
  useEffect(() => {
    setTimezone(detectTimezone());
  }, []);

  // The GMT offset (e.g. "GMT+2") EverWebinar uses to localize schedules + JIT.
  const gmtOffset = useMemo(() => gmtOffsetForTz(timezone), [timezone]);

  // Fetch webinar details localized to the chosen timezone. Refetches whenever
  // the offset changes so the API re-localizes dates and the JIT slot.
  const loadWebinar = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/webinar?gmt=${encodeURIComponent(gmtOffset)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load webinar.");
      return data.webinar as WebinarDetails;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [gmtOffset]);

  useEffect(() => {
    let active = true;
    (async () => {
      const w = await loadWebinar();
      if (active && w) setWebinar(w);
    })();
    return () => {
      active = false;
    };
  }, [loadWebinar]);

  // Timezone dropdown list: user's detected zone always present.
  const timezoneList = useMemo(() => {
    const detected = detectTimezone();
    const set = new Set<string>([detected, ...COMMON_TIMEZONES]);
    return Array.from(set);
  }, []);

  // Build options from the already-localized schedules the API returned.
  const scheduleOptions: ScheduleOption[] = useMemo(() => {
    if (!webinar) return [];
    return buildScheduleOptions(webinar.schedules || []);
  }, [webinar]);

  // Keep a valid selection: default to the first option (JIT sorts first).
  useEffect(() => {
    if (scheduleOptions.length === 0) return;
    const stillValid = scheduleOptions.some(
      (o) => `${o.id}|${o.date}` === scheduleId
    );
    if (!stillValid) setScheduleId(`${scheduleOptions[0].id}|${scheduleOptions[0].date}`);
  }, [scheduleOptions, scheduleId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast("Please fill in your name and email.", "error");
      return;
    }

    const chosen = scheduleOptions.find(
      (o) => `${o.id}|${o.date}` === scheduleId
    );
    if (!chosen) {
      toast("Please select a session.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone_country_code: phone.trim() ? countryCode : undefined,
          phone: phone.trim() || undefined,
          schedule: chosen.id,
          date: chosen.date,
          timezone: gmtOffset,
          user_timezone: timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");
      setResult(data.user as RegisteredUser);
      toast("Registration confirmed!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Registration failed.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <SuccessCard user={result} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {loading && !webinar
            ? "Loading session…"
            : webinar?.title || "Reserve your seat"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {webinar?.description ||
            "Choose the time that works for you and get your personal join link."}
        </p>
      </div>

      {loadError && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" icon={<User className="h-4 w-4" />}>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              autoComplete="given-name"
              required
              className={inputCls}
            />
          </Field>
          <Field label="Last name" icon={<User className="h-4 w-4" />}>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              autoComplete="family-name"
              required
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Email address" icon={<Mail className="h-4 w-4" />}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            autoComplete="email"
            required
            className={inputCls}
          />
        </Field>

        <Field label="Phone number (optional)" icon={<Phone className="h-4 w-4" />}>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className={cn(inputCls, "w-32 shrink-0")}
              aria-label="Country calling code"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={`${c.iso}${c.code}`} value={c.code}>
                  {c.iso} {c.code}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="555 123 4567"
              autoComplete="tel-national"
              className={inputCls}
            />
          </div>
        </Field>

        <Field label="Your timezone" icon={<Globe className="h-4 w-4" />}>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputCls}
          >
            {timezoneList.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")} ({gmtOffsetForTz(tz)})
              </option>
            ))}
          </select>
        </Field>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CalendarClock className="h-4 w-4" />
            Choose a session
          </label>
          {loading && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating times for {gmtOffset}…
            </div>
          )}
          {!loading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {scheduleOptions.map((opt) => {
                const key = `${opt.id}|${opt.date}`;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setScheduleId(key)}
                    className={cn(
                      "flex h-full w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition",
                      scheduleId === key
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          opt.jit
                            ? "bg-amber-100 text-amber-600"
                            : "bg-brand-100 text-brand-600"
                        )}
                      >
                        {opt.jit ? (
                          <Zap className="h-5 w-5" />
                        ) : (
                          <Clock className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug text-slate-800">
                          {opt.label}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {opt.sublabel}
                        </span>
                      </span>
                    </span>
                    <span
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-full border-2",
                        scheduleId === key
                          ? "border-brand-500 bg-brand-500"
                          : "border-slate-300"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reserving your seat…
            </>
          ) : (
            "Create the Joining Link"
          )}
        </button>
        <p className="text-center text-xs text-slate-400">
          We&apos;ll remove any previous signups for this email before confirming your new slot.
        </p>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
