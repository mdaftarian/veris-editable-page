-- Run this once in Supabase → SQL Editor → New query → Run.
-- One table holds everything: page state, edited blocks, change log, comments.

create table if not exists public.docs (
  col        text not null,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);

-- Needed so live "delete" events carry the row that was removed.
alter table public.docs replica identity full;

-- Turn on realtime for this table.
alter publication supabase_realtime add table public.docs;

-- Row-level security: anyone with the link can read and write.
-- (Tighten these later if you want, e.g. require a signed-in user.)
alter table public.docs enable row level security;
drop policy if exists "public read"   on public.docs;
drop policy if exists "public insert" on public.docs;
drop policy if exists "public update" on public.docs;
drop policy if exists "public delete" on public.docs;
create policy "public read"   on public.docs for select using (true);
create policy "public insert" on public.docs for insert with check (true);
create policy "public update" on public.docs for update using (true);
create policy "public delete" on public.docs for delete using (true);

-- Image uploads: a public bucket called "images".
insert into storage.buckets (id, name, public) values ('images', 'images', true)
on conflict (id) do nothing;
drop policy if exists "public image read"   on storage.objects;
drop policy if exists "public image upload" on storage.objects;
create policy "public image read"   on storage.objects for select using (bucket_id = 'images');
create policy "public image upload" on storage.objects for insert with check (bucket_id = 'images');
