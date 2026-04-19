import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { isLoggedIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Quote,
  GitBranch,
  Scale,
  Layers,
  Users,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (isLoggedIn()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Interview Intelligence — Evidence-backed qualitative reasoning" },
      {
        name: "description",
        content:
          "Turn interview transcripts into auditable, evidence-backed decisions. Preserve every voice, expose contradictions, and validate hypotheses against real responses.",
      },
      {
        property: "og:title",
        content: "Interview Intelligence — Evidence-backed qualitative reasoning",
      },
      {
        property: "og:description",
        content:
          "A qualitative reasoning system that preserves individual voices, exposes contradictions, and validates decisions against real interview data.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-sys-bg text-sys-text">
      <SiteHeader />
      <main>
        <Hero />
        <ProblemStatement />
        <AnalyserSection />
        <DecisionSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-sys-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-sys-cyan">
            Interview.Intel
          </span>
          <span className="hidden text-xs text-sys-muted sm:inline">
            Evidence-backed reasoning
          </span>
        </Link>
        <nav className="flex items-center gap-2">
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

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-sys-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--color-sys-grid) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at top, black 30%, transparent 75%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-sys-panel px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-sys-muted">
            <span className="size-1.5 rounded-full bg-sys-cyan" />
            Qualitative reasoning, not just collection
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Interview research fails at{" "}
            <span className="text-sys-cyan">reasoning</span>,
            <br className="hidden sm:block" /> not at data collection.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-sys-muted">
            An evidence-backed qualitative reasoning system that preserves
            individual voices, exposes contradictions, and validates decisions
            against real interview data — every claim traceable to a verbatim
            quote.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">
                Go to App
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemStatement() {
  return (
    <section className="border-b border-border bg-sys-panel">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sys-cyan">
              The Problem
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Themes flatten people.
            </h2>
          </div>
          <div className="md:col-span-8">
            <p className="text-lg leading-relaxed text-sys-text">
              Most tools collapse interviews into tidy themes — and lose the
              individual reasoning that made the research worth doing. Outliers
              disappear, contradictions get smoothed away, and the final
              decision is built on summary, not on evidence.
            </p>
            <p className="mt-4 text-base leading-relaxed text-sys-muted">
              We do the opposite. Every interview is decomposed into atomic
              claims. Every claim stays attached to the person who said it.
              Every decision is traceable back to the quotes that produced it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnalyserSection() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sys-cyan">
            The Analyser
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            A structured template that respects every voice.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-sys-muted">
            Claims are extracted atomically — small enough that nothing can be
            split further without losing meaning. The decision-making engine is
            shaped by every single claim, not just the loudest pattern.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <FeatureCard
            icon={<Layers className="size-5" />}
            title="Atomic claim structure"
            body="Responses are decomposed into the smallest meaningful units. Every claim influences the final decision — no idea is averaged away."
          />
          <FeatureCard
            icon={<Users className="size-5" />}
            title="Every interviewer counts equally"
            body="Each participant is preserved as a distinct voice rather than reduced to a theme. Equal weight, full attribution."
          />
          <FeatureCard
            icon={<GitBranch className="size-5" />}
            title="Contradictions made visible"
            body="When viewpoints conflict, we surface the disagreement instead of hiding it inside a generic summary."
          />
        </div>
      </div>
    </section>
  );
}

function DecisionSection() {
  return (
    <section className="border-b border-border bg-sys-panel">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sys-cyan">
            The Decision Engine
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Hypotheses, validated against real responses.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-sys-muted">
            Decisions are explicit. Hypotheses are stated up-front — or
            scaffolded for you — and checked directly against the claims that
            came out of your interviews.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <FeatureCard
            icon={<Scale className="size-5" />}
            title="Hypothesis-first reasoning"
            body="Lay down what you believe before you collect — or use a placeholder. The system reports support, contradiction, or insufficient evidence."
          />
          <FeatureCard
            icon={<ShieldCheck className="size-5" />}
            title="Auditable verdicts"
            body="Every conclusion references the specific atomic claims behind it. No black-box summaries — only evidence you can re-read."
          />
        </div>

        <div className="mt-12 rounded-lg border border-border bg-sys-bg p-6">
          <div className="flex items-start gap-4">
            <Quote className="mt-1 size-5 shrink-0 text-sys-cyan" />
            <div>
              <p className="text-base leading-relaxed text-sys-text">
                The output isn't a vibe. It's a verdict — and you can click
                straight through to the verbatim quote that produced it.
              </p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-sys-muted">
                Built for researchers, PMs and founders who refuse to lie to
                themselves.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Stop summarising. Start reasoning.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-sys-muted">
          Run your next round of interviews through a system that treats every
          response as evidence.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/login">
              Go to App
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-lg border border-border bg-sys-bg p-6 transition-colors hover:border-sys-cyan/50">
      <div className="flex size-9 items-center justify-center rounded-md border border-border bg-sys-panel text-sys-cyan">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-sys-muted">{body}</p>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-8 sm:flex-row sm:items-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-sys-muted">
          Interview.Intel — Evidence over intuition
        </span>
        <div className="flex items-center gap-4 text-xs text-sys-muted">
          <Link to="/login" className="hover:text-sys-text">
            Go to App
          </Link>
        </div>
      </div>
    </footer>
  );
}
