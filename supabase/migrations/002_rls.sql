-- ComplianceOS — Row Level Security
-- Run AFTER 001_schema.sql

-- ============================================================
-- Helper functions
-- ============================================================
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.current_role() in ('admin','staff')
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_role() = 'admin'
$$;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.filing_types enable row level security;
alter table public.filings enable row level security;
alter table public.filing_assignees enable row level security;
alter table public.filing_activity enable row level security;
alter table public.filing_documents enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.notifications enable row level security;
alter table public.reminder_log enable row level security;
alter table public.app_settings enable row level security;

-- ============================================================
-- CLIENTS
-- ============================================================
drop policy if exists clients_staff_all on public.clients;
create policy clients_staff_all on public.clients
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists clients_self_read on public.clients;
create policy clients_self_read on public.clients
  for select to authenticated
  using (id = public.current_client_id());

-- ============================================================
-- PROFILES
-- ============================================================
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Staff can see coworker names (needed for assignee pickers)
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles
  for select to authenticated
  using (public.is_staff());

-- ============================================================
-- FILING TYPES (read for all authenticated, write admin)
-- ============================================================
drop policy if exists filing_types_read on public.filing_types;
create policy filing_types_read on public.filing_types
  for select to authenticated using (true);

drop policy if exists filing_types_admin_write on public.filing_types;
create policy filing_types_admin_write on public.filing_types
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- FILINGS
-- ============================================================
drop policy if exists filings_staff_all on public.filings;
create policy filings_staff_all on public.filings
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists filings_client_read on public.filings;
create policy filings_client_read on public.filings
  for select to authenticated
  using (client_id = public.current_client_id());

-- ============================================================
-- FILING ASSIGNEES
-- ============================================================
drop policy if exists assignees_staff_all on public.filing_assignees;
create policy assignees_staff_all on public.filing_assignees
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists assignees_client_read on public.filing_assignees;
create policy assignees_client_read on public.filing_assignees
  for select to authenticated
  using (filing_id in (select id from public.filings where client_id = public.current_client_id()));

-- ============================================================
-- FILING ACTIVITY
-- ============================================================
drop policy if exists activity_staff_all on public.filing_activity;
create policy activity_staff_all on public.filing_activity
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- FILING DOCUMENTS
-- ============================================================
drop policy if exists documents_staff_all on public.filing_documents;
create policy documents_staff_all on public.filing_documents
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists documents_client_read on public.filing_documents;
create policy documents_client_read on public.filing_documents
  for select to authenticated
  using (filing_id in (select id from public.filings where client_id = public.current_client_id()));

-- ============================================================
-- RECURRING TEMPLATES (staff only)
-- ============================================================
drop policy if exists recurring_staff_all on public.recurring_templates;
create policy recurring_staff_all on public.recurring_templates
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- NOTIFICATIONS (own only)
-- ============================================================
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- REMINDER LOG (staff read; inserts by service role only)
-- ============================================================
drop policy if exists reminder_log_staff_read on public.reminder_log;
create policy reminder_log_staff_read on public.reminder_log
  for select to authenticated
  using (public.is_staff());

-- ============================================================
-- APP SETTINGS
-- ============================================================
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- STORAGE bucket policy (filing-proofs)
-- Run in Supabase dashboard > Storage > Policies, or:
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('filing-proofs','filing-proofs',false) on conflict do nothing;

-- drop policy if exists "proofs staff all" on storage.objects;
-- create policy "proofs staff all" on storage.objects for all to authenticated
--   using (bucket_id = 'filing-proofs' and public.is_staff())
--   with check (bucket_id = 'filing-proofs' and public.is_staff());

-- drop policy if exists "proofs client read" on storage.objects;
-- create policy "proofs client read" on storage.objects for select to authenticated
--   using (bucket_id = 'filing-proofs' and (storage.foldername(name))[1]::uuid in (
--     select id from public.filings where client_id = public.current_client_id()
--   ));