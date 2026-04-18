ALTER FUNCTION public.admin_reset_password_by_username(text, text) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.admin_reset_password_by_username(text, text) TO service_role;