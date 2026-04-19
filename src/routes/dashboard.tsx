import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (!isLoggedIn()) throw redirect({ to: "/login" });
  },
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard — QURIO" }],
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
  const [pendingDelete, setPendingDelete] = useState<ContextRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setRows([]);
        return;
      }
      const { data, error } = await supabase
        .from("interview_contexts")
        .select("id,title,context,hypothesis,created_at")
        .eq("owner_id", user.id)
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

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const id = pendingDelete.id;
    // Cascade: delete dependent rows first (no FK cascade configured)
    const [{ error: qErr }, { error: rErr }] = await Promise.all([
      supabase.from("interview_questions").delete().eq("context_id", id),
      supabase.from("interview_responses").delete().eq("context_id", id),
    ]);
    if (qErr || rErr) {
      toast.error((qErr ?? rErr)!.message);
      setDeleting(false);
      return;
    }
    const { error } = await supabase.from("interview_contexts").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    setPendingDelete(null);
    toast.success("Context deleted");
  }

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
            <li key={r.id} className="relative group">
              <Link
                to="/contexts/$id"
                params={{ id: r.id }}
                className="block bg-card border border-border rounded-lg p-4 pr-12 hover:border-sys-cyan/60 transition-colors"
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
              <button
                type="button"
                aria-label={`Delete ${r.title}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPendingDelete(r);
                }}
                className="absolute top-3 right-3 p-1.5 rounded-md text-sys-muted hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this interview context?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{pendingDelete?.title}</strong>, all its
              questions, every collected response, and any analysis. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
