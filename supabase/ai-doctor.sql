-- Apply after setup.sql. API keys are encrypted in Supabase Vault.
begin;
create schema if not exists leafkeeper_private;
revoke all on schema leafkeeper_private from public,anon,authenticated;
create table leafkeeper_private.ai_keys (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 vault_id uuid not null unique references vault.secrets(id),
 updated_at timestamptz not null default now()
);
alter table leafkeeper_private.ai_keys enable row level security;
revoke all on leafkeeper_private.ai_keys from public,anon,authenticated;
create function leafkeeper_private.cleanup_ai_key() returns trigger language plpgsql security definer set search_path='' as $$
begin delete from vault.secrets where id=old.vault_id;return old;end;$$;
revoke all on function leafkeeper_private.cleanup_ai_key() from public,anon,authenticated;
create trigger cleanup_ai_key after delete on leafkeeper_private.ai_keys for each row execute function leafkeeper_private.cleanup_ai_key();
-- Service-only bridge: clients can never invoke this RPC to retrieve a saved key.
create function public.lk_ai_key(p_owner uuid,p_action text,p_secret text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; value text;
begin
 perform pg_advisory_xact_lock(hashtextextended('lk-key:'||p_owner::text,0));
 select vault_id into sid from leafkeeper_private.ai_keys where owner_id=p_owner;
 if p_action='status' then return jsonb_build_object('saved',sid is not null);
 elsif p_action='get' then select decrypted_secret into value from vault.decrypted_secrets where id=sid;return jsonb_build_object('key',value);
 elsif p_action='set' then
  if p_secret is null or p_secret !~ '^[A-Za-z0-9._-]{20,200}$' then raise exception 'invalid_key';end if;
  if sid is null then
   sid:=vault.create_secret(p_secret,'leafkeeper_gemini_'||p_owner::text,'LeafKeeper per-user Gemini credential');
   insert into leafkeeper_private.ai_keys(owner_id,vault_id) values(p_owner,sid);
  else perform vault.update_secret(sid,p_secret);update leafkeeper_private.ai_keys set updated_at=now() where owner_id=p_owner;end if;
  return jsonb_build_object('saved',true);
 elsif p_action='delete' then delete from leafkeeper_private.ai_keys where owner_id=p_owner;return jsonb_build_object('saved',false);
 else raise exception 'invalid_action';end if;
end;$$;
revoke all on function public.lk_ai_key(uuid,text,text) from public,anon,authenticated;
grant execute on function public.lk_ai_key(uuid,text,text) to service_role;
create table public.lk_ai_analyses (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 plant_id uuid not null, request_id uuid not null, fingerprint text not null,
 category text not null check(category in ('health','problem','pests')),language text not null check(language in ('hu','en')),
 symptoms text not null default '' check(char_length(symptoms)<=400),
 status text not null default 'pending' check(status in ('pending','ready','failed')),
 result jsonb,usage jsonb,model text not null, error_code text,
 created_at timestamptz not null default now(),completed_at timestamptz,
 foreign key(plant_id,owner_id) references public.lk_plants(id,owner_id) on delete cascade,
 unique(owner_id,request_id)
);
create index lk_ai_owner_date on public.lk_ai_analyses(owner_id,created_at desc);
create index lk_ai_owner_hash on public.lk_ai_analyses(owner_id,fingerprint,created_at desc);
create index lk_ai_plant_owner on public.lk_ai_analyses(plant_id,owner_id);
alter table public.lk_ai_analyses enable row level security;
create policy lk_ai_read_own on public.lk_ai_analyses for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.lk_ai_analyses from public,anon,authenticated;
grant select on public.lk_ai_analyses to authenticated;
grant all on public.lk_ai_analyses to service_role;
-- Atomic cache, duplicate-request guard and persistent per-user limits.
create function public.lk_ai_claim(p_owner uuid,p_plant uuid,p_request uuid,p_hash text,p_category text,p_language text,p_symptoms text,p_model text) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.lk_ai_analyses; n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('lk-ai:'||p_owner::text,0));
 if not exists(select 1 from public.lk_plants where id=p_plant and owner_id=p_owner) then raise exception 'plant_missing';end if;
 select * into item from public.lk_ai_analyses where owner_id=p_owner and request_id=p_request;
 if found then
  if item.fingerprint<>p_hash or item.plant_id<>p_plant then return jsonb_build_object('state','invalid_input');end if;
  return jsonb_build_object('state',item.status,'analysis',to_jsonb(item),'cached',true);end if;
 select * into item from public.lk_ai_analyses where owner_id=p_owner and plant_id=p_plant and fingerprint=p_hash and status='ready' and created_at>now()-interval '24 hours' order by created_at desc limit 1;
 if found then return jsonb_build_object('state','ready','analysis',to_jsonb(item),'cached',true);end if;
 if exists(select 1 from public.lk_ai_analyses where owner_id=p_owner and status='pending' and created_at>now()-interval '2 minutes') then return jsonb_build_object('state','busy');end if;
 select count(*) into n from public.lk_ai_analyses where owner_id=p_owner and created_at>now()-interval '24 hours';
 if n>=20 then return jsonb_build_object('state','daily_limit');end if;
 select count(*) into n from public.lk_ai_analyses where owner_id=p_owner and created_at>now()-interval '1 minute';
 if n>=3 then return jsonb_build_object('state','rate_limit');end if;
 insert into public.lk_ai_analyses(owner_id,plant_id,request_id,fingerprint,category,language,symptoms,model) values(p_owner,p_plant,p_request,p_hash,p_category,p_language,p_symptoms,p_model) returning * into item;
 return jsonb_build_object('state','claimed','analysis',to_jsonb(item),'cached',false);
end;$$;
revoke all on function public.lk_ai_claim(uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.lk_ai_claim(uuid,uuid,uuid,text,text,text,text,text) to service_role;
-- A saved result can be copied into the journal once, without another AI request.
create table leafkeeper_private.ai_journal_links(analysis_id uuid primary key references public.lk_ai_analyses(id) on delete cascade,event_id uuid not null unique references public.lk_events(id) on delete cascade);
alter table leafkeeper_private.ai_journal_links enable row level security;
revoke all on leafkeeper_private.ai_journal_links from public,anon,authenticated;
create function public.lk_ai_to_journal(p_owner uuid,p_analysis uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.lk_ai_analyses;eid uuid;body text;
begin
 if p_owner is null then raise exception 'not_authenticated';end if;
 select * into a from public.lk_ai_analyses where id=p_analysis and owner_id=p_owner and status='ready' for update;
 if not found then raise exception 'analysis_missing';end if;
 select event_id into eid from leafkeeper_private.ai_journal_links where analysis_id=a.id;
 if found then return eid;end if;
 body:=case when a.language='hu' then 'AI növénydoki · Tájékoztató jellegű képelemzés' else 'AI plant doctor · Informational image analysis' end;
 body:=body||E'\n'||coalesce(a.result->>'summary','')||E'\n'||coalesce((select string_agg('- '||value,E'\n') from jsonb_array_elements_text(a.result->'next_steps')),'')||E'\n'||coalesce(a.result->>'follow_up','');
 insert into public.lk_events(owner_id,plant_id,kind,occurred_on,note) values(a.owner_id,a.plant_id,'observe',(now() at time zone 'Europe/Budapest')::date,body) returning id into eid;
 insert into leafkeeper_private.ai_journal_links values(a.id,eid);return eid;
end;$$;
revoke all on function public.lk_ai_to_journal(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lk_ai_to_journal(uuid,uuid) to service_role;
commit;
