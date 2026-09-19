-- Migration 013: users can no longer write their own coin_balance or tier
--
-- Live state before this (dumped 2026-09-19): "owners can update profile" was
-- FOR ALL using (auth.uid() = id), and authenticated held table-wide INSERT and
-- UPDATE. So any logged-in user could PATCH their own coin_balance or tier with
-- the anon key, sign up with any balance, or delete their own profile.
--
-- Fix: column-level privileges. INSERT/UPDATE are revoked table-wide and granted
-- back only on the columns the app writes (AuthForm insert, ProfileEditor,
-- gallery layout_mode). coin_balance, tier and created_at are left out, so
-- signup gets the defaults and only security definer functions (transfer_coins,
-- remove_artwork), which run as the table owner, can change balances.
--
-- When you add a profile column users should edit, add it to both grants
-- below, or saving it fails with "permission denied for table profiles".
--
-- The policy is split into insert + update; no delete policy, and the app
-- never deletes profiles.

begin;

drop policy if exists "owners can update profile" on public.profiles;

create policy "owners can insert profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "owners can update profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke insert, update on public.profiles from anon, authenticated;

grant insert (
  id, handle, display_name, bio, location, instagram_url, avatar_url, layout_mode,
  venmo_handle, cashapp_handle, kofi_handle, patreon_handle, paypal_handle, buymeacoffee_handle
) on public.profiles to authenticated;

grant update (
  handle, display_name, bio, location, instagram_url, avatar_url, layout_mode,
  venmo_handle, cashapp_handle, kofi_handle, patreon_handle, paypal_handle, buymeacoffee_handle
) on public.profiles to authenticated;

commit;
