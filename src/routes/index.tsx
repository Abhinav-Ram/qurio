import { createFileRoute, redirect } from "@tanstack/react-router";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: isLoggedIn() ? "/dashboard" : "/login" });
  },
  component: () => null,
});
