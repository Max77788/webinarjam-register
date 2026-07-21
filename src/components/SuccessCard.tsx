"use client";

import { useState } from "react";
import { Copy, ExternalLink, PartyPopper } from "lucide-react";
import { useToast } from "@/components/Toast";
import type { RegisteredUser } from "@/lib/webinarjam";

export function SuccessCard({ user }: { user: RegisteredUser }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const link = user.live_room_url;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast("Copied to clipboard!", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy. Please copy manually.", "error");
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <PartyPopper className="h-7 w-7 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">You&apos;re registered!</h2>
        <p className="mt-1 text-sm text-slate-500">
          Thanks {user.first_name}. Here is your personal link to join the session.
        </p>
      </div>

      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Your personal webinar link
      </label>
      <div className="flex flex-col gap-3 rounded-xl border-2 border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full flex-1 truncate rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
        />
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy Link"}
        </button>
      </div>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        <ExternalLink className="h-4 w-4" />
        Enter the webinar room
      </a>

      <dl className="mt-6 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Session</dt>
          <dd className="font-medium text-slate-700">{user.date} ({user.timezone})</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
          <dd className="font-medium text-slate-700">{user.email}</dd>
        </div>
      </dl>
    </div>
  );
}
