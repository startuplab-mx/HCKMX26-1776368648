-- Enable extensions for HTTP + scheduling
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Parent contact preferences (single demo row; no auth yet)
create table if not exists public.parent_contacts (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'Default parent',
  email text,
  phone text,
  email_critical boolean not null default true,
  sms_critical boolean not null default true,
  email_daily_digest boolean not null default true,
  email_weekly_digest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parent_contacts enable row level security;

create policy "demo_parent_contacts_all"
on public.parent_contacts
for all
using (true)
with check (true);

-- Seed the demo parent
insert into public.parent_contacts (label, email, phone)
values ('Demo parent', 'asantiagobaca3@gmail.com', '+525534048039')
on conflict do nothing;

-- Log of every alert sent (de-dup + audit)
create table if not exists public.alert_dispatches (
  id uuid primary key default gen_random_uuid(),
  risk_event_id uuid references public.risk_events(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  recipient text not null,
  status text not null default 'sent' check (status in ('sent','failed','skipped')),
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists alert_dispatches_event_idx on public.alert_dispatches(risk_event_id);
create index if not exists alert_dispatches_created_idx on public.alert_dispatches(created_at desc);

alter table public.alert_dispatches enable row level security;

create policy "demo_alert_dispatches_all"
on public.alert_dispatches
for all
using (true)
with check (true);

-- Trigger: when a critical risk event is inserted, asynchronously call the dispatcher edge function.
-- We use pg_net so the insert isn't blocked by the HTTP call.
create or replace function public.notify_critical_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url text := 'https://etkrmldkmfnyfpckzbmh.supabase.co/functions/v1/dispatch-critical-alert';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0a3JtbGRrbWZueWZwY2t6Ym1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNzAzMzgsImV4cCI6MjA5MjY0NjMzOH0.zDCwY9u-OjmG7udMA7bhkfHDFq6MD5Z5ercyhBjZgZ4';
begin
  if new.severity = 'critical' then
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('risk_event_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_critical_risk on public.risk_events;
create trigger trg_notify_critical_risk
after insert on public.risk_events
for each row execute function public.notify_critical_risk();