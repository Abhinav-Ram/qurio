create or replace function public.admin_reset_password_by_username(
  p_username text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path to public, auth, extensions
as $$
declare
  v_user_id uuid;
begin
  if p_username is null or length(trim(p_username)) = 0 then
    return false;
  end if;
  if p_new_password is null or length(p_new_password) < 8 then
    raise exception 'password too short';
  end if;

  select user_id into v_user_id
    from public.profiles
    where username = p_username::citext
    limit 1;

  if v_user_id is null then
    return false;
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_user_id;

  return true;
end;
$$;

revoke all on function public.admin_reset_password_by_username(text, text) from public, anon, authenticated;
grant execute on function public.admin_reset_password_by_username(text, text) to service_role;