import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLoggedIn } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    if (isLoggedIn()) throw redirect({ to: "/dashboard" });
  },
  component: RegisterPage,
  head: () => ({
    meta: [{ title: "Create account — Interview Intelligence" }],
  }),
});

const USERNAME_RE = /^[A-Za-z0-9_.]{3,32}$/;
// Synthetic email so Supabase Auth keeps working without a real email.
// `.invalid` is reserved by RFC 2606 — guaranteed never to be a real domain.
const synthEmail = (u: string) => `${u.toLowerCase()}@users.invalid`;

function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pwRules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter (A–Z)", ok: /[A-Z]/.test(password) },
    { label: "One lowercase letter (a–z)", ok: /[a-z]/.test(password) },
    { label: "One number (0–9)", ok: /[0-9]/.test(password) },
    { label: "One symbol (!@#$…)", ok: /[^A-Za-z0-9]/.test(password) },
    {
      label: "Matches confirmation",
      ok: password.length > 0 && password === confirmPassword,
    },
  ];
  const allPwOk = pwRules.every((r) => r.ok);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const u = username.trim();

    if (!USERNAME_RE.test(u)) {
      toast.error("Username must be 3–32 chars: letters, numbers, _ or .");
      return;
    }
    if (!allPwOk) {
      toast.error("Password does not meet all requirements");
      return;
    }

    setSubmitting(true);
    try {
      const { data: available, error: availErr } = await supabase.rpc(
        "is_username_available",
        { uname: u },
      );
      if (availErr) {
        toast.error(availErr.message);
        return;
      }
      if (!available) {
        toast.error("Username is already taken");
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: synthEmail(u),
        password,
        options: { data: { username: u } },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Account created — welcome");
      navigate({ to: "/dashboard" });
    } finally {
      setSubmitting(false);
    }
  }

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
          <h1 className="text-xl font-semibold">Create account</h1>
          <p className="text-xs text-sys-muted">
            Pick a username and a strong password.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username" className="text-xs uppercase tracking-wider">
            Username
          </Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            minLength={3}
            maxLength={32}
            placeholder="jane_doe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs uppercase tracking-wider">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="confirmPassword"
            className="text-xs uppercase tracking-wider"
          >
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <ul className="space-y-1 text-xs">
          {pwRules.map((r) => (
            <li
              key={r.label}
              className={r.ok ? "text-sys-cyan" : "text-sys-muted"}
            >
              <span className="inline-block w-4">{r.ok ? "✓" : "○"}</span>
              {r.label}
            </li>
          ))}
        </ul>

        <Button type="submit" disabled={submitting || !allPwOk} className="w-full">
          {submitting ? "Creating…" : "Create account"}
        </Button>

        <p className="text-xs text-center text-sys-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-sys-cyan hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
