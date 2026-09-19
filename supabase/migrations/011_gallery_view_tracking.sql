-- Migration 011: record gallery views through one function, and let owners read them
--
-- Live state before this (checked 2026-09-18): viewer_id already nullable,
-- gallery_id -> galleries(id), 0 rows, no view-related functions.
--
-- Rules enforced here rather than in the browser:
--   * the gallery owner's own visits are never counted
--   * the same visitor counts once per gallery per 30 minutes
--     (logged in: by viewer_id; logged out: by a random key the browser keeps)

-- 1. Key for deduping logged-out visitors
alter table public.gallery_views
  add column if not exists visitor_key uuid;

create index if not exists gallery_views_gallery_viewed_idx
  on public.gallery_views (gallery_id, viewed_at);

-- 2. The only way to record a view
create or replace function public.record_gallery_view(
  p_gallery_id uuid,
  p_visitor_key uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_owner uuid;
begin
  select user_id into v_owner from public.galleries where id = p_gallery_id;
  if v_owner is null or v_owner = v_viewer then
    return;
  end if;

  -- Serialize concurrent calls for the same visitor so the dedupe check can't race
  perform pg_advisory_xact_lock(
    hashtextextended(p_gallery_id::text || coalesce(v_viewer, p_visitor_key)::text, 0)
  );

  if exists (
    select 1 from public.gallery_views
    where gallery_id = p_gallery_id
      and viewed_at > now() - interval '30 minutes'
      and case
            when v_viewer is not null then viewer_id = v_viewer
            else viewer_id is null and visitor_key = p_visitor_key
          end
  ) then
    return;
  end if;

  insert into public.gallery_views (gallery_id, viewer_id, visitor_key)
  values (p_gallery_id, v_viewer, p_visitor_key);
end;
$$;

grant execute on function public.record_gallery_view(uuid, uuid) to anon, authenticated;

-- 3. No more direct inserts from the browser
drop policy if exists "anyone can insert gallery views" on public.gallery_views;

-- 4. Owners read views of galleries they own (old policy compared auth.uid() to a gallery id)
drop policy if exists "gallery owners can view their counts" on public.gallery_views;

create policy "gallery owners can read their views"
  on public.gallery_views for select
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_views.gallery_id
        and g.user_id = auth.uid()
    )
  );
