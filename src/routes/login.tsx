import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLoggedIn } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (isLoggedIn()) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Sign in — Interview Intelligence" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function resolveEmail(input: string): Promise<string | null> {
    const trimmed = input.trim();
    if (!trimmed) return null;
    // If it already looks like an email, use it directly.
    if (trimmed.includes("@")) return trimmed.toLowerCase();
    // Otherwise look it up via the username.
    const { data, error } = await supabase.rpc("lookup_email_by_identifier", {
      identifier: trimmed,
    });
    if (error) {
      console.error("lookup_email_by_identifier failed", error);
      return null;
    }
    return (data as string | null) ?? null;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const email = await resolveEmail(identifier);
      if (!email) {
        toast.error("No account found with that username or email");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Signed in");
      navigate({ to: "/dashboard" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-5"
      >
        <div className="space-y-1">
          <p className="font-mono text-[11px] tracking-widest text-sys-cyan uppercase">
            Interviewer console
          </p>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-xs text-sys-muted">Use your username or email.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="identifier" className="text-xs uppercase tracking-wider">
            Username or email
          </Label>
          <Input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs uppercase tracking-wider">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs text-sys-cyan hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-xs text-center text-sys-muted">
          Don't have an account?{" "}
          <Link to="/register" className="text-sys-cyan hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
