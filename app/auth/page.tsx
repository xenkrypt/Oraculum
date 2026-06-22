import { AuthForm } from "@/components/AuthForm";

export default function AuthPage() {
  return (
    <section className="mx-auto max-w-xl">
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal">
            Enter Oraculum
          </h1>
          <p className="text-sm leading-6 text-ink/65">
            Email and password auth is backed by Supabase. Later sessions,
            responses, profile summaries, paths, and Shadow Twin events all use
            the authenticated user id.
          </p>
        </div>
        <AuthForm />
      </div>
    </section>
  );
}
