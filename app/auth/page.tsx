import { AuthForm } from "@/components/AuthForm";

export default function AuthPage() {
  return (
    <section className="mx-auto max-w-lg mt-12 bg-grid min-h-[70vh] flex flex-col justify-center">
      <div className="border border-parchment-faint bg-panel/30 p-8 relative">
        <div className="absolute top-0 right-0 bg-obsidian px-2 py-1 text-[10px] font-mono text-parchment-dim uppercase border-l border-b border-parchment-faint">
          AUTH_TERMINAL_V1
        </div>
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl font-serif text-parchment tracking-wide">
            Interface Initialization
          </h1>
          <p className="text-sm font-sans text-parchment-dim leading-relaxed border-l-2 border-amber/40 pl-4">
            Establish a persistent link to synchronize your Shadow Twin matrix across cycles. Or proceed anonymously for a localized session.
          </p>
        </div>
        <AuthForm />
      </div>
    </section>
  );
}
