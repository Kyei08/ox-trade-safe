-- Auto-assign the admin role when the designated admin email signs up.
create or replace function public.assign_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'mofokengtshehla75@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_admin_email_signup on auth.users;
create trigger on_admin_email_signup
after insert on auth.users
for each row execute function public.assign_admin_on_signup();