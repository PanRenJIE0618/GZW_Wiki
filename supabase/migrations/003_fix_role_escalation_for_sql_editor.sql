-- Allow role changes from SQL Editor / service role (no auth.uid),
-- while still blocking non-admin users from the app.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    -- Dashboard SQL / migrations / service role: auth.uid() is null
    if auth.uid() is null then
      return new;
    end if;

    if public.current_user_role() is distinct from 'admin' then
      raise exception 'Only admins can change roles';
    end if;
  end if;
  return new;
end;
$$;
