import Image from "next/image";
import { RegistrationForm } from "@/components/RegistrationForm";
import { ToastProvider } from "@/components/Toast";

export default function Home() {
  return (
    <ToastProvider>
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-brand-50 px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="mb-6 flex justify-center">
              <Image
                src="/logo.png"
                alt="Company logo"
                width={106}
                height={81}
                priority
                className="h-16 w-auto"
              />
            </div>
            <RegistrationForm />
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Powered by WebinarJam · Your info is only used to register you for this session.
          </p>
        </div>
      </main>
    </ToastProvider>
  );
}
