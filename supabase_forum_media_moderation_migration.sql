-- ScamCheck Forum — image uploads and pre-publication moderation
-- Run this file ONCE in the Supabase SQL Editor for project bbbzewhitjfdwhjqdsrb.
-- It is safe to run again: existing public posts stay published.

alter table public.posts add column if not exists image_path varchar(500);

-- All existing posts were already visible. Keep them visible while new posts wait
-- for a moderator decision.
update public.posts
set status = 'published'
where status is null or status not in ('pending', 'published', 'rejected', 'hidden');

alter table public.posts alter column status set default 'pending';
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check
  check (status in ('pending', 'published', 'rejected', 'hidden'));

-- Members can read public posts and their own submissions; moderators can read
-- every status so that they can review the moderation queue.
drop policy if exists "Forum members can read visible posts" on public.posts;
create policy "Forum members can read visible posts"
  on public.posts for select to authenticated
  using (
    public.is_active_forum_member()
    and (
      status = 'published'
      or author_id = auth.uid()
      or public.is_forum_moderator()
    )
  );

-- A regular member may only create their own post in the pending state. Only the
-- moderator update policy can publish, reject, or hide a post.
drop policy if exists "Forum members can publish their posts" on public.posts;
create policy "Forum members can submit posts for review"
  on public.posts for insert to authenticated
  with check (
    public.is_active_forum_member()
    and auth.uid() = author_id
    and status = 'pending'
  );

-- Storage bucket for optional Forum attachments. The public URL is deliberately
-- used only for reviewed Forum content. The UI prohibits sensitive screenshots.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forum-images',
  'forum-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

drop policy if exists "Forum members can upload their own images" on storage.objects;
create policy "Forum members can upload their own images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'forum-images'
    and public.is_active_forum_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Forum members can remove their own images" on storage.objects;
create policy "Forum members can remove their own images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'forum-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_forum_moderator()
    )
  );
