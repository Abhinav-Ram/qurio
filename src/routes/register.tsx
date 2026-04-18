import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
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

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "otp">("details");

  // Step 1: details
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Step 2: otp
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Password rule checks (live)
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

  async function onSubmitDetails(e: FormEvent) {
    e.preventDefault();
    const u = username.trim();
    const em = email.trim().toLowerCase();

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
      // Pre-flight username check (race-condition-safe: DB unique constraint
      // is the real guard).
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

      // Sign up — Supabase sends a confirmation OTP to the email.
      const { error } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          data: { username: u },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("We sent a 6-digit code to your email");
      setStep("otp");
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "signup",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Account verified — welcome");
      navigate({ to: "/dashboard" });
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
      });
      if (error) toast.error(error.message);
      else toast.success("New code sent");
    } finally {
      setResending(false);
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
            {step === "details" ? "Create account" : "Verify your email"}
          </h1>
          <p className="text-xs text-sys-muted">
            {step === "details"
              ? "We'll send a 6-digit code to confirm your email."
              : `Enter the code we just sent to ${email}.`}
          </p>
        </div>

        {step === "details" ? (
          <form onSubmit={onSubmitDetails} className="space-y-4">
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
              <Label htmlFor="email" className="text-xs uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Creating…" : "Create account"}
            </Button>

            <p className="text-xs text-center text-sys-muted">
              Already have an account?{" "}
              <Link to="/login" className="text-sys-cyan hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={onVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider">
                6-digit code
              </Label>
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button type="submit" disabled={verifying} className="w-full">
              {verifying ? "Verifying…" : "Verify & continue"}
            </Button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="text-sys-muted hover:text-sys-text"
              >
                ← Edit details
              </button>
              <button
                type="button"
                onClick={onResend}
                disabled={resending}
                className="text-sys-cyan hover:underline disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
