-- Migration 019: create edition rows that upload failed to create
--
-- Checked 2026-09-19: 9 live artworks were missing exactly one edition, always
-- the last (edition 1 of 1 for eight of them, edition 5 of 5 for "chinatown").
-- None soft-deleted, none for sale. Without the row that edition can never be
-- listed or bought. editions_remaining already counts it (1 and 5), so it
-- needs no change once the row exists.
--
-- Written generally (every missing number 0..edition_total on a live artwork),
-- so it is safe to re-run. New editions belong to the artist, are listed only
-- if the artwork is for sale (same as the ArtworkCard toggle), and take the
-- artwork's upload time as acquired_at like their sibling editions.
--
-- Single statement, no begin/commit, so the SQL editor shows what was created.
-- Expected: 9 rows.

with inserted as (
  insert into public.inventory_items (owned_by, artwork_id, edition_number, listed_for_sale, acquired_at)
  select a.artist_id, a.id, n, (n > 0 and a.for_sale), coalesce(a.created_at, now())
  from public.artworks a
  cross join lateral generate_series(0, coalesce(a.edition_total, 0)) as n
  where a.deleted_at is null
    and a.artist_id is not null
    and not exists (
      select 1 from public.inventory_items ii
      where ii.artwork_id = a.id and ii.edition_number = n
    )
  returning artwork_id, edition_number
)
select p.handle as artist, a.title, i.edition_number, a.edition_total, a.created_at as uploaded_at
from inserted i
join public.artworks a on a.id = i.artwork_id
left join public.profiles p on p.id = a.artist_id
order by a.created_at;
