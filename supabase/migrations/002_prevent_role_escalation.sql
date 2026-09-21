-- Prevent non-admins from changing their own role
-- (SQL Editor / service role with auth.uid() null is allowed for bootstrap)
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
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

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();
