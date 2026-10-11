"use client";

type UsageModule = "Control Tower" | "Work" | "Clients" | "Team" | "Tax Team" | "BIR Center" | "Admin" | "Other";
type UsageEvent = "module_view" | "navigation" | "control_interaction" | "form_submit";
type SafeValue = boolean | number | string;

const distinctIdKey = "taxmonweb.usage.distinct-id";

function usageEnabled() {
  return process.env.NEXT_PUBLIC_USAGE_ANALYTICS_ENABLED === "true" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

function anonymousId() {
  const existing = window.localStorage.getItem(distinctIdKey);
  if (existing) return existing;
  const created = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `anon-${Date.now().toString(36)}`;
  window.localStorage.setItem(distinctIdKey, created);
  return created;
}

export function moduleForUsagePath(pathname: string): UsageModule {
  if (pathname.startsWith("/app/clients")) return "Clients";
  if (pathname.startsWith("/app/work") || pathname.startsWith("/app/my-work")) return "Work";
  if (pathname.startsWith("/app/tax-team")) return "Tax Team";
  if (pathname.startsWith("/app/team")) return "Team";
  if (pathname.startsWith("/app/bir-center")) return "BIR Center";
  if (pathname.startsWith("/app/admin")) return "Admin";
  if (pathname.startsWith("/app/control-tower")) return "Control Tower";
  return "Other";
}

export function trackModuleView(pathname: string) {
  trackUsage("module_view", { module: moduleForUsagePath(pathname) });
}

export function trackUsage(event: UsageEvent, properties: Record<string, SafeValue>) {
  if (typeof window === "undefined" || !usageEnabled()) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  void fetch(`${host.replace(/\/$/, "")}/capture/`, {
    body: JSON.stringify({
      api_key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      event,
      distinct_id: anonymousId(),
      properties: { ...properties, product: "TaxMonWeb" },
    }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

export function trackUsageInteractions(pathname: string) {
  if (typeof window === "undefined") return () => undefined;
  const currentModule = moduleForUsagePath(pathname);
  const handleClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("a, button, [role=button]") : null;
    if (!target) return;
    const explicitAction = target.dataset.usageAction;
    const isNavigation = target.matches("a[href]");
    const action = explicitAction || (isNavigation ? `navigate_${moduleForUsagePath(new URL((target as HTMLAnchorElement).href).pathname).toLowerCase().replace(/\s+/g, "_")}` : `button_${target.tagName.toLowerCase()}`);
    trackUsage(isNavigation || target.dataset.usageEvent === "navigation" ? "navigation" : "control_interaction", { action, module: currentModule });
  };
  const handleSubmit = (event: SubmitEvent) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    const formName = form?.dataset.usageForm;
    if (formName) trackUsage("form_submit", { form: formName, module: currentModule });
  };
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  return () => {
    document.removeEventListener("click", handleClick);
    document.removeEventListener("submit", handleSubmit);
  };
}
