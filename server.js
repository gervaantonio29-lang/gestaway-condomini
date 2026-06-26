// ============================================================
// GESTAWAY CONDOMINI — server.js
// Stack: Express + Supabase, mono-tenant (un amministratore)
// Stesse convenzioni di gestaway/cademaricomo (ADMIN_PASSWORD,
// cookie di sessione semplice, struttura API REST sotto /api)
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_COOKIE = 'gc_session';
// Token di sessione semplice, in memoria: sufficiente per mono-tenant
// (un solo amministratore). Si perde ai riavvii del server, in tal caso
// l'admin rifa' login: comportamento accettabile per questo caso d'uso.
const sessioniValide = new Set();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Redirect dalla root a login
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/gestionale', (req, res) => res.redirect('/gestionale.html'));

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------
function generaToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

function richiedeLogin(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (token && sessioniValide.has(token)) return next();
  return res.status(401).json({ errore: 'Accesso non autorizzato. Effettua il login.' });
}

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ errore: 'ADMIN_PASSWORD non configurata sul server.' });
  }
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ errore: 'Password non corretta.' });
  }
  const token = generaToken();
  sessioniValide.add(token);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 giorni
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  if (token) sessioniValide.delete(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/sessione', (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  res.json({ autenticato: !!(token && sessioniValide.has(token)) });
});

// Tutte le rotte /api/* sotto questa riga richiedono login,
// tranne quelle di auth gia' dichiarate sopra.
app.use('/api', richiedeLogin);

// ------------------------------------------------------------
// CONDOMINI
// ------------------------------------------------------------
app.get('/api/condomini', async (req, res) => {
  const { data, error } = await supabase.from('condomini').select('*').order('created_at', { ascending: true });
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/condomini', async (req, res) => {
  const { nome, indirizzo, codice_fiscale, iban } = req.body;
  if (!nome) return res.status(400).json({ errore: 'Il nome del condominio e\' obbligatorio.' });
  const { data, error } = await supabase
    .from('condomini')
    .insert({ nome, indirizzo, codice_fiscale, iban })
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/condomini/:id', async (req, res) => {
  const { nome, indirizzo, codice_fiscale, iban } = req.body;
  const { data, error } = await supabase
    .from('condomini')
    .update({ nome, indirizzo, codice_fiscale, iban })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/condomini/:id', async (req, res) => {
  const { error } = await supabase.from('condomini').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// EDIFICI
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/edifici', async (req, res) => {
  const { data, error } = await supabase
    .from('edifici')
    .select('*, scale(*)')
    .eq('condominio_id', req.params.condominioId)
    .order('nome', { ascending: true });
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/condomini/:condominioId/edifici', async (req, res) => {
  const { nome, codice, indirizzo } = req.body;
  if (!nome) return res.status(400).json({ errore: 'Il nome dell\'edificio e\' obbligatorio.' });
  const { data, error } = await supabase
    .from('edifici')
    .insert({ condominio_id: req.params.condominioId, nome, codice: codice || null, indirizzo: indirizzo || null })
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/edifici/:id', async (req, res) => {
  const { nome, codice, indirizzo } = req.body;
  const { data, error } = await supabase
    .from('edifici')
    .update({ nome, codice: codice || null, indirizzo: indirizzo || null })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/edifici/:id', async (req, res) => {
  const { error } = await supabase.from('edifici').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// SCALE
// ------------------------------------------------------------
app.get('/api/edifici/:edificioId/scale', async (req, res) => {
  const { data, error } = await supabase
    .from('scale')
    .select('*')
    .eq('edificio_id', req.params.edificioId)
    .order('nome', { ascending: true });
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/edifici/:edificioId/scale', async (req, res) => {
  const { nome, codice, condominio_id } = req.body;
  if (!nome) return res.status(400).json({ errore: 'Il nome della scala e\' obbligatorio.' });
  const { data, error } = await supabase
    .from('scale')
    .insert({ edificio_id: req.params.edificioId, condominio_id, nome, codice: codice || null })
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/scale/:id', async (req, res) => {
  const { error } = await supabase.from('scale').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// UNITA'
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/unita', async (req, res) => {
  const { data, error } = await supabase
    .from('unita')
    .select('*, edifici(nome), scale(nome)')
    .eq('condominio_id', req.params.condominioId)
    .order('interno', { ascending: true });
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/condomini/:condominioId/unita', async (req, res) => {
  const {
    interno, piano, proprietario, email, telefono, millesimi,
    scala_id, edificio_id, tipo_ui, tipo_abituativo,
    catasto_foglio, catasto_particella, catasto_subalterno,
    catasto_sezione, catasto_categoria, catasto_classe,
    catasto_consistenza, catasto_rendita, catasto_estensione_part
  } = req.body;
  if (!interno || !proprietario || millesimi == null) {
    return res.status(400).json({ errore: 'Interno, proprietario e millesimi sono obbligatori.' });
  }
  const { data, error } = await supabase
    .from('unita')
    .insert({
      condominio_id: req.params.condominioId,
      interno, piano: piano || null, proprietario, email, telefono,
      millesimi: Number(millesimi),
      scala_id: scala_id || null,
      edificio_id: edificio_id || null,
      tipo_ui: tipo_ui || 'Appartamento',
      tipo_abituativo: tipo_abituativo || 'Unità abitativa',
      catasto_foglio: catasto_foglio || null,
      catasto_particella: catasto_particella || null,
      catasto_subalterno: catasto_subalterno || null,
      catasto_sezione: catasto_sezione || null,
      catasto_categoria: catasto_categoria || null,
      catasto_classe: catasto_classe || null,
      catasto_consistenza: catasto_consistenza || null,
      catasto_rendita: catasto_rendita ? Number(catasto_rendita) : null,
      catasto_estensione_part: catasto_estensione_part || null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });

  // Crea automaticamente il primo titolare (proprietario)
  await supabase.from('titolari').insert({
    unita_id: data.id, nome: proprietario, tipo: 'proprietario',
    email, telefono, principale: true,
  });

  res.json(data);
});

app.put('/api/unita/:id', async (req, res) => {
  const {
    interno, piano, proprietario, email, telefono, millesimi,
    scala_id, edificio_id, tipo_ui, tipo_abituativo,
    catasto_foglio, catasto_particella, catasto_subalterno,
    catasto_sezione, catasto_categoria, catasto_classe,
    catasto_consistenza, catasto_rendita, catasto_estensione_part
  } = req.body;
  const { data, error } = await supabase
    .from('unita')
    .update({
      interno, piano, proprietario, email, telefono, millesimi: Number(millesimi),
      scala_id: scala_id || null,
      edificio_id: edificio_id || null,
      tipo_ui: tipo_ui || 'Appartamento',
      tipo_abituativo: tipo_abituativo || 'Unità abitativa',
      catasto_foglio: catasto_foglio || null,
      catasto_particella: catasto_particella || null,
      catasto_subalterno: catasto_subalterno || null,
      catasto_sezione: catasto_sezione || null,
      catasto_categoria: catasto_categoria || null,
      catasto_classe: catasto_classe || null,
      catasto_consistenza: catasto_consistenza || null,
      catasto_rendita: catasto_rendita ? Number(catasto_rendita) : null,
      catasto_estensione_part: catasto_estensione_part || null,
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/unita/:id', async (req, res) => {
  const { error } = await supabase.from('unita').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// TITOLARI — proprietari, nudi proprietari, usufruttuari, inquilini
// collegati a una stessa unita' (Registro di Anagrafe Condominiale)
// ------------------------------------------------------------
app.get('/api/unita/:unitaId/titolari', async (req, res) => {
  const { data, error } = await supabase
    .from('titolari')
    .select('*')
    .eq('unita_id', req.params.unitaId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/unita/:unitaId/titolari', async (req, res) => {
  const { nome, tipo, codice_fiscale, email, telefono, percentuale,
    data_dal, data_al, percentuale_registro, percentuale_detrazione,
    percentuale_bilancio, principale, invio } = req.body;
  const tipiValidi = ['proprietario', 'nudo_proprietario', 'usufruttuario', 'inquilino'];
  if (!nome) return res.status(400).json({ errore: 'Il nome del titolare e\' obbligatorio.' });
  if (tipo && !tipiValidi.includes(tipo)) return res.status(400).json({ errore: 'Tipo titolare non valido.' });

  const { data, error } = await supabase
    .from('titolari')
    .insert({
      unita_id: req.params.unitaId,
      nome, tipo: tipo || 'proprietario',
      codice_fiscale: codice_fiscale || null,
      email: email || null, telefono: telefono || null,
      percentuale: percentuale != null ? Number(percentuale) : null,
      data_dal: data_dal || null,
      data_al: data_al || null,
      percentuale_registro: percentuale_registro != null ? Number(percentuale_registro) : null,
      percentuale_detrazione: percentuale_detrazione != null ? Number(percentuale_detrazione) : null,
      percentuale_bilancio: percentuale_bilancio != null ? Number(percentuale_bilancio) : null,
      principale: principale ?? false,
      invio: invio ?? true,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/titolari/:id', async (req, res) => {
  const { nome, tipo, codice_fiscale, email, telefono, percentuale } = req.body;
  const { data, error } = await supabase
    .from('titolari')
    .update({
      nome, tipo,
      codice_fiscale: codice_fiscale || null,
      email: email || null, telefono: telefono || null,
      percentuale: percentuale != null ? Number(percentuale) : null,
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/titolari/:id', async (req, res) => {
  const { error } = await supabase.from('titolari').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// SPESE — la creazione genera automaticamente le quote ripartite
// per millesimi su tutte le unita' del condominio.
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/spese', async (req, res) => {
  const { data, error } = await supabase
    .from('spese')
    .select('*')
    .eq('condominio_id', req.params.condominioId)
    .order('data', { ascending: false });
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/condomini/:condominioId/spese', async (req, res) => {
  const condominioId = req.params.condominioId;
  const { categoria, importo, data: dataSpesa, fornitore, note, giorni_scadenza } = req.body;

  if (!categoria || !importo || !dataSpesa) {
    return res.status(400).json({ errore: 'Categoria, importo e data sono obbligatori.' });
  }

  const importoNum = Number(importo);
  const giorniScadenza = Number(giorni_scadenza) || 30;

  // 1. Recupera le unita' del condominio per calcolare la ripartizione
  const { data: unitaCondominio, error: erroreUnita } = await supabase
    .from('unita')
    .select('id, millesimi')
    .eq('condominio_id', condominioId);

  if (erroreUnita) return res.status(500).json({ errore: erroreUnita.message });
  if (!unitaCondominio || unitaCondominio.length === 0) {
    return res.status(400).json({ errore: 'Il condominio non ha unita\' immobiliari: impossibile ripartire la spesa.' });
  }

  // 2. Crea la spesa
  const { data: spesa, error: erroreSpesa } = await supabase
    .from('spese')
    .insert({
      condominio_id: condominioId,
      categoria, importo: importoNum, data: dataSpesa,
      fornitore: fornitore || null, note: note || null,
      giorni_scadenza: giorniScadenza,
    })
    .select()
    .single();

  if (erroreSpesa) return res.status(500).json({ errore: erroreSpesa.message });

  // 3. Calcola la scadenza
  const scadenza = new Date(dataSpesa);
  scadenza.setDate(scadenza.getDate() + giorniScadenza);
  const scadenzaStr = scadenza.toISOString().slice(0, 10);

  // 4. Genera una quota per ogni unita', proporzionale ai millesimi
  const quoteDaInserire = unitaCondominio.map(u => ({
    spesa_id: spesa.id,
    unita_id: u.id,
    condominio_id: condominioId,
    importo: Math.round((importoNum * Number(u.millesimi) / 1000) * 100) / 100,
    scadenza: scadenzaStr,
    stato: 'da_emettere',
  }));

  const { error: erroreQuote } = await supabase.from('quote').insert(quoteDaInserire);
  if (erroreQuote) {
    // Rollback manuale della spesa se le quote falliscono, per non lasciare dati orfani
    await supabase.from('spese').delete().eq('id', spesa.id);
    return res.status(500).json({ errore: 'Errore nella ripartizione: ' + erroreQuote.message });
  }

  res.json(spesa);
});

app.delete('/api/spese/:id', async (req, res) => {
  // Le quote collegate vengono eliminate automaticamente (on delete cascade)
  const { error } = await supabase.from('spese').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// QUOTE — scadenzario e aggiornamento stato pagamento
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/quote', async (req, res) => {
  const { stato } = req.query;
  let query = supabase
    .from('quote')
    .select('*, spese(categoria, fornitore), unita(interno, proprietario, millesimi)')
    .eq('condominio_id', req.params.condominioId)
    .order('scadenza', { ascending: true });

  if (stato) query = query.eq('stato', stato);

  const { data, error } = await query;
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/quote/:id/stato', async (req, res) => {
  const { stato } = req.body;
  const statiValidi = ['da_emettere', 'emesso', 'pagato', 'scaduto'];
  if (!statiValidi.includes(stato)) {
    return res.status(400).json({ errore: 'Stato non valido.' });
  }
  const aggiornamento = { stato };
  aggiornamento.data_pagamento = stato === 'pagato' ? new Date().toISOString().slice(0, 10) : null;

  const { data, error } = await supabase
    .from('quote')
    .update(aggiornamento)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

// ------------------------------------------------------------
// DASHBOARD — metriche aggregate per un condominio
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/dashboard', async (req, res) => {
  const condominioId = req.params.condominioId;

  const [{ data: spese, error: e1 }, { data: quote, error: e2 }, { data: unita, error: e3 }] = await Promise.all([
    supabase.from('spese').select('*').eq('condominio_id', condominioId),
    supabase.from('quote').select('*').eq('condominio_id', condominioId),
    supabase.from('unita').select('*').eq('condominio_id', condominioId),
  ]);

  if (e1 || e2 || e3) return res.status(500).json({ errore: (e1 || e2 || e3).message });

  const totSpesaAnno = spese.reduce((s, sp) => s + Number(sp.importo), 0);
  const totIncassato = quote.filter(q => q.stato === 'pagato').reduce((s, q) => s + Number(q.importo), 0);
  const totDaIncassare = quote.filter(q => q.stato !== 'pagato').reduce((s, q) => s + Number(q.importo), 0);
  const numScaduti = quote.filter(q => q.stato === 'scaduto').length;
  const totMillesimi = unita.reduce((s, u) => s + Number(u.millesimi), 0);

  const speseCategoria = {};
  spese.forEach(s => { speseCategoria[s.categoria] = (speseCategoria[s.categoria] || 0) + Number(s.importo); });

  res.json({
    totSpesaAnno, totIncassato, totDaIncassare, numScaduti, totMillesimi,
    numUnita: unita.length,
    speseCategoria: Object.entries(speseCategoria).map(([categoria, importo]) => ({ categoria, importo })),
  });
});

// ------------------------------------------------------------
// NOMINATIVI — rubrica persone fisiche
// ------------------------------------------------------------
app.get('/api/nominativi', async (req, res) => {
  const { q } = req.query;
  let query = supabase.from('nominativi').select('*').eq('attivo', true).order('cognome');
  if (q) query = query.or(`cognome.ilike.%${q}%,nome.ilike.%${q}%,codice_fiscale.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.get('/api/nominativi/:id', async (req, res) => {
  const { data, error } = await supabase.from('nominativi').select('*').eq('id', req.params.id).single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/nominativi', async (req, res) => {
  const { cognome, nome, titolo, ragione_sociale, codice_fiscale, sesso,
    data_nascita, comune_nascita, provincia_nascita,
    email, telefono, cellulare, pec, indirizzo, cap, citta, provincia } = req.body;
  if (!cognome || !nome) return res.status(400).json({ errore: 'Cognome e nome sono obbligatori.' });
  const { data, error } = await supabase.from('nominativi').insert({
    cognome, nome, titolo: titolo || null, ragione_sociale: ragione_sociale || null,
    codice_fiscale: codice_fiscale || null, sesso: sesso || null,
    data_nascita: data_nascita || null,
    comune_nascita: comune_nascita || null, provincia_nascita: provincia_nascita || null,
    email: email || null, telefono: telefono || null, cellulare: cellulare || null,
    pec: pec || null, indirizzo: indirizzo || null, cap: cap || null,
    citta: citta || null, provincia: provincia || null,
  }).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/nominativi/:id', async (req, res) => {
  const { cognome, nome, titolo, ragione_sociale, codice_fiscale, sesso,
    data_nascita, comune_nascita, provincia_nascita,
    email, telefono, cellulare, pec, indirizzo, cap, citta, provincia } = req.body;
  const { data, error } = await supabase.from('nominativi').update({
    cognome, nome, titolo: titolo || null, ragione_sociale: ragione_sociale || null,
    codice_fiscale: codice_fiscale || null, sesso: sesso || null,
    data_nascita: data_nascita || null,
    comune_nascita: comune_nascita || null, provincia_nascita: provincia_nascita || null,
    email: email || null, telefono: telefono || null, cellulare: cellulare || null,
    pec: pec || null, indirizzo: indirizzo || null, cap: cap || null,
    citta: citta || null, provincia: provincia || null,
  }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/nominativi/:id', async (req, res) => {
  const { error } = await supabase.from('nominativi').update({ attivo: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// FORNITORI — rubrica aziende e professionisti
// ------------------------------------------------------------
app.get('/api/fornitori', async (req, res) => {
  const { q } = req.query;
  let query = supabase.from('fornitori').select('*').eq('attivo', true).order('ragione_sociale');
  if (q) query = query.or(`ragione_sociale.ilike.%${q}%,partita_iva.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.get('/api/fornitori/:id', async (req, res) => {
  const { data, error } = await supabase.from('fornitori').select('*').eq('id', req.params.id).single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/fornitori', async (req, res) => {
  const { ragione_sociale, codice_fiscale, partita_iva, codice_sdi, pec_fatturazione,
    categoria, regime_fiscale, soggetto_iva, aliquota_iva,
    soggetto_ritenuta_acconto, percentuale_ritenuta, codice_tributo_f24,
    soggetto_ritenuta_previdenziale, percentuale_ritenuta_prev, includi_770,
    durc_scadenza, email, telefono, pec, indirizzo, cap, citta, provincia, note } = req.body;
  if (!ragione_sociale) return res.status(400).json({ errore: 'La ragione sociale è obbligatoria.' });
  const { data, error } = await supabase.from('fornitori').insert({
    ragione_sociale, codice_fiscale: codice_fiscale || null, partita_iva: partita_iva || null,
    codice_sdi: codice_sdi || null, pec_fatturazione: pec_fatturazione || null,
    categoria: categoria || null, regime_fiscale: regime_fiscale || 'Ordinario',
    soggetto_iva: soggetto_iva ?? true, aliquota_iva: aliquota_iva ? Number(aliquota_iva) : 22,
    soggetto_ritenuta_acconto: soggetto_ritenuta_acconto ?? false,
    percentuale_ritenuta: percentuale_ritenuta ? Number(percentuale_ritenuta) : 4,
    codice_tributo_f24: codice_tributo_f24 || '1020',
    soggetto_ritenuta_previdenziale: soggetto_ritenuta_previdenziale ?? false,
    percentuale_ritenuta_prev: percentuale_ritenuta_prev ? Number(percentuale_ritenuta_prev) : null,
    includi_770: includi_770 ?? true,
    durc_scadenza: durc_scadenza || null,
    email: email || null, telefono: telefono || null, pec: pec || null,
    indirizzo: indirizzo || null, cap: cap || null, citta: citta || null, provincia: provincia || null,
    note: note || null,
  }).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/fornitori/:id', async (req, res) => {
  const { ragione_sociale, codice_fiscale, partita_iva, codice_sdi, pec_fatturazione,
    categoria, regime_fiscale, soggetto_iva, aliquota_iva,
    soggetto_ritenuta_acconto, percentuale_ritenuta, codice_tributo_f24,
    soggetto_ritenuta_previdenziale, percentuale_ritenuta_prev, includi_770,
    durc_scadenza, email, telefono, pec, indirizzo, cap, citta, provincia, note } = req.body;
  const { data, error } = await supabase.from('fornitori').update({
    ragione_sociale, codice_fiscale: codice_fiscale || null, partita_iva: partita_iva || null,
    codice_sdi: codice_sdi || null, pec_fatturazione: pec_fatturazione || null,
    categoria: categoria || null, regime_fiscale: regime_fiscale || 'Ordinario',
    soggetto_iva: soggetto_iva ?? true, aliquota_iva: aliquota_iva ? Number(aliquota_iva) : 22,
    soggetto_ritenuta_acconto: soggetto_ritenuta_acconto ?? false,
    percentuale_ritenuta: percentuale_ritenuta ? Number(percentuale_ritenuta) : 4,
    codice_tributo_f24: codice_tributo_f24 || '1020',
    soggetto_ritenuta_previdenziale: soggetto_ritenuta_previdenziale ?? false,
    percentuale_ritenuta_prev: percentuale_ritenuta_prev ? Number(percentuale_ritenuta_prev) : null,
    includi_770: includi_770 ?? true,
    durc_scadenza: durc_scadenza || null,
    email: email || null, telefono: telefono || null, pec: pec || null,
    indirizzo: indirizzo || null, cap: cap || null, citta: citta || null, provincia: provincia || null,
    note: note || null,
  }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/fornitori/:id', async (req, res) => {
  const { error } = await supabase.from('fornitori').update({ attivo: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// TABELLE MILLESIMALI
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/tabelle-millesimali', async (req, res) => {
  const { data, error } = await supabase
    .from('tabelle_millesimali')
    .select('*, valori_millesimali(*, unita(interno, proprietario))')
    .eq('condominio_id', req.params.condominioId)
    .order('codice');
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/condomini/:condominioId/tabelle-millesimali', async (req, res) => {
  const { nome, codice, descrizione, totale, predefinita } = req.body;
  if (!nome) return res.status(400).json({ errore: 'Il nome è obbligatorio.' });
  const { data, error } = await supabase.from('tabelle_millesimali')
    .insert({ condominio_id: req.params.condominioId, nome, codice: codice || null, descrizione: descrizione || null, totale: totale || 1000, predefinita: predefinita || false })
    .select().single();
  if (error) return res.status(500).json({ errore: error.message });
  // Crea valori a zero per tutte le unità esistenti
  const { data: unita } = await supabase.from('unita').select('id').eq('condominio_id', req.params.condominioId);
  if (unita && unita.length) {
    await supabase.from('valori_millesimali').insert(unita.map(u => ({ tabella_id: data.id, unita_id: u.id, condominio_id: req.params.condominioId, valore: 0 })));
  }
  res.json(data);
});

app.put('/api/valori-millesimali/:tabellaId', async (req, res) => {
  const { valori } = req.body; // array di { unita_id, valore }
  const aggiornamenti = valori.map(v =>
    supabase.from('valori_millesimali').upsert({ tabella_id: req.params.tabellaId, unita_id: v.unita_id, condominio_id: v.condominio_id, valore: Number(v.valore) }, { onConflict: 'tabella_id,unita_id' })
  );
  await Promise.all(aggiornamenti);
  res.json({ ok: true });
});

app.delete('/api/tabelle-millesimali/:id', async (req, res) => {
  const { error } = await supabase.from('tabelle_millesimali').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// ESERCIZI
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/esercizi', async (req, res) => {
  const { data, error } = await supabase.from('esercizi').select('*').eq('condominio_id', req.params.condominioId).order('data_inizio', { ascending: false });
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/condomini/:condominioId/esercizi', async (req, res) => {
  const { nome, data_inizio, data_fine, note } = req.body;
  if (!nome || !data_inizio || !data_fine) return res.status(400).json({ errore: 'Nome, data inizio e data fine sono obbligatori.' });
  const { data, error } = await supabase.from('esercizi').insert({ condominio_id: req.params.condominioId, nome, data_inizio, data_fine, note: note || null }).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/esercizi/:id', async (req, res) => {
  const { nome, data_inizio, data_fine, stato, note } = req.body;
  const { data, error } = await supabase.from('esercizi').update({ nome, data_inizio, data_fine, stato, note }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

// ------------------------------------------------------------
// PIANO DEI CONTI
// ------------------------------------------------------------
app.get('/api/esercizi/:esercizioId/piano-conti', async (req, res) => {
  const { data, error } = await supabase.from('piano_conti')
    .select('*, tabelle_millesimali(nome, codice)')
    .eq('esercizio_id', req.params.esercizioId)
    .order('codice');
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/esercizi/:esercizioId/piano-conti', async (req, res) => {
  const { categoria, sottocategoria, codice, tipo, importo_preventivo, tabella_millesimale_id, note, condominio_id } = req.body;
  if (!categoria) return res.status(400).json({ errore: 'La categoria è obbligatoria.' });
  const { data, error } = await supabase.from('piano_conti').insert({
    esercizio_id: req.params.esercizioId, condominio_id,
    categoria, sottocategoria: sottocategoria || null, codice: codice || null,
    tipo: tipo || 'uscita', importo_preventivo: Number(importo_preventivo) || 0,
    tabella_millesimale_id: tabella_millesimale_id || null, note: note || null,
  }).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/piano-conti/:id', async (req, res) => {
  const { error } = await supabase.from('piano_conti').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// ------------------------------------------------------------
// GRUPPI RATE
// ------------------------------------------------------------
app.get('/api/esercizi/:esercizioId/gruppi-rate', async (req, res) => {
  const { data, error } = await supabase.from('gruppi_rate').select('*').eq('esercizio_id', req.params.esercizioId).order('created_at');
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/esercizi/:esercizioId/gruppi-rate', async (req, res) => {
  const { nome, periodicita, num_rate, importo_totale, data_prima_rata, note, condominio_id } = req.body;
  if (!nome || !importo_totale) return res.status(400).json({ errore: 'Nome e importo totale sono obbligatori.' });

  const { data: gruppo, error } = await supabase.from('gruppi_rate').insert({
    esercizio_id: req.params.esercizioId, condominio_id,
    nome, periodicita: periodicita || 'mensile', num_rate: Number(num_rate) || 12,
    importo_totale: Number(importo_totale), data_prima_rata: data_prima_rata || null, note: note || null,
  }).select().single();
  if (error) return res.status(500).json({ errore: error.message });

  // Calcola e genera le rate per ogni unità
  const { data: unita } = await supabase.from('unita').select('id, millesimi').eq('condominio_id', condominio_id);
  const totMillesimi = unita.reduce((s, u) => s + Number(u.millesimi), 0) || 1000;
  const rate = [];
  const dataBase = data_prima_rata ? new Date(data_prima_rata) : new Date();

  unita.forEach(u => {
    const importoUnitaTotale = Math.round((Number(importo_totale) * Number(u.millesimi) / totMillesimi) * 100) / 100;
    const importoRata = Math.round((importoUnitaTotale / Number(num_rate)) * 100) / 100;
    for (let i = 0; i < Number(num_rate); i++) {
      const scadenza = new Date(dataBase);
      if (periodicita === 'mensile') scadenza.setMonth(scadenza.getMonth() + i);
      else if (periodicita === 'bimestrale') scadenza.setMonth(scadenza.getMonth() + i * 2);
      else if (periodicita === 'trimestrale') scadenza.setMonth(scadenza.getMonth() + i * 3);
      else if (periodicita === 'semestrale') scadenza.setMonth(scadenza.getMonth() + i * 6);
      else scadenza.setMonth(scadenza.getMonth() + i);
      rate.push({
        gruppo_rate_id: gruppo.id, unita_id: u.id, condominio_id,
        esercizio_id: req.params.esercizioId,
        importo: importoRata, numero_rata: i + 1,
        data_scadenza: scadenza.toISOString().slice(0, 10), stato: 'da_emettere',
      });
    }
  });

  if (rate.length) await supabase.from('rate').insert(rate);
  res.json(gruppo);
});

// ------------------------------------------------------------
// RATE
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/rate', async (req, res) => {
  const { esercizio_id, stato } = req.query;
  let query = supabase.from('rate')
    .select('*, unita(interno, proprietario), gruppi_rate(nome)')
    .eq('condominio_id', req.params.condominioId)
    .order('data_scadenza');
  if (esercizio_id) query = query.eq('esercizio_id', esercizio_id);
  if (stato) query = query.eq('stato', stato);
  const { data, error } = await query;
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/rate/:id/stato', async (req, res) => {
  const { stato, importo_pagato } = req.body;
  const { data, error } = await supabase.from('rate').update({
    stato, importo_pagato: importo_pagato ? Number(importo_pagato) : 0,
    data_pagamento: stato === 'pagato' ? new Date().toISOString().slice(0, 10) : null,
  }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

// ------------------------------------------------------------
// FATTURE PASSIVE
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/fatture-passive', async (req, res) => {
  const { esercizio_id, stato } = req.query;
  let query = supabase.from('fatture_passive')
    .select('*, fornitori(ragione_sociale), piano_conti(categoria)')
    .eq('condominio_id', req.params.condominioId)
    .order('data_fattura', { ascending: false });
  if (esercizio_id) query = query.eq('esercizio_id', esercizio_id);
  if (stato) query = query.eq('stato', stato);
  const { data, error } = await query;
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.post('/api/condomini/:condominioId/fatture-passive', async (req, res) => {
  const { numero_fattura, data_fattura, data_scadenza_pagamento, fornitore_id, esercizio_id,
    imponibile, aliquota_iva, ritenuta_acconto, descrizione, note, piano_conto_id } = req.body;
  if (!data_fattura || !imponibile) return res.status(400).json({ errore: 'Data e imponibile sono obbligatori.' });
  const imp = Number(imponibile);
  const aliq = Number(aliquota_iva) || 22;
  const iva = Math.round(imp * aliq / 100 * 100) / 100;
  const totale = imp + iva;
  const ritenuta = Number(ritenuta_acconto) || 0;
  const { data, error } = await supabase.from('fatture_passive').insert({
    condominio_id: req.params.condominioId,
    numero_fattura: numero_fattura || null, data_fattura,
    data_scadenza_pagamento: data_scadenza_pagamento || null,
    fornitore_id: fornitore_id || null, esercizio_id: esercizio_id || null,
    imponibile: imp, aliquota_iva: aliq, importo_iva: iva,
    importo_totale: totale, ritenuta_acconto: ritenuta,
    importo_da_pagare: totale - ritenuta,
    descrizione: descrizione || null, note: note || null,
    piano_conto_id: piano_conto_id || null,
  }).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.put('/api/fatture-passive/:id/stato', async (req, res) => {
  const { stato, data_pagamento, importo_pagato } = req.body;
  const { data, error } = await supabase.from('fatture_passive').update({
    stato, data_pagamento: data_pagamento || null,
    importo_pagato: importo_pagato ? Number(importo_pagato) : 0,
  }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

// ------------------------------------------------------------
// REGISTRO CONTO
// ------------------------------------------------------------
app.get('/api/condomini/:condominioId/registro-conto', async (req, res) => {
  const { esercizio_id } = req.query;
  let query = supabase.from('registro_conto')
    .select('*, unita(interno, proprietario), fornitori(ragione_sociale)')
    .eq('condominio_id', req.params.condominioId)
    .order('data_movimento', { ascending: false });
  if (esercizio_id) query = query.eq('esercizio_id', esercizio_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ errore: error.message });

  // Calcola saldo progressivo
  let saldo = 0;
  const movimenti = [...data].reverse().map(m => {
    saldo += m.tipo === 'entrata' ? Number(m.importo) : -Number(m.importo);
    return { ...m, saldo_progressivo: Math.round(saldo * 100) / 100 };
  });
  res.json(movimenti.reverse());
});

app.post('/api/condomini/:condominioId/registro-conto', async (req, res) => {
  const { tipo, data_movimento, descrizione, importo, esercizio_id,
    rata_id, fattura_id, unita_id, fornitore_id, piano_conto_id, riferimento_bancario, note } = req.body;
  if (!tipo || !data_movimento || !descrizione || !importo) return res.status(400).json({ errore: 'Tipo, data, descrizione e importo sono obbligatori.' });
  const { data, error } = await supabase.from('registro_conto').insert({
    condominio_id: req.params.condominioId,
    tipo, data_movimento, descrizione, importo: Number(importo),
    esercizio_id: esercizio_id || null,
    rata_id: rata_id || null, fattura_id: fattura_id || null,
    unita_id: unita_id || null, fornitore_id: fornitore_id || null,
    piano_conto_id: piano_conto_id || null,
    riferimento_bancario: riferimento_bancario || null, note: note || null,
  }).select().single();
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data);
});

app.delete('/api/registro-conto/:id', async (req, res) => {
  const { error } = await supabase.from('registro_conto').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ errore: error.message });
  res.json({ ok: true });
});

// Saldo registro conto per condominio/esercizio
app.get('/api/condomini/:condominioId/saldo-registro', async (req, res) => {
  const { esercizio_id } = req.query;
  const { data, error } = await supabase.rpc('calcola_saldo_registro', {
    p_condominio_id: req.params.condominioId,
    p_esercizio_id: esercizio_id || null,
  });
  if (error) return res.status(500).json({ errore: error.message });
  res.json(data[0] || { totale_entrate: 0, totale_uscite: 0, saldo: 0 });
});

// ------------------------------------------------------------
// Avvio server
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Gestaway Condomini in ascolto sulla porta ${PORT}`);
});
