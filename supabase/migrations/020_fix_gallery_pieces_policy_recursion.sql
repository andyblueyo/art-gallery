-- Migration 020: fix "infinite recursion detected in policy for relation gallery_pieces"
--
-- 017's WITH CHECK on gallery_pieces queried inventory_items to confirm the
-- caller owns the edition. inventory_items' SELECT policy ("inventory_items_read")
-- itself queries gallery_pieces (editions hanging on any wall are readable),
-- so policy expansion looped gallery_pieces -> inventory_items -> gallery_pieces
-- and every INSERT/UPDATE on gallery_pieces failed. The gallery editor's save
-- (an upsert) was broken from 017 until this. Reads were unaffected.
--
-- Fix: do the ownership check in a SECURITY DEFINER function, the same pattern
-- as is_admin(). It reads inventory_items as the table owner, so no
-- inventory_items policy is expanded and the loop is gone. Behaviour is the
-- same as 017 intended.

begin;

create or replace function public.owns_inventory_item(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.inventory_items
    where id = p_item
      and owned_by = auth.uid()
      and deleted_at is null
  );
$$;

revoke all on function public.owns_inventory_item(uuid) from public;
grant execute on function public.owns_inventory_item(uuid) to anon, authenticated, service_role;

drop policy if exists "gallery_pieces_write_own" on public.gallery_pieces;

create policy "gallery_pieces_write_own"
  on public.gallery_pieces for all
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_pieces.gallery_id
        and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_pieces.gallery_id
        and g.user_id = auth.uid()
    )
    and public.owns_inventory_item(gallery_pieces.inventory_item_id)
  );

commit;
