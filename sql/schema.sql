-- Rode isso uma vez no Supabase: painel do projeto > SQL Editor > New query > colar > Run

create table if not exists events (
  id bigint generated always as identity primary key,
  event_type text not null,        -- 'pageview' | 'step_view' | 'checkout_click' | outros que você criar
  funnel_id text not null,         -- ex: 'kit-welcome'
  variant text default 'A',        -- 'A' ou 'B' (teste A/B)
  step text,                       -- ex: '1', '2', '3', 'checkout'
  session_id text not null,        -- identifica o visitante (anônimo, gerado no navegador)
  url text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  label text,
  href text,
  created_at timestamptz default now()
);

create index if not exists idx_events_funnel on events (funnel_id);
create index if not exists idx_events_session on events (session_id);
create index if not exists idx_events_type on events (event_type);
create index if not exists idx_events_created on events (created_at);

-- Segurança: bloqueia acesso direto via chave pública (só a função da Vercel,
-- usando a service_role key, consegue ler/escrever)
alter table events enable row level security;
