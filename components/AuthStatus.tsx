"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthStatus() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setUser(data.user);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      router.refresh();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
    router.push("/");
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold hover:border-moss/60"
      >
        Sign in
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold hover:border-moss/60"
    >
      Sign out
    </button>
  );
}
