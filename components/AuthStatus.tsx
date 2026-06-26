"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AuthStatus() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const match = document.cookie.match(new RegExp('(^| )oraculum\\.mock_user=([^;]+)'));
    if (match) {
      try {
        const mockUser = JSON.parse(decodeURIComponent(match[2]));
        setUser(mockUser);
      } catch {}
    } else {
      setUser(null);
    }
  }, []);

  async function signOut() {
    document.cookie = "oraculum.mock_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    setUser(null);
    router.refresh();
    router.push("/");
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="rounded-[255px_15px_225px_15px/15px_225px_15px_255px] border-[3px] border-ink bg-white px-5 py-2 text-lg font-heading shadow-hard transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-signal hover:text-white hover:shadow-hard-lg"
      >
        Sign in
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-[255px_15px_225px_15px/15px_225px_15px_255px] border-2 border-dashed border-ink bg-transparent px-4 py-2 text-lg font-heading transition hover:-rotate-2 hover:bg-mist"
    >
      Sign out
    </button>
  );
}
