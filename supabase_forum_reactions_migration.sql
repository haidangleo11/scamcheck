-- ScamCheck Forum — compact post reactions
-- Run this once in the Supabase SQL Editor for project bbbzewhitjfdwhjqdsrb.
-- Reactions are stored per signed-in Forum member and are only available on
-- published posts. The public client uses the two RPCs below; it never receives
-- another member's identifier.

create table if not exists public.post_reactions (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji varchar(8) not null check (emoji in ('👍', '❤️', '😂', '😮', '🙏')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

create index if not exists post_reactions_post_id_idx
  on public.post_reactions (post_id, emoji);

alter table public.post_reactions enable row level security;
revoke all on public.post_reactions from anon, authenticated;

create or replace function public.get_forum_post_reactions(target_post_ids bigint[])
returns table (post_id bigint, emoji text, reaction_count bigint, reacted boolean)
language sql
stable
security definer set search_path = public
as $$
  select
    reaction.post_id,
    reaction.emoji::text,
    count(*)::bigint as reaction_count,
    bool_or(reaction.user_id = auth.uid()) as reacted
  from public.post_reactions reaction
  join public.posts post on post.id = reaction.post_id
  where public.is_active_forum_member()
    and post.status = 'published'
    and reaction.post_id = any(coalesce(target_post_ids, array[]::bigint[]))
  group by reaction.post_id, reaction.emoji
  order by reaction.post_id, reaction.emoji;
$$;

create or replace function public.toggle_forum_post_reaction(
  target_post_id bigint,
  selected_emoji text
)
returns table (emoji text, reaction_count bigint, reacted boolean)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_active_forum_member() then
    raise exception 'Only active Forum members can react.';
  end if;

  if selected_emoji not in ('👍', '❤️', '😂', '😮', '🙏') then
    raise exception 'Unsupported Forum reaction.';
  end if;

  if not exists (
    select 1 from public.posts
    where id = target_post_id and status = 'published'
  ) then
    raise exception 'This Forum post is not available for reactions.';
  end if;

  delete from public.post_reactions
  where post_id = target_post_id
    and user_id = auth.uid()
    and emoji = selected_emoji;

  if not found then
    insert into public.post_reactions (post_id, user_id, emoji)
    values (target_post_id, auth.uid(), selected_emoji)
    on conflict do nothing;
  end if;

  return query
  select
    reaction.emoji::text,
    count(*)::bigint as reaction_count,
    bool_or(reaction.user_id = auth.uid()) as reacted
  from public.post_reactions reaction
  where reaction.post_id = target_post_id
  group by reaction.emoji
  order by reaction.emoji;
end;
$$;

grant execute on function public.get_forum_post_reactions(bigint[]) to authenticated;
grant execute on function public.toggle_forum_post_reaction(bigint, text) to authenticated;
revoke execute on function public.get_forum_post_reactions(bigint[]) from public;
revoke execute on function public.toggle_forum_post_reaction(bigint, text) from public;
