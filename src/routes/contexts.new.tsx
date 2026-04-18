import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isLoggedIn } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contexts/new")({
  beforeLoad: () => {
    if (!isLoggedIn()) throw redirect({ to: "/login" });
  },
  component: NewContextPage,
  head: () => ({
    meta: [{ title: "New context — Interview Intelligence" }],
  }),
});

function NewContextPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (context.trim().length < 10) {
      toast.error("Add a bit more context (10+ characters).");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("interview_contexts")
      .insert({
        title: title.trim() || "Untitled Interview",
        context: context.trim(),
        hypothesis: hypothesis.trim(),
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not save context");
      return;
    }
    toast.success("Context saved");
    navigate({
      to: "/contexts/$id",
      params: { id: data.id },
      search: { autogen: "1" },
    });
  };

  return (
    <div className="min-h-dvh max-w-3xl mx-auto p-4 md:p-6">
      <AppHeader />

      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-sys-muted hover:text-sys-text mb-4"
      >
        <ArrowLeft className="size-3" />
        Back to dashboard
      </Link>

      <h1 className="text-2xl font-semibold mb-1">New interview context</h1>
      <p className="text-sm text-sys-muted mb-6">
        Frame the interview. The hypothesis is what you're trying to validate.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-xs uppercase tracking-wider">
            Title
          </Label>
          <Input
            id="title"
            placeholder="e.g. Onboarding churn — Q2 cohort"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="context" className="text-xs uppercase tracking-wider">
            Interview context
          </Label>
          <Textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="What is this interview about? Who is the user, what's the topic, what do you need to learn?"
            className="min-h-[220px] font-mono text-sm leading-relaxed"
            required
          />
          <p className="text-[11px] text-sys-muted">
            {context.length} characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hypothesis" className="text-xs uppercase tracking-wider">
            Hypothesis <span className="text-sys-muted normal-case">(optional)</span>
          </Label>
          <Textarea
            id="hypothesis"
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder="e.g. Users churn in week 1 because onboarding has too many manual setup steps."
            className="min-h-[90px] font-mono text-sm leading-relaxed"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" asChild>
            <Link to="/dashboard">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            <Sparkles className="size-4" />
            {saving ? "Saving…" : "Generate Interview"}
          </Button>
        </div>
      </form>
    </div>
  );
}
