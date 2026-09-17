-- ScamCheck Forum — moderation migration
-- Run this file once in Supabase SQL Editor after the original forum schema.
-- It enables moderator deletion of posts and suspend/restore controls for Forum members.

alter table public.profiles add column if not exists forum_status varchar(20) not null default 'active';
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspension_reason varchar(300);
alter table public.profiles drop constraint if exists profiles_forum_status_check;
alter table public.profiles add constraint profiles_forum_status_check check (forum_status in ('active', 'suspended'));

create or replace function public.is_forum_moderator()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'moderator' and forum_status = 'active'
  );
$$;

create or replace function public.is_active_forum_member()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and forum_status = 'active'
  );
$$;

create or replace function public.set_forum_member_status(
  target_user_id uuid,
  new_forum_status varchar,
  moderation_reason varchar default null
)
returns table (id uuid, display_name varchar, forum_status varchar)
language plpgsql
security definer set search_path = public
as $$
declare
  target_role varchar;
begin
  if not public.is_forum_moderator() then
    raise exception 'Only an active Forum moderator can manage members.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'A moderator cannot change their own Forum access.';
  end if;
  if new_forum_status not in ('active', 'suspended') then
    raise exception 'Invalid Forum access status.';
  end if;

  select role into target_role from public.profiles where profiles.id = target_user_id;
  if target_role is null then
    raise exception 'Forum member was not found.';
  end if;
  if target_role = 'moderator' then
    raise exception 'Moderator accounts cannot be changed here.';
  end if;

  return query
  update public.profiles
     set forum_status = new_forum_status,
         suspended_at = case when new_forum_status = 'suspended' then now() else null end,
         suspension_reason = case when new_forum_status = 'suspended' then nullif(left(trim(coalesce(moderation_reason, '')), 300), '') else null end
   where profiles.id = target_user_id
  returning profiles.id, profiles.display_name, profiles.forum_status;
end;
$$;

drop policy if exists "Forum members can view profiles" on public.profiles;
create policy "Forum members can view profiles"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_forum_member());

drop policy if exists "Forum members can read visible posts" on public.posts;
create policy "Forum members can read visible posts"
  on public.posts for select to authenticated
  using (public.is_active_forum_member() and (status = 'published' or public.is_forum_moderator()));

drop policy if exists "Forum members can publish their posts" on public.posts;
create policy "Forum members can publish their posts"
  on public.posts for insert to authenticated
  with check (public.is_active_forum_member() and auth.uid() = author_id and status = 'published');

drop policy if exists "Moderators can delete posts" on public.posts;
create policy "Moderators can delete posts"
  on public.posts for delete to authenticated
  using (public.is_forum_moderator());

drop policy if exists "Forum members can read replies" on public.replies;
create policy "Forum members can read replies"
  on public.replies for select to authenticated
  using (
    public.is_active_forum_member()
    and exists (
      select 1 from public.posts p
      where p.id = post_id and (p.status = 'published' or public.is_forum_moderator())
    )
  );

drop policy if exists "Forum members can publish replies" on public.replies;
create policy "Forum members can publish replies"
  on public.replies for insert to authenticated
  with check (
    public.is_active_forum_member()
    and auth.uid() = author_id
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
  );

drop policy if exists "Forum members can report posts" on public.post_reports;
create policy "Forum members can report posts"
  on public.post_reports for insert to authenticated
  with check (public.is_active_forum_member() and auth.uid() = reporter_id);

grant select, insert, update, delete on public.posts to authenticated;
grant execute on function public.set_forum_member_status(uuid, varchar, varchar) to authenticated;
