import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ResetSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_.]+$/),
  newPassword: z.string().min(8).max(128),
});

const CheckUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_.]+$/),
});

/**
 * Check whether a username exists. Used by forgot-password step 1.
 * Uses the SECURITY DEFINER RPC `lookup_email_by_identifier` which is
 * callable by anon/authenticated, so it works even without service role.
 */
export const checkUsernameExists = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CheckUsernameSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: email, error } = await supabaseAdmin.rpc(
      "lookup_email_by_identifier",
      { identifier: data.username },
    );
    if (error) {
      return { exists: false as const, error: error.message };
    }
    return { exists: Boolean(email), error: null };
  });

/**
 * Resets a user's password by username. No verification — prototype only.
 * Uses a SECURITY DEFINER RPC that performs both lookup and password update
 * atomically server-side. Requires service-role key (RPC is restricted).
 */
export const resetPasswordByUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResetSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: ok, error } = await supabaseAdmin.rpc(
      "admin_reset_password_by_username",
      { p_username: data.username, p_new_password: data.newPassword },
    );
    if (error) {
      return { ok: false as const, error: error.message };
    }
    if (!ok) {
      return { ok: false as const, error: "No account found with that username" };
    }
    return { ok: true as const, error: null };
  });
