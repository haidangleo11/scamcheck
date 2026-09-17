-- ScamCheck Forum — compact reactions for replies / comments
-- Run this file in the Supabase SQL Editor for project bbbzewhitjfdwhjqdsrb.
-- It is safe to run again. Reactions are private per signed-in Forum member;
-- the browser can read only aggregate counts plus its own reacted state.
-- Keep FORUM_REPLY_REACTION_EMOJIS in the client in sync with this catalogue.

-- One shared, immutable catalogue avoids accepting arbitrary text while allowing
-- the full comment picker rather than only the five quick-reaction buttons.
create or replace function public.is_valid_forum_reply_reaction_emoji(selected_emoji text)
returns boolean
language sql
immutable
strict
set search_path = public
as $$
  select selected_emoji = any (array[
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😍', '🥰', '😘', '😋', '😎', '🤓', '🫡',
    '🤔', '🫣', '🤭', '🤫', '🤗', '🤨', '😐', '😑', '😶', '🫥', '😶‍🌫️', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫',
    '🥱', '😴', '😌', '🤤', '😓', '😔', '😕', '🫤', '🙁', '☹️', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩',
    '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😵‍💫', '🥳', '🥺', '🤠', '🤡', '💀', '👻', '👀', '💯', '💢', '💤',
    '👍', '👎', '👏', '🙌', '🫶', '🤝', '🙏', '💪', '✌️', '🤞', '🤟', '🤘', '👌', '👋', '❤️', '🧡', '💛', '💚', '💙', '💜',
    '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💖', '💗', '💓', '💞', '💘', '✨', '⭐', '🔥', '🎉', '🎊', '✅', '⚠️', '🚨', '🛡️'
  ]::text[]);
$$;

create table if not exists public.reply_reactions (
  reply_id bigint not null references public.replies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji varchar(16) not null,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id, emoji),
  constraint reply_reactions_emoji_check
    check (public.is_valid_forum_reply_reaction_emoji(emoji))
);

-- The first version of this migration allowed only five quick reactions. These
-- idempotent changes also upgrade an already-created table to the full picker.
alter table public.reply_reactions alter column emoji type varchar(16);
alter table public.reply_reactions drop constraint if exists reply_reactions_emoji_check;
alter table public.reply_reactions add constraint reply_reactions_emoji_check
  check (public.is_valid_forum_reply_reaction_emoji(emoji));

create index if not exists reply_reactions_reply_id_idx
  on public.reply_reactions (reply_id, emoji);

-- Reactions are exposed only through the narrowly-scoped RPCs below. This
-- prevents clients from reading which individual member reacted to a comment.
alter table public.reply_reactions enable row level security;
revoke all on public.reply_reactions from anon, authenticated;

create or replace function public.get_forum_reply_reactions(target_reply_ids bigint[])
returns table (reply_id bigint, emoji text, reaction_count bigint, reacted boolean)
language sql
stable
security definer set search_path = public
as $$
  select
    reaction.reply_id,
    reaction.emoji::text,
    count(*)::bigint as reaction_count,
    bool_or(reaction.user_id = auth.uid()) as reacted
  from public.reply_reactions reaction
  join public.replies reply on reply.id = reaction.reply_id
  join public.posts post on post.id = reply.post_id
  where public.is_active_forum_member()
    and post.status = 'published'
    and reaction.reply_id = any(coalesce(target_reply_ids, array[]::bigint[]))
  group by reaction.reply_id, reaction.emoji
  order by reaction.reply_id, reaction.emoji;
$$;

create or replace function public.toggle_forum_reply_reaction(
  target_reply_id bigint,
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

  if not public.is_valid_forum_reply_reaction_emoji(selected_emoji) then
    raise exception 'Unsupported Forum reaction.';
  end if;

  -- A reply is reactable only when the conversation is publicly visible. This
  -- avoids exposing reactions attached to pending, rejected, or hidden posts.
  if not exists (
    select 1
    from public.replies reply
    join public.posts post on post.id = reply.post_id
    where reply.id = target_reply_id
      and post.status = 'published'
  ) then
    raise exception 'This Forum comment is not available for reactions.';
  end if;

  delete from public.reply_reactions
  where reply_id = target_reply_id
    and user_id = auth.uid()
    and emoji = selected_emoji;

  if not found then
    insert into public.reply_reactions (reply_id, user_id, emoji)
    values (target_reply_id, auth.uid(), selected_emoji)
    on conflict do nothing;
  end if;

  return query
  select
    reaction.emoji::text,
    count(*)::bigint as reaction_count,
    bool_or(reaction.user_id = auth.uid()) as reacted
  from public.reply_reactions reaction
  where reaction.reply_id = target_reply_id
  group by reaction.emoji
  order by reaction.emoji;
end;
$$;

grant execute on function public.get_forum_reply_reactions(bigint[]) to authenticated;
grant execute on function public.toggle_forum_reply_reaction(bigint, text) to authenticated;
revoke execute on function public.get_forum_reply_reactions(bigint[]) from public;
revoke execute on function public.toggle_forum_reply_reaction(bigint, text) from public;

-- Make the new RPC signatures immediately visible to Supabase's REST layer.
notify pgrst, 'reload schema';
