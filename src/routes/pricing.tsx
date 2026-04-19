import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — QURIO" },
      {
        name: "description",
        content:
          "Simple, transparent pricing for QURIO. Choose Free, Basic, or Pro to run evidence-backed qualitative research at the scale you need.",
      },
      { property: "og:title", content: "Pricing — QURIO" },
      {
        property: "og:description",
        content:
          "Free, Basic, and Pro plans for evidence-backed qualitative reasoning.",
      },
    ],
  }),
  component: PricingPage,
});

type Tier = {
  name: string;
  tagline: string;
  price: string;
  priceSuffix?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    tagline: "Try the system on a small project.",
    price: "$0",
    priceSuffix: "/ forever",
    features: [
      "2 contexts",
      "Up to 5 participants per context",
      "Basic analysis",
    ],
    cta: "Get started",
  },
  {
    name: "Basic",
    tagline: "For ongoing research work.",
    price: "$—",
    priceSuffix: "/ month",
    features: [
      "10 contexts",
      "Up to 15 participants per context",
      "Advanced analysis",
    ],
    cta: "Choose Basic",
    highlighted: true,
  },
  {
    name: "Pro",
    tagline: "For teams running research at scale.",
    price: "$—",
    priceSuffix: "/ month",
    features: [
      "Unlimited contexts",
      "Unlimited participants",
      "Advanced analysis",
    ],
    cta: "Choose Pro",
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-sys-bg text-sys-text">
      <SiteHeader />
      <main>
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sys-cyan">
                Pricing
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Pick the plan that matches your research load.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-sys-muted">
                Every plan includes the same evidence-backed reasoning engine —
                atomic claims, preserved voices, traceable verdicts. You just
                choose how much you want to run through it.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {TIERS.map((tier) => (
                <PricingCard key={tier.name} tier={tier} />
              ))}
            </div>

            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-sys-muted">
              Paid tier pricing coming soon — Free plan available today.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function PricingCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={[
        "flex flex-col rounded-lg border bg-sys-bg p-6 transition-colors",
        tier.highlighted
          ? "border-sys-cyan/60 shadow-[0_0_0_1px_var(--color-sys-cyan)]/20"
          : "border-border hover:border-sys-cyan/40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">{tier.name}</h3>
        {tier.highlighted && (
          <span className="rounded-full border border-sys-cyan/50 bg-sys-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-sys-cyan">
            Popular
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-sys-muted">{tier.tagline}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight">
          {tier.price}
        </span>
        {tier.priceSuffix && (
          <span className="text-xs text-sys-muted">{tier.priceSuffix}</span>
        )}
      </div>

      <ul className="mt-6 space-y-3 text-sm">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-sys-cyan" />
            <span className="text-sys-text">{f}</span>
          </li>
        ))}
      </ul>

    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-sys-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-sys-cyan">
            QURIO
          </span>
          <span className="hidden text-xs text-sys-muted sm:inline">
            Evidence-backed reasoning
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/pricing"
            className="rounded-md px-3 py-1.5 text-sm text-sys-text hover:text-sys-cyan"
            activeProps={{ className: "text-sys-cyan" }}
          >
            Pricing
          </Link>
          <Button asChild size="sm">
            <Link to="/login">
              Go to App
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-8 sm:flex-row sm:items-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-sys-muted">
          QURIO — Evidence over intuition
        </span>
        <div className="flex items-center gap-4 text-xs text-sys-muted">
          <Link to="/pricing" className="hover:text-sys-text">
            Pricing
          </Link>
          <Link to="/login" className="hover:text-sys-text">
            Go to App
          </Link>
        </div>
      </div>
    </footer>
  );
}
