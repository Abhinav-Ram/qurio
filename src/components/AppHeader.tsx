import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";

export function AppHeader() {
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between border-b border-border pb-3 mb-6">
      <Link to="/dashboard" className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] tracking-widest text-sys-cyan uppercase">
          Interview.Intel
        </span>
        <span className="text-xs text-sys-muted">Interviewer console</span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await signOut();
          toast.success("Signed out");
          navigate({ to: "/login" });
        }}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </header>
  );
}
