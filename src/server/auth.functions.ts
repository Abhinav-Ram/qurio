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

/**
 * Resets a user's password by username. No verification — prototype only.
 * Looks up the user_id via the profiles table, then updates the auth user.
 */
export const resetPasswordByUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResetSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();

    if (profileErr) {
      throw new Error(profileErr.message);
    }
    if (!profile) {
      throw new Error("No account found with that username");
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      profile.user_id,
      { password: data.newPassword },
    );
    if (updateErr) {
      throw new Error(updateErr.message);
    }
    return { ok: true as const };
  });
