-- LeafKeeper 0.1 · Run once in Supabase → SQL Editor.
begin;
create table if not exists public.lk_plants (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 120), species text not null default '', location text not null default '', photo text not null default '',
 pot text not null default '', soil text not null default '', notes text not null default '', status text not null default 'active' check(status in ('active','quarantine','archived')),
 water_days integer not null default 7 check(water_days between 1 and 365), feed_days integer not null default 30 check(feed_days between 1 and 730), feed_paused boolean not null default false,
 first_water date not null default current_date, first_feed date not null default (current_date+30), snooze_water date, snooze_feed date, repot_due date, acquired date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,owner_id)
);
create table if not exists public.lk_events (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 plant_id uuid not null, kind text not null check(kind in ('water','feed','repot','plant','prune','propagate','treat','observe')),
 occurred_on date not null, note text not null default '', photo text not null default '', created_at timestamptz not null default now(),
 foreign key (plant_id,owner_id) references public.lk_plants(id,owner_id) on delete cascade
);
create index if not exists lk_events_plant_date on public.lk_events(plant_id,occurred_on desc);
create index if not exists lk_events_plant_owner on public.lk_events(plant_id,owner_id);
create index if not exists lk_plants_owner on public.lk_plants(owner_id);
create index if not exists lk_events_owner on public.lk_events(owner_id);
alter table public.lk_plants enable row level security;
alter table public.lk_events enable row level security;
drop policy if exists lk_plants_own on public.lk_plants;
create policy lk_plants_own on public.lk_plants for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
drop policy if exists lk_events_own on public.lk_events;
create policy lk_events_own on public.lk_events for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
grant select,insert,update,delete on public.lk_plants,public.lk_events to authenticated;
revoke all on public.lk_plants,public.lk_events from anon;
create or replace function public.lk_touch() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=clock_timestamp();return new;end; $$;
drop trigger if exists lk_plants_touch on public.lk_plants;
create trigger lk_plants_touch before update on public.lk_plants for each row execute function public.lk_touch();
-- All selected plants and paired water/feed events are committed together.
create or replace function public.lk_log_events(items jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare item jsonb; pid uuid; k text; d date; inserted_count integer;
begin
 if auth.uid() is null then raise exception 'Bejelentkezés szükséges';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>200 or jsonb_array_length(items)=0 then raise exception 'Érvénytelen eseménylista';end if;
 for item in select value from jsonb_array_elements(items) loop
  pid=(item->>'plant_id')::uuid;k=item->>'kind';d=(item->>'occurred_on')::date;
  if d>(now() at time zone 'Europe/Budapest')::date then raise exception 'Jövőbeli gondozás nem naplózható';end if;
  perform 1 from public.lk_plants where id=pid and owner_id=auth.uid() for update;
  if not found then raise exception 'A növény nem található';end if;
  insert into public.lk_events(id,owner_id,plant_id,kind,occurred_on,note,photo) values((item->>'id')::uuid,auth.uid(),pid,k,d,coalesce(item->>'note',''),coalesce(item->>'photo','')) on conflict(id) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count>0 and d>=(select max(occurred_on) from public.lk_events where plant_id=pid and kind=k) then
   if k='water' then update public.lk_plants set snooze_water=null where id=pid;
   elsif k='feed' then update public.lk_plants set snooze_feed=null where id=pid;
   elsif k='repot' then update public.lk_plants set repot_due=null where id=pid;end if;
  end if;
 end loop;
end; $$;
revoke all on function public.lk_log_events(jsonb) from public,anon;
grant execute on function public.lk_log_events(jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('leafkeeper','leafkeeper',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists lk_photo_read on storage.objects;
create policy lk_photo_read on storage.objects for select to authenticated using(bucket_id='leafkeeper' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists lk_photo_insert on storage.objects;
create policy lk_photo_insert on storage.objects for insert to authenticated with check(bucket_id='leafkeeper' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists lk_photo_delete on storage.objects;
create policy lk_photo_delete on storage.objects for delete to authenticated using(bucket_id='leafkeeper' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
