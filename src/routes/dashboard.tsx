import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { isLoggedIn } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (!isLoggedIn()) throw redirect({ to: "/login" });
  },
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard — Interview Intelligence" }],
  }),
});

type ContextRow = {
  id: string;
  title: string;
  context: string;
  hypothesis: string;
  created_at: string;
};

function DashboardPage() {
  const [rows, setRows] = useState<ContextRow[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("interview_contexts")
        .select("id,title,context,hypothesis,created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        toast.error(error.message);
        setRows([]);
        return;
      }
      setRows(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-dvh max-w-5xl mx-auto p-4 md:p-6">
      <AppHeader />

      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Interview contexts</h1>
          <p className="text-sm text-sys-muted">
            Each context holds the setup for one interview.
          </p>
        </div>
        <Button asChild>
          <Link to="/contexts/new">
            <Plus className="size-4" />
            Create new context
          </Link>
        </Button>
      </div>

      {rows === null ? (
        <p className="text-sm text-sys-muted font-mono">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <FileText className="size-8 mx-auto text-sys-muted mb-3" />
          <p className="text-sm text-sys-muted mb-4">
            No interview contexts yet.
          </p>
          <Button asChild variant="outline">
            <Link to="/contexts/new">
              <Plus className="size-4" />
              Create your first context
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/contexts/$id"
                params={{ id: r.id }}
                className="block bg-card border border-border rounded-lg p-4 hover:border-sys-cyan/60 transition-colors"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted">
                  {new Date(r.created_at).toLocaleString()}
                </p>
                <h3 className="mt-1 font-semibold truncate">{r.title}</h3>
                <p className="mt-2 text-sm text-sys-muted line-clamp-2">
                  {r.context || "No context provided."}
                </p>
                {r.hypothesis ? (
                  <p className="mt-2 text-xs text-sys-cyan/80 line-clamp-2">H: {r.hypothesis}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
