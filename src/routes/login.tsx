import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLoggedIn, login } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (isLoggedIn()) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Sign In — Interview Intelligence" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (login(username.trim(), password)) {
      toast.success("Signed in");
      navigate({ to: "/dashboard" });
    } else {
      toast.error("Invalid credentials");
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
            Interviewer Console
          </p>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-xs text-sys-muted">Use admin / admin for now.</p>
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
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
