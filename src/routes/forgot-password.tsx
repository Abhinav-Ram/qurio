import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isLoggedIn } from "@/lib/auth";
import { resetPasswordByUsername, checkUsernameExists } from "@/server/auth.functions";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: () => {
    if (isLoggedIn()) throw redirect({ to: "/dashboard" });
  },
  component: ForgotPasswordPage,
  head: () => ({
    meta: [{ title: "Reset password — QURIO" }],
  }),
});

const USERNAME_RE = /^[A-Za-z0-9_.]{3,32}$/;

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"username" | "newPassword">("username");
  const [username, setUsername] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const [checking, setChecking] = useState(false);

  async function onSubmitUsername(e: FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!USERNAME_RE.test(u)) {
      toast.error("Enter a valid username");
      return;
    }
    setChecking(true);
    try {
      const res = await checkUsernameExists({ data: { username: u } });
      if (!res.exists) {
        toast.error("No account found with that username");
        return;
      }
      setUsername(u);
      setConfirmOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setChecking(false);
    }
  }

  async function onSubmitNewPassword(e: FormEvent) {
    e.preventDefault();
    if (!allPwOk) {
      toast.error("Password does not meet all requirements");
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetPasswordByUsername({
        data: { username, newPassword: password },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Password updated — please sign in");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-5">
        <div className="space-y-1">
          <p className="font-mono text-[11px] tracking-widest text-sys-cyan uppercase">
            Interviewer console
          </p>
          <h1 className="text-xl font-semibold">
            {step === "username" ? "Reset password" : "Set new password"}
          </h1>
          <p className="text-xs text-sys-muted">
            {step === "username"
              ? "Enter your username to reset your password."
              : `Setting a new password for ${username}.`}
          </p>
        </div>

        {step === "username" ? (
          <form onSubmit={onSubmitUsername} className="space-y-4">
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

            <Button type="submit" disabled={checking} className="w-full">
              {checking ? "Checking…" : "Continue"}
            </Button>

            <p className="text-xs text-center text-sys-muted">
              <Link to="/login" className="text-sys-cyan hover:underline">
                ← Back to sign in
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={onSubmitNewPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider">
                New password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-xs uppercase tracking-wider"
              >
                Confirm new password
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

            <Button
              type="submit"
              disabled={submitting || !allPwOk}
              className="w-full"
            >
              {submitting ? "Updating…" : "Update password"}
            </Button>

            <p className="text-xs text-center text-sys-muted">
              <Link to="/login" className="text-sys-cyan hover:underline">
                ← Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset password for {username}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be taken to a page to set a new password. The old password will
              stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                setStep("newPassword");
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
