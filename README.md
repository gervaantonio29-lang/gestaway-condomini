# Gestaway Condomini

Gestionale per amministratori di condominio. Stesso stack di gestaway/cademaricomo: Express + Supabase, deploy su Railway.

## Setup

1. `npm install`
2. Crea un progetto Supabase (separato da quello del prodotto B&B) ed esegui `schema.sql` nel SQL editor.
3. Copia `.env.example` in `.env` e compila:
   - `SUPABASE_URL` / `SUPABASE_KEY` — dal pannello Supabase (Settings → API)
   - `ADMIN_PASSWORD` — password di accesso al gestionale (mono-tenant, un solo amministratore)
4. `npm start`

## Struttura

```
gestaway-condomini/
├── server.js       API REST sotto /api, login admin con cookie di sessione
├── schema.sql      Schema Supabase (condomini, unita, spese, quote, impostazioni)
├── package.json
└── public/
    ├── login.html
    └── gestionale.html
```

## API principali

- `POST /api/login` `{ password }` → imposta cookie di sessione
- `GET /api/condomini` → lista condomini
- `POST /api/condomini` → crea condominio
- `GET /api/condomini/:id/unita` → unita' di un condominio
- `POST /api/condomini/:id/unita` → aggiunge unita'
- `POST /api/condomini/:id/spese` → registra una spesa e genera automaticamente le quote ripartite per millesimi
- `GET /api/condomini/:id/quote?stato=scaduto` → scadenzario, filtrabile per stato
- `PUT /api/quote/:id/stato` `{ stato }` → segna una quota come pagata/emessa/ecc.
- `GET /api/condomini/:id/dashboard` → metriche aggregate

## Deploy Railway

Variabili d'ambiente da impostare sul servizio Railway (vedi `.env.example`). Dominio da collegare: `condomini.gestaway.com`.

## Da fare dopo

- [ ] `public/login.html` e `public/gestionale.html` (interfaccia)
- [ ] Cron per `select aggiorna_quote_scadute();` (Railway cron job o Supabase scheduled function)
- [ ] Sezione "gestionale condomini" su gestaway.com (landing)
