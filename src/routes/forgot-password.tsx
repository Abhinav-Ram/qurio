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

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: () => {
    if (isLoggedIn()) throw redirect({ to: "/dashboard" });
  },
  component: ForgotPasswordPage,
  head: () => ({
    meta: [{ title: "Reset password — Interview Intelligence" }],
  }),
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp" | "newPassword">("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em) return;
    setBusy(true);
    try {
      // resetPasswordForEmail with no redirect URL forces an email-OTP flow,
      // which we then verify with verifyOtp({ type: 'recovery' }).
      const { error } = await supabase.auth.resetPasswordForEmail(em);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("If that email exists, a code has been sent");
      setStep("otp");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "recovery",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      // verifyOtp(recovery) signs the user in temporarily so updateUser works.
      setStep("newPassword");
    } finally {
      setBusy(false);
    }
  }

  async function setPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated — you're signed in");
      navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
      );
      if (error) toast.error(error.message);
      else toast.success("New code sent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-5">
        <div className="space-y-1">
          <p className="font-mono text-[11px] tracking-widest text-sys-cyan uppercase">
            Account recovery
          </p>
          <h1 className="text-xl font-semibold">
            {step === "email"
              ? "Reset your password"
              : step === "otp"
                ? "Enter the code"
                : "Choose a new password"}
          </h1>
          <p className="text-xs text-sys-muted">
            {step === "email"
              ? "We'll email you a 6-digit code to verify it's you."
              : step === "otp"
                ? `Code sent to ${email}.`
                : "Pick something you'll remember."}
          </p>
        </div>

        {step === "email" && (
          <form onSubmit={sendCode} className="space-y-4">
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
                autoFocus
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Sending…" : "Send code"}
            </Button>
            <p className="text-xs text-center text-sys-muted">
              Remembered it?{" "}
              <Link to="/login" className="text-sys-cyan hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyCode} className="space-y-4">
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
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Verifying…" : "Verify code"}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-sys-muted hover:text-sys-text"
              >
                ← Use a different email
              </button>
              <button
                type="button"
                onClick={resendCode}
                disabled={busy}
                className="text-sys-cyan hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        {step === "newPassword" && (
          <form onSubmit={setPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-xs uppercase tracking-wider">
                New password
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                autoFocus
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
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
