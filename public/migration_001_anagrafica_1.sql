-- ============================================================
-- MIGRATION 001 — Anagrafica avanzata (titolari + dati catastali)
-- Da eseguire UNA VOLTA SOLA su un database che ha gia' lo schema
-- iniziale applicato. Non tocca i dati esistenti.
-- ============================================================

-- Dati catastali sull'unita' (Registro di Anagrafe Condominiale, art. 1130 c.c.)
alter table unita add column if not exists catasto_foglio text;
alter table unita add column if not exists catasto_particella text;
alter table unita add column if not exists catasto_subalterno text;

-- ------------------------------------------------------------
-- TITOLARI — una o piu' persone per unita', con ruolo diverso
-- (proprietario, nudo proprietario, usufruttuario, inquilino)
-- ------------------------------------------------------------
create table if not exists titolari (
  id uuid primary key default gen_random_uuid(),
  unita_id uuid not null references unita(id) on delete cascade,
  nome text not null,
  tipo text not null default 'proprietario'
    check (tipo in ('proprietario', 'nudo_proprietario', 'usufruttuario', 'inquilino')),
  codice_fiscale text,
  email text,
  telefono text,
  percentuale numeric(5,2),
  created_at timestamptz default now()
);

create index if not exists idx_titolari_unita on titolari(unita_id);

alter table titolari enable row level security;

-- ------------------------------------------------------------
-- Popola automaticamente "titolari" con il proprietario gia'
-- presente in "unita", cosi' non si perde nulla di quanto inserito finora.
-- Esegue solo se non sono gia' stati creati titolari per quell'unita'.
-- ------------------------------------------------------------
insert into titolari (unita_id, nome, tipo, email, telefono)
select id, proprietario, 'proprietario', email, telefono
from unita u
where not exists (select 1 from titolari t where t.unita_id = u.id);
