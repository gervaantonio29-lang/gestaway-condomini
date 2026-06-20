-- ============================================================
-- GESTAWAY CONDOMINI — Schema Supabase
-- Mono-tenant (un amministratore, piu' condomini)
-- Pensato per restare compatibile con un futuro multi-tenant:
-- basta aggiungere una tabella "clienti" e una colonna
-- cliente_id su condomini, senza toccare il resto.
-- ============================================================

-- ------------------------------------------------------------
-- CONDOMINI
-- ------------------------------------------------------------
create table condomini (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  indirizzo text,
  codice_fiscale text,
  iban text,
  num_unita integer default 0,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- UNITA' IMMOBILIARI (appartamenti/negozi all'interno del condominio)
-- ------------------------------------------------------------
create table unita (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  interno text not null,            -- es. "Int. 3", "Scala A - 2"
  piano integer,
  proprietario text not null,
  email text,
  telefono text,
  millesimi numeric(7,2) not null default 0,  -- es. 153.50
  created_at timestamptz default now()
);

create index idx_unita_condominio on unita(condominio_id);

-- ------------------------------------------------------------
-- SPESE (voce di spesa condominiale, es. fattura pulizie, ascensore...)
-- ------------------------------------------------------------
create table spese (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  categoria text not null,          -- vedi lista categorie lato app
  importo numeric(10,2) not null,
  data date not null,
  fornitore text,
  note text,
  giorni_scadenza integer default 30,  -- usato per calcolare la scadenza delle quote
  created_at timestamptz default now()
);

create index idx_spese_condominio on spese(condominio_id);
create index idx_spese_data on spese(data);

-- ------------------------------------------------------------
-- QUOTE (ripartizione della spesa tra le unita', su base millesimale)
-- Una riga per ogni coppia spesa/unita'.
-- ------------------------------------------------------------
create table quote (
  id uuid primary key default gen_random_uuid(),
  spesa_id uuid not null references spese(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete cascade,
  condominio_id uuid not null references condomini(id) on delete cascade,
  importo numeric(10,2) not null,
  scadenza date not null,
  stato text not null default 'da_emettere'
    check (stato in ('da_emettere', 'emesso', 'pagato', 'scaduto')),
  data_pagamento date,
  created_at timestamptz default now()
);

create index idx_quote_spesa on quote(spesa_id);
create index idx_quote_unita on quote(unita_id);
create index idx_quote_condominio on quote(condominio_id);
create index idx_quote_stato on quote(stato);

-- ------------------------------------------------------------
-- IMPOSTAZIONI (chiave/valore, stessa convenzione degli altri progetti)
-- ------------------------------------------------------------
create table impostazioni (
  chiave text primary key,
  valore text
);

-- ------------------------------------------------------------
-- Trigger: aggiorna automaticamente num_unita su condomini
-- ------------------------------------------------------------
create or replace function aggiorna_num_unita()
returns trigger as $$
begin
  update condomini
  set num_unita = (select count(*) from unita where condominio_id = coalesce(new.condominio_id, old.condominio_id))
  where id = coalesce(new.condominio_id, old.condominio_id);
  return null;
end;
$$ language plpgsql;

create trigger trg_unita_insert
after insert or delete on unita
for each row execute function aggiorna_num_unita();

-- ------------------------------------------------------------
-- Trigger: marca automaticamente come "scaduto" le quote non pagate
-- la cui scadenza e' passata (da richiamare anche via cron/job lato server,
-- questo e' solo un controllo a livello di lettura/funzione manuale)
-- ------------------------------------------------------------
create or replace function aggiorna_quote_scadute()
returns void as $$
begin
  update quote
  set stato = 'scaduto'
  where stato in ('emesso', 'da_emettere')
    and scadenza < current_date;
end;
$$ language plpgsql;

-- Esempio di chiamata manuale o da cron Railway/Supabase:
-- select aggiorna_quote_scadute();
