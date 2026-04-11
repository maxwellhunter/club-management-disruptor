"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Shows a warning banner when logged in with a demo account.
 * Hidden for real users and when not logged in.
 */
const DEMO_EMAILS = [
  "admin@greenfieldcc.com",
  "staff@greenfieldcc.com",
  "member@greenfieldcc.com",
  "golf@greenfieldcc.com",
];

export function EnvBanner() {
  const [demoEmail, setDemoEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && DEMO_EMAILS.includes(user.email ?? "")) {
        setDemoEmail(user.email!);
      }
    });
  }, []);

  if (!demoEmail) return null;

  return (
    <div className="bg-amber-500 text-white text-center text-xs font-bold py-0.5 px-2 z-50">
      Demo Account ({demoEmail}) — Data here is shared and may be reset
    </div>
  );
}
