"use client";

/**
 * Shows a colored banner in non-production environments so you never
 * accidentally test or demo against the wrong database.
 *
 * - Staging: orange bar
 * - Local dev: blue bar
 * - Production: hidden
 */
export function EnvBanner() {
  const env = process.env.NEXT_PUBLIC_ENV || "development";

  if (env === "production") return null;

  const config = {
    staging: { label: "STAGING", bg: "bg-orange-500", text: "text-white" },
    development: { label: "LOCAL DEV", bg: "bg-blue-500", text: "text-white" },
  }[env] ?? { label: env.toUpperCase(), bg: "bg-yellow-500", text: "text-black" };

  return (
    <div className={`${config.bg} ${config.text} text-center text-xs font-bold py-0.5 px-2 z-50`}>
      ⚠ {config.label} ENVIRONMENT — Data here is not production
    </div>
  );
}
