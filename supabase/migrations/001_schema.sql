-- ComplianceOS — Core Schema
-- Run this in Supabase SQL Editor (or via supabase CLI: supabase db push)

-- ============================================================
-- 1. CLIENTS
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pan text,
  gstin text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists clients_name_idx on public.clients (lower(name));

-- ============================================================
-- 2. PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role text not null default 'staff' check (role in ('admin','staff','client')),
  client_id uuid references public.clients(id) on delete set null,
  telegram_chat_id text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. FILING TYPES
-- ============================================================
create table if not exists public.filing_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_reminder_days int[] not null default '{5,2,0}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. FILINGS
-- ============================================================
create table if not exists public.filings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  filing_type_id uuid not null references public.filing_types(id) on delete restrict,
  period text,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','in_progress','filed')),
  filed_on date,
  arn_number text,
  remarks text,
  reminder_days int[] not null default '{5,2,0}',
  channels text[] not null default '{email,push}',
  recurring_template_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists filings_due_date_idx on public.filings (due_date);
create index if not exists filings_client_idx on public.filings (client_id);
create index if not exists filings_status_idx on public.filings (status);

-- Prevent duplicates from recurring generation
create unique index if not exists filings_recurring_unique
  on public.filings (recurring_template_id, due_date)
  where recurring_template_id is not null;

-- ============================================================
-- 5. FILING ASSIGNEES
-- ============================================================
create table if not exists public.filing_assignees (
  filing_id uuid not null references public.filings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (filing_id, user_id)
);

-- ============================================================
-- 6. FILING ACTIVITY (audit trail)
-- ============================================================
create table if not exists public.filing_activity (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists filing_activity_filing_idx on public.filing_activity (filing_id, created_at desc);

-- ============================================================
-- 7. FILING DOCUMENTS
-- ============================================================
create table if not exists public.filing_documents (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  content_type text,
  doc_type text default 'other',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists filing_documents_filing_idx on public.filing_documents (filing_id);

-- Storage bucket (run in Supabase dashboard > Storage if not exist)
-- bucket name: filing-proofs (private)

-- ============================================================
-- 8. RECURRING TEMPLATES
-- ============================================================
create table if not exists public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  filing_type_id uuid not null references public.filing_types(id) on delete restrict,
  due_months int[] not null,
  due_day int not null check (due_day between 1 and 31),
  period_label text not null default '{prev_month}',
  lookahead_days int not null default 45,
  reminder_days int[] not null default '{5,2,0}',
  channels text[] not null default '{email,push}',
  assignee_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  filing_id uuid references public.filings(id) on delete cascade,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

-- ============================================================
-- 10. REMINDER LOG (deduplication)
-- ============================================================
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null,
  days_before int not null,
  status text not null default 'sent' check (status in ('sent','failed')),
  error text,
  sent_at timestamptz not null default now()
);

-- Prevent duplicate sends (channel includes 'esc_' prefix for escalations)
create unique index if not exists reminder_log_unique
  on public.reminder_log (filing_id, user_id, channel, days_before);

-- ============================================================
-- 11. APP SETTINGS (singleton row)
-- ============================================================
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  escalation_enabled boolean not null default false,
  escalation_days int[] not null default '{1,3,7}',
  escalation_channels text[] not null default '{email,push}',
  escalate_to_admins boolean not null default true,
  escalation_user_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict do nothing;

-- ============================================================
-- 12. PORTAL FILINGS VIEW (for clients)
-- ============================================================
create or replace view public.portal_filings
with (security_invoker = true) as
select
  f.id, f.client_id, f.period, f.due_date, f.status, f.filed_on,
  f.arn_number,
  ft.name as filing_type,
  (select count(*) from public.filing_documents d where d.filing_id = f.id) as doc_count
from public.filings f
join public.filing_types ft on ft.id = f.filing_type_id;

-- ============================================================
-- 13. SEED DATA (filing types)
-- ============================================================
insert into public.filing_types (name, default_reminder_days) values
  ('GSTR-1', '{5,2,0}'),
  ('GSTR-3B', '{5,2,0}'),
  ('GSTR-9', '{15,7,0}'),
  ('TDS Return', '{7,3,0}'),
  ('Advance Tax', '{15,7,0}'),
  ('ITR', '{15,7,0}'),
  ('PF/ESI', '{5,2,0}'),
  ('ROC Filing', '{15,7,0}')
on conflict (name) do nothing;