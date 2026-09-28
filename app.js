'use strict';

/* ============================================================
   Mission Chine 2026 — tout le contenu vient de data.json.
   Ce fichier n'a pas à être modifié pour changer le voyage.
   ============================================================ */

const TZ_CN = 'Asia/Shanghai';
const TZ_BE = 'Europe/Brussels';
let D = null;          // contenu de data.json
let filtreAdresse = 'Tout';
let cibleRoute;           // partie après « / » dans l'adresse (#phrases/3, #notes/salon-1…)
let depuisCache = false; // true si data.json vient du cache (réseau indisponible)

const $ = (s) => document.querySelector(s);

/* ---------- Stockage local (peut être indisponible : navigation privée) ---------- */
function lire(cle, defaut) {
  try { const v = localStorage.getItem(cle); return v === null ? defaut : v; } catch (e) { return defaut; }
}
function ecrire(cle, val) {
  try { localStorage.setItem(cle, val); } catch (e) { /* ignoré */ }
}

/* ---------- Texte : échappement + surlignage des champs à compléter ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function t(s) {
  return esc(s).replace(/\[(À COMPLÉTER|à vérifier)\]/gi, (m) => '<mark>' + m + '</mark>');
}
function nettoyer(s) {
  return String(s || '').replace(/\[(À COMPLÉTER|à vérifier)\]/gi, '').replace(/\s{2,}/g, ' ').trim();
}

/* ---------- Heures ----------
   Les fuseaux du téléphone gèrent seuls le passage à l'heure d'hiver en Belgique :
   +6 h avant le 25/10/2026, +7 h après. Aucune date n'est codée en dur. */
function maintenant() {
  // ?t=2026-10-24T10:00:00Z permet de simuler une date (tests)
  const sim = new URLSearchParams(location.search).get('t');
  if (sim) { const d = new Date(sim); if (!isNaN(d)) return d; }
  return new Date();
}
function parts(date, tz) {
  const o = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).forEach((p) => { o[p.type] = p.value; });
  return o;
}
function ymd(date, tz) { const p = parts(date, tz); return p.year + '-' + p.month + '-' + p.day; }
function hm(date, tz) { const p = parts(date, tz); return p.hour + ':' + p.minute; }
function minutes(date, tz) { const p = parts(date, tz); return (+p.hour) * 60 + (+p.minute); }
function decalageMin(date, tz) {
  const p = parts(date, tz);
  const commeUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((commeUTC - date.getTime()) / 60000);
}
function ecartHeures(date) { return (decalageMin(date, TZ_CN) - decalageMin(date, TZ_BE)) / 60; }
function midiPekin(jourIso) { return new Date(jourIso + 'T12:00:00+08:00'); }
function dateLongue(date, tz) {
  return new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(date);
}
function dateCourte(date, tz) {
  return new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(date);
}
function enMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
function joursEntre(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

/* ---------- Accès aux données ---------- */
function adresse(id) { return (D.adresses || []).find((a) => a.id === id); }
function numeroTel(s) { return String(s || '').replace(/[^\d+]/g, ''); }
function telValide(s) { return numeroTel(s).replace('+', '').length >= 3; }

/* ---------- Chargement de data.json ---------- */
async function charger() {
  let texte, horsLigne;
  try {
    const r = await fetch('data.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    horsLigne = r.headers.get('X-Hors-Ligne') === '1';
    texte = await r.text();
  } catch (e) {
    afficherErreur('Impossible de charger le contenu.',
      'Pas de réseau, et le site n\'a encore jamais été ouvert sur ce téléphone avec une connexion.');
    return false;
  }
  try {
    D = JSON.parse(texte);
    migrerAnciennesNotes();
  } catch (e) {
    afficherErreur('Le fichier data.json contient une erreur de syntaxe.',
      e.message + '\n\nCauses fréquentes : virgule manquante ou en trop, guillemet non fermé.');
    return false;
  }
  depuisCache = horsLigne;
  if (!horsLigne) ecrire('majContenu', String(Date.now()));
  majEtat();
  if (D.voyage && D.voyage.titre) { $('#titre').textContent = D.voyage.titre; document.title = D.voyage.titre; }
  return true;
}

function afficherErreur(titre, detail) {
  $('#vue').innerHTML = '<div class="erreur"><h2>' + esc(titre) + '</h2><pre>' + esc(detail) + '</pre></div>';
}

/* ---------- Indicateur « à jour / hors ligne » ---------- */
function majEtat() {
  const el = $('#etat');
  const ts = +lire('majContenu', '0');
  const quand = ts ? new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts)) : '?';
  if (navigator.onLine && !depuisCache) {
    el.className = 'etat ok'; el.textContent = 'À jour';
  } else {
    el.className = 'etat hors'; el.textContent = 'Hors ligne · ' + quand;
  }
}

/* ---------- Composants ---------- */
function blocCreneaux(jour, estAujourdhui) {
  const cr = jour.creneaux || [];
  let passe = -1, enCours = -1, suivant = -1;
  if (estAujourdhui) {
    const m = minutes(maintenant(), jour.fuseau || TZ_CN);
    cr.forEach((c, i) => {
      const deb = enMinutes(c.heure);
      const next = cr[i + 1] ? enMinutes(cr[i + 1].heure) : null;
      let fin = enMinutes(c.fin) != null ? enMinutes(c.fin) : (next != null ? next : deb + 60);
      if (deb == null) return;
      if (fin < deb) fin += 24 * 60; // se termine après minuit
      if (m >= fin) passe = i;
      else if (m >= deb && enCours < 0) enCours = i;
      else if (m < deb && suivant < 0) suivant = i;
    });
  }
  return '<ul class="creneaux">' + cr.map((c, i) => {
    let cls = 'creneau';
    if (i === enCours) cls += ' encours';
    else if (i === suivant) cls += ' suivant';
    else if (estAujourdhui && i <= passe) cls += ' passe';
    const lieu = c.lieu ? adresse(c.lieu) : null;
    let details = '';
    if (lieu) details += '<div class="d">📍 <a href="#adresses/' + esc(lieu.id) + '">' + t(lieu.nom) + '</a></div>';
    else if (c.lieu) details += '<div class="d">📍 ' + t(c.lieu) + '</div>';
    if (c.transport) details += '<div class="d">🚗 ' + t(c.transport) + '</div>';
    if (c.note) details += '<div class="d">ℹ️ ' + t(c.note) + '</div>';
    return '<li class="' + cls + '"><div class="h">' + esc(c.heure || '') +
      (c.fin ? '<small>→ ' + esc(c.fin) + '</small>' : '') + '</div>' +
      '<div><div class="t">' + t(c.titre) + '</div>' + details + '</div></li>';
  }).join('') + '</ul>';
}

// Un jour peut avoir son propre fuseau (« fuseau »: "Europe/Brussels" pour le départ) : ses heures et sa date sont alors locales
function estJourCourant(jour, now) { return jour.date === ymd(now, jour.fuseau || TZ_CN); }

function enteteJour(jour, index) {
  const d = midiPekin(jour.date);
  let h = '<div class="jour-date">Jour ' + (index + 1) + ' · ' + esc(dateLongue(d, TZ_CN)) + '</div>';
  h += '<div class="meta">' + t(jour.titre || '') + (jour.ville ? ' — ' + t(jour.ville) : '') + '</div>';
  if (jour.fuseau === TZ_BE) h += '<div class="meta">Heures de Belgique</div>';
  return h;
}

function etiquettesJour(jour) {
  let h = '';
  if (jour.tenue) h += '<span class="etiquette">👔 ' + t(jour.tenue) + '</span>';
  const e = ecartHeures(midiPekin(jour.date));
  h += '<span class="etiquette">Belgique : −' + e + ' h</span>';
  const hotel = jour.hotel ? adresse(jour.hotel) : null;
  if (hotel) h += '<span class="etiquette">🛏 ' + t(hotel.nom) + '</span>';
  return h ? '<div>' + h + '</div>' : '';
}

/* ---------- Vue : Aujourd'hui ---------- */
function vueAujourdhui() {
  const now = maintenant();
  const e = ecartHeures(now);
  const jourCN = ymd(now, TZ_CN);
  const jours = D.jours || [];
  const index = jours.findIndex((j) => estJourCourant(j, now));

  let h = '<div class="horloges">' +
    '<div class="horloge"><div class="lieu">🇨🇳 Chine</div><div class="heure">' + hm(now, TZ_CN) + '</div><div class="date">' + esc(dateCourte(now, TZ_CN)) + '</div></div>' +
    '<div class="horloge"><div class="lieu">🇧🇪 Belgique</div><div class="heure">' + hm(now, TZ_BE) + '</div><div class="date">' + esc(dateCourte(now, TZ_BE)) + '</div></div>' +
    '</div>';

  // Changement de décalage à venir pendant le voyage
  let avis = '';
  const change = jours.find((j) => j.date > jourCN && ecartHeures(midiPekin(j.date)) !== e);
  if (change) avis = '<span class="meta">À partir du ' + esc(dateLongue(midiPekin(change.date), TZ_CN)) + ' : ' + ecartHeures(midiPekin(change.date)) + ' h (heure d\'hiver en Belgique)</span>';
  h += '<div class="decalage">La Chine a ' + e + ' h d\'avance' + avis + '</div>';

  const v = D.voyage || {};
  let jour = null;
  if (index >= 0) {
    jour = jours[index];
    h += '<div class="carte accent">' + enteteJour(jour, index) + etiquettesJour(jour) + blocCreneaux(jour, true) + '</div>';
  } else if (v.debut && ymd(now, (jours[0] && jours[0].fuseau) || TZ_CN) < v.debut) {
    const n = joursEntre(ymd(now, (jours[0] && jours[0].fuseau) || TZ_CN), v.debut);
    h += '<div class="carte accent"><h2>Départ dans ' + n + ' jour' + (n > 1 ? 's' : '') + '</h2><div class="meta">' +
      esc(dateLongue(midiPekin(v.debut), TZ_CN)) + ' → ' + esc(dateLongue(midiPekin(v.fin || v.debut), TZ_CN)) + '</div></div>';
    if (jours[0]) {
      jour = jours[0];
      h += '<div class="section-titre">Premier jour</div><div class="carte">' + enteteJour(jour, 0) + etiquettesJour(jour) + blocCreneaux(jour, false) + '</div>';
    }
  } else {
    h += '<div class="carte"><h2>Voyage terminé</h2><div class="meta">Le programme reste consultable dans l\'onglet Programme.</div></div>';
  }

  // Accès rapides
  const hotel = jour && jour.hotel ? adresse(jour.hotel) : null;
  h += '<div class="section-titre">Accès rapide</div><div class="grille-boutons">';
  if (hotel) h += '<button class="btn principal" data-chauffeur="' + esc(hotel.id) + '"><span class="ico">🛏</span>Hôtel de ce soir au chauffeur</button>';
  if (D.presentation && (D.presentation.versions || []).length) h += '<a class="btn principal" href="#presentation"><span class="ico">🤝</span>' + esc(D.presentation.titre || 'Nous présenter') + '</a>';
  h += '<a class="btn" href="#notes"><span class="ico">✎</span>Prendre une note</a>' +
    '<a class="btn urgence" href="#contacts"><span class="ico">☎</span>Urgences</a>' +
    '<a class="btn" href="#phrases"><span class="ico">文</span>Phrases utiles</a>' +
    '<a class="btn" href="#convertisseur"><span class="ico">¥</span>€ ↔ ¥</a>' +
    '<a class="btn" href="#programme"><span class="ico">▦</span>Toute la semaine</a>' +
    '</div>';
  if (v.note) h += '<p class="meta">' + t(v.note) + '</p>';
  return h;
}

/* ---------- Vue : Programme ---------- */
function vueProgramme() {
  const now = maintenant();
  const jours = D.jours || [];
  if (!jours.length) return '<p class="vide">Aucun jour dans data.json.</p>';
  return '<h2>Programme</h2>' + jours.map((j, i) => {
    const auj = estJourCourant(j, now);
    return '<details class="jour' + (auj ? ' aujourdhui' : '') + '"' + (auj ? ' open' : '') + '>' +
      '<summary>' + (auj ? '<span class="etiquette rouge">Aujourd\'hui</span>' : '') + enteteJour(j, i) + '</summary>' +
      '<div class="jour-corps">' + etiquettesJour(j) + blocCreneaux(j, auj) + '</div></details>';
  }).join('');
}

/* ---------- Vue : Salons ---------- */
function vueSalons() {
  const salons = D.salons || [];
  if (!salons.length) return '<p class="vide">Aucun salon dans data.json.</p>';
  return '<h2>Salons</h2>' + salons.map((s) => {
    const lieu = s.lieu ? adresse(s.lieu) : null;
    let h = '<div class="carte"><h3>' + t(s.nom) + '</h3>';
    if (s.dates) h += '<div>📅 ' + t(s.dates) + '</div>';
    if (s.horaires) h += '<div>🕘 ' + t(s.horaires) + '</div>';
    if (lieu) h += '<div>📍 <a href="#adresses/' + esc(lieu.id) + '">' + t(lieu.nom) + '</a></div>';
    if (s.halls) h += '<div>🏷 ' + t(s.halls) + '</div>';
    if (lieu) h += '<div class="boutons"><button class="btn principal" data-chauffeur="' + esc(lieu.id) + '">Montrer au chauffeur</button></div>';
    if ((s.objectifs || []).length) {
      h += '<div class="section-titre">Objectifs</div><ul class="liste">' + s.objectifs.map((o) => '<li>' + t(o) + '</li>').join('') + '</ul>';
    }
    if ((s.exposants || []).length) {
      h += '<div class="section-titre">Exposants à voir</div><ul class="liste">' + s.exposants.map((x) =>
        '<li><strong>' + t(x.nom) + '</strong>' + (x.stand ? ' — ' + t(x.stand) : '') +
        (x.pourquoi ? '<div class="meta">' + t(x.pourquoi) + '</div>' : '') + '</li>').join('') + '</ul>';
    }
    const n = lireNotes().filter((x) => x.salon === s.id).length;
    h += '<div class="boutons"><a class="btn" href="#notes/' + esc(s.id) + '">✎ Mes notes sur ce salon (' + n + ')</a></div>';
    return h + '</div>';
  }).join('');
}

/* ---------- Notes à la volée ----------
   Toutes les notes dans une seule liste, sur ce téléphone uniquement (clé « notes-v1 »).
   Chaque note : { id, t (horodatage), txt, salon (id du salon ou "") }. */
const CLE_NOTES = 'notes-v1';
let filtreNotes = 'toutes';
let rechercheNotes = '';
let noteEnEdition = null;
let salonChoisi = null; // { salon, jour } : choix manuel, valable pour la journée

function lireNotes() {
  try { const n = JSON.parse(lire(CLE_NOTES, '[]')); return Array.isArray(n) ? n : []; } catch (e) { return []; }
}
function ecrireNotes(notes) {
  try { localStorage.setItem(CLE_NOTES, JSON.stringify(notes)); return true; } catch (e) {
    avertir('Enregistrement impossible (mémoire pleine ou navigation privée). Exportez vos notes.');
    return false;
  }
}
function nouvelId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function nomSalon(id) {
  const s = (D.salons || []).find((x) => x.id === id);
  return s ? (nettoyer(s.nom) || s.id) : 'Sans salon';
}

// Reprend les notes de l'ancienne version (un champ par salon)
function migrerAnciennesNotes() {
  const notes = lireNotes();
  let change = false;
  (D.salons || []).forEach((s) => {
    const cle = 'notes:' + (s.id || s.nom);
    const txt = lire(cle, '').trim();
    if (txt) { notes.push({ id: nouvelId(), t: Date.now(), txt: txt, salon: s.id || '' }); change = true; }
    if (txt || lire(cle, null) !== null) { try { localStorage.removeItem(cle); } catch (e) { /* ignoré */ } }
  });
  if (change) ecrireNotes(notes);
}

// Salon du moment d'après le programme du jour (créneau en cours, sinon premier créneau au salon)
function salonDuMoment() {
  const now = maintenant();
  const jour = (D.jours || []).find((j) => estJourCourant(j, now));
  if (!jour) return '';
  const parLieu = {};
  (D.salons || []).forEach((s) => { if (s.lieu) parLieu[s.lieu] = s.id; });
  // Un créneau est rattaché à un salon par « salon » (son id) ou par son lieu
  const salonDe = (c) => c.salon || parLieu[c.lieu];
  const tous = (jour.creneaux || []).filter((c) => enMinutes(c.heure) != null);
  const cr = tous.filter(salonDe);
  if (!cr.length) return '';
  const m = minutes(now, jour.fuseau || TZ_CN);
  // Créneau en cours (quel qu'il soit) : on suit son rattachement, « Sans salon » s'il n'en a pas
  const enCours = tous.find((c) => {
    const d = enMinutes(c.heure);
    let f = enMinutes(c.fin);
    if (f != null && f < d) f += 24 * 60;
    return m >= d && (f == null ? m < d + 60 : m < f);
  });
  if (enCours) return salonDe(enCours) || '';
  // Sinon : le dernier salon commencé, ou à défaut le premier de la journée
  const commences = cr.filter((c) => enMinutes(c.heure) <= m);
  return salonDe(commences.length ? commences[commences.length - 1] : cr[0]);
}
function salonParDefaut() {
  if (salonChoisi && salonChoisi.jour === ymd(maintenant(), TZ_CN)) return salonChoisi.salon;
  return salonDuMoment();
}

function optionsSalons(choisi) {
  return '<option value="">Sans salon</option>' + (D.salons || []).map((s) =>
    '<option value="' + esc(s.id) + '"' + (s.id === choisi ? ' selected' : '') + '>' + esc(nomSalon(s.id)) + '</option>').join('');
}
function heureNote(ts) {
  const d = new Date(ts);
  return hm(d, TZ_CN);
}

/* ---------- Photos des notes ----------
   Stockées sur le téléphone (IndexedDB « chine-photos »), réduites à 1600 px.
   Une note garde la liste de ses photos : note.photos = [id, …]. */
let dbPromesse = null;
const urlsPhotos = {};
let photoCible = null; // 'nouvelle' ou id de la note en cours de modification

function basePhotos() {
  if (!dbPromesse) {
    dbPromesse = new Promise((ok, ko) => {
      const r = indexedDB.open('chine-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  }
  return dbPromesse;
}
async function transaction(mode, action) {
  const base = await basePhotos();
  return new Promise((ok, ko) => {
    const tx = base.transaction('photos', mode);
    const req = action(tx.objectStore('photos'));
    tx.oncomplete = () => ok(req && req.result);
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error);
  });
}
function photoEnregistrer(obj) { return transaction('readwrite', (s) => s.put(obj)); }
function photoLire(id) { return transaction('readonly', (s) => s.get(id)); }
function photosSupprimer(ids) {
  (ids || []).forEach((id) => { if (urlsPhotos[id]) { URL.revokeObjectURL(urlsPhotos[id]); delete urlsPhotos[id]; } });
  return transaction('readwrite', (s) => { (ids || []).forEach((id) => s.delete(id)); return null; }).catch(() => {});
}

async function reduirePhoto(fichier) {
  const MAX = 1600;
  try {
    const img = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const r = Math.min(1, MAX / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    if (img.close) img.close();
    return await new Promise((ok) => c.toBlob((b) => ok(b || fichier), 'image/jpeg', 0.82));
  } catch (e) {
    return fichier;
  }
}

function photosEnAttente() {
  try { const l = JSON.parse(lire('photos-attente', '[]')); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}

// Ajoute des photos à la note en cours de saisie (« nouvelle ») ou à une note existante
async function ajouterPhotos(fichiers, cible) {
  const ids = [];
  for (const f of fichiers) {
    try {
      const blob = await reduirePhoto(f);
      const id = nouvelId();
      await photoEnregistrer({ id: id, blob: blob, t: Date.now() });
      ids.push(id);
    } catch (e) {
      avertir('Photo non enregistrée (mémoire du téléphone pleine ?).');
    }
  }
  if (!ids.length) return;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (cible === 'nouvelle') {
    ecrire('photos-attente', JSON.stringify(photosEnAttente().concat(ids)));
    route(true);
  } else {
    const notes = lireNotes();
    const n = notes.find((x) => x.id === cible);
    if (n) { n.photos = (n.photos || []).concat(ids); ecrireNotes(notes); }
    majListeNotes();
  }
  avertir(ids.length > 1 ? ids.length + ' photos ajoutées ✓' : 'Photo ajoutée ✓');
}

function vignettesHtml(ids, retirable, cible) {
  if (!ids || !ids.length) return '';
  return '<div class="vignettes">' + ids.map((id) =>
    '<span class="vignette"><img data-photo-id="' + esc(id) + '" data-voir-photo="' + esc(id) + '" alt="Photo">' +
    (retirable ? '<button class="vignette-retirer" data-photo-retirer="' + esc(id) + '" data-photo-de="' + esc(cible) + '" aria-label="Retirer la photo">✕</button>' : '') +
    '</span>').join('') + '</div>';
}
function boutonsPhoto(cible) {
  return '<div class="boutons boutons-photo">' +
    '<button class="btn" data-photo-prendre="camera" data-photo-pour="' + esc(cible) + '">📷 Photo</button>' +
    '<button class="btn" data-photo-prendre="galerie" data-photo-pour="' + esc(cible) + '">🖼 Galerie</button></div>';
}

// Charge les images affichées depuis la mémoire du téléphone
function hydraterPhotos() {
  document.querySelectorAll('img[data-photo-id]:not([src])').forEach((img) => {
    const id = img.dataset.photoId;
    if (urlsPhotos[id]) { img.src = urlsPhotos[id]; return; }
    photoLire(id).then((p) => {
      if (!p) { img.alt = 'Photo introuvable'; img.classList.add('absente'); return; }
      urlsPhotos[id] = URL.createObjectURL(p.blob);
      img.src = urlsPhotos[id];
    }).catch(() => {});
  });
}

function voirPhoto(id) {
  const url = urlsPhotos[id];
  if (!url) return;
  $('#visionneuse-img').src = url;
  $('#visionneuse').hidden = false;
}

/* ---------- Écran Notes ---------- */
function vueNotes() {
  const notes = lireNotes();
  const attente = photosEnAttente();
  let h = '<h2>Mes notes</h2>' +
    '<div class="carte accent saisie-note">' +
    '<textarea id="note-saisie" placeholder="Tapez ou dictez avec le 🎤 du clavier…">' + esc(lire('note-brouillon', '')) + '</textarea>' +
    vignettesHtml(attente, true, 'nouvelle') + boutonsPhoto('nouvelle') +
    '<label class="note-salon-label">Salon : <select id="note-salon">' + optionsSalons(salonParDefaut()) + '</select></label>' +
    '<div class="boutons"><button class="btn principal" data-note-ajouter>＋ Ajouter la note</button></div></div>';

  // Filtres
  const compte = (f) => notes.filter((n) => f === 'toutes' || (n.salon || 'aucun') === f).length;
  const filtres = [['toutes', 'Toutes']].concat((D.salons || []).map((s) => [s.id, nomSalon(s.id)]), [['aucun', 'Sans salon']]);
  if (!filtres.some((f) => f[0] === filtreNotes)) filtreNotes = 'toutes';
  h += '<div class="filtres">' + filtres.map(([id, nom]) =>
    '<button class="filtre' + (id === filtreNotes ? ' actif' : '') + '" data-notes-filtre="' + esc(id) + '">' +
    esc(nom) + ' (' + compte(id) + ')</button>').join('') + '</div>';
  h += '<input id="notes-recherche" class="recherche" type="search" placeholder="Rechercher dans mes notes" value="' + esc(rechercheNotes) + '">';
  h += '<div id="notes-liste">' + listeNotesHtml(notes) + '</div>';

  const nbPhotos = notes.reduce((s, n) => s + (n.photos || []).length, 0);
  h += '<div class="section-titre">Exporter : ' + notes.length + ' note' + (notes.length > 1 ? 's' : '') +
    ', ' + nbPhotos + ' photo' + (nbPhotos > 1 ? 's' : '') + '</div>' +
    '<div class="boutons"><button class="btn principal" data-notes-zip>⬇ Tout télécharger (.zip : texte + photos)</button>' +
    '<button class="btn" data-notes-partager>Partager le texte (mail, WhatsApp…)</button></div>' +
    '<p class="meta">Les notes et les photos restent sur ce téléphone uniquement : exportez-les chaque soir.</p>';
  return h;
}

function listeNotesHtml(notes) {
  const q = rechercheNotes.trim().toLowerCase();
  const visibles = notes.slice().reverse() // à heure égale, la plus récente en premier
    .filter((n) => filtreNotes === 'toutes' || (n.salon || 'aucun') === filtreNotes)
    .filter((n) => !q || n.txt.toLowerCase().includes(q))
    .sort((a, b) => b.t - a.t);
  if (!visibles.length) return '<p class="vide">' + (notes.length ? 'Aucune note ne correspond.' : 'Aucune note pour l\'instant.') + '</p>';
  let h = '', jourCourant = '';
  visibles.forEach((n) => {
    const jour = ymd(new Date(n.t), TZ_CN);
    if (jour !== jourCourant) {
      if (jourCourant) h += '</div>';
      h += '<div class="section-titre">' + esc(dateLongue(new Date(n.t), TZ_CN)) + '</div><div class="carte">';
      jourCourant = jour;
    }
    if (n.id === noteEnEdition) {
      h += '<div class="note edition"><textarea id="note-edition">' + esc(n.txt) + '</textarea>' +
        vignettesHtml(n.photos, true, n.id) + boutonsPhoto(n.id) +
        '<label class="note-salon-label">Salon : <select id="note-edition-salon">' + optionsSalons(n.salon) + '</select></label>' +
        '<div class="boutons"><button class="btn principal" data-note-enregistrer="' + esc(n.id) + '">Enregistrer</button>' +
        '<button class="btn" data-note-annuler>Fermer</button>' +
        '<button class="btn danger" data-note-supprimer="' + esc(n.id) + '">Supprimer la note</button></div></div>';
    } else {
      h += '<div class="note"><button class="note-corps" data-note-modifier="' + esc(n.id) + '">' +
        '<div class="note-meta">' + heureNote(n.t) + (n.salon ? ' · ' + esc(nomSalon(n.salon)) : '') + '</div>' +
        (n.txt ? '<div class="note-txt">' + esc(n.txt) + '</div>' : '') + '</button>' +
        vignettesHtml(n.photos, false) + '</div>';
    }
  });
  return h + '</div>';
}
function majListeNotes() {
  const el = $('#notes-liste');
  if (el) el.innerHTML = listeNotesHtml(lireNotes());
  hydraterPhotos();
}

/* ---------- Export ---------- */
function deux(n) { return String(n).padStart(2, '0'); }
function nomFichierPhoto(note, k) {
  const p = parts(new Date(note.t), TZ_CN);
  return 'photos/' + p.year + '-' + p.month + '-' + p.day + '_' + p.hour + 'h' + p.minute + '_' +
    (note.salon || 'sans-salon') + '_' + note.id.slice(-4) + '-' + (k + 1) + '.jpg';
}
function texteExport() {
  const notes = lireNotes().slice().sort((a, b) => a.t - b.t);
  const titre = (D.voyage && D.voyage.titre) || 'Voyage';
  let txt = titre + ' — mes notes (' + notes.length + '), exportées le ' +
    dateLongue(maintenant(), TZ_CN) + ' à ' + hm(maintenant(), TZ_CN) + ' (heure de Pékin)\n';
  const groupes = [];
  (D.salons || []).forEach((s) => groupes.push([s.id, nomSalon(s.id)]));
  groupes.push(['', 'Sans salon']);
  groupes.forEach(([id, nom]) => {
    const lot = notes.filter((n) => (n.salon || '') === id || (id === '' && n.salon && !(D.salons || []).some((s) => s.id === n.salon)));
    if (!lot.length) return;
    txt += '\n=== ' + nom + ' ===\n';
    lot.forEach((n) => {
      txt += '\n[' + dateCourte(new Date(n.t), TZ_CN) + ' ' + heureNote(n.t) + ']\n' + (n.txt || '(photo seule)') + '\n';
      (n.photos || []).forEach((pid, k) => { txt += '  📷 ' + nomFichierPhoto(n, k) + '\n'; });
    });
  });
  return txt;
}

// Archive .zip sans compression (les JPEG sont déjà compressés)
const TABLE_CRC = (() => {
  const tb = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; }
  return tb;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = TABLE_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function creerZip(fichiers) {
  const enc = new TextEncoder();
  const morceaux = [], central = [];
  let decalage = 0, tailleCentral = 0;
  const d = new Date();
  const heure = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  fichiers.forEach((f) => {
    const nom = enc.encode(f.nom), data = f.donnees, crc = crc32(data);
    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true);
    l.setUint16(10, heure, true); l.setUint16(12, date, true); l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, nom.length, true);
    morceaux.push(l.buffer, nom, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(12, heure, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nom.length, true);
    c.setUint32(42, decalage, true);
    central.push(c.buffer, nom);
    tailleCentral += 46 + nom.length;
    decalage += 30 + nom.length + data.length;
  });
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true); fin.setUint32(16, decalage, true);
  return new Blob(morceaux.concat(central, [fin.buffer]), { type: 'application/zip' });
}
async function zipExport() {
  const notes = lireNotes();
  const fichiers = [{ nom: 'notes.txt', donnees: new TextEncoder().encode(texteExport()) }];
  let manquantes = 0;
  for (const n of notes) {
    for (let k = 0; k < (n.photos || []).length; k++) {
      const p = await photoLire(n.photos[k]).catch(() => null);
      if (p) fichiers.push({ nom: nomFichierPhoto(n, k), donnees: new Uint8Array(await p.blob.arrayBuffer()) });
      else manquantes++;
    }
  }
  return { zip: creerZip(fichiers), nb: fichiers.length - 1, manquantes: manquantes };
}
function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ---------- Actions de l'écran Notes ---------- */
function clicNotes(e) {
  const el = (sel) => e.target.closest(sel);
  let b;
  if ((b = el('[data-voir-photo]'))) { voirPhoto(b.dataset.voirPhoto); return true; }
  if ((b = el('[data-photo-prendre]'))) {
    photoCible = b.dataset.photoPour;
    $(b.dataset.photoPrendre === 'camera' ? '#photo-camera' : '#photo-galerie').click();
    return true;
  }
  if ((b = el('[data-photo-retirer]'))) {
    if (!confirm('Retirer cette photo ?')) return true;
    const id = b.dataset.photoRetirer, de = b.dataset.photoDe;
    if (de === 'nouvelle') {
      ecrire('photos-attente', JSON.stringify(photosEnAttente().filter((x) => x !== id)));
      photosSupprimer([id]);
      route(true);
    } else {
      const notes = lireNotes();
      const n = notes.find((x) => x.id === de);
      if (n) { n.photos = (n.photos || []).filter((x) => x !== id); ecrireNotes(notes); }
      photosSupprimer([id]);
      majListeNotes();
    }
    return true;
  }
  if ((b = el('[data-note-ajouter]'))) {
    const champ = $('#note-saisie');
    const txt = champ.value.trim();
    const attente = photosEnAttente();
    if (!txt && !attente.length) { champ.focus(); return true; }
    const notes = lireNotes();
    notes.push({ id: nouvelId(), t: maintenant().getTime(), txt: txt, salon: $('#note-salon').value, photos: attente });
    if (ecrireNotes(notes)) {
      ecrire('note-brouillon', '');
      ecrire('photos-attente', '[]');
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      salonChoisi = { salon: $('#note-salon').value, jour: ymd(maintenant(), TZ_CN) };
      route(true);
      avertir('Note enregistrée ✓');
      $('#note-saisie').focus();
    }
    return true;
  }
  if ((b = el('[data-notes-filtre]'))) { filtreNotes = b.dataset.notesFiltre; route(true); return true; }
  if ((b = el('[data-note-modifier]'))) { noteEnEdition = b.dataset.noteModifier; majListeNotes(); const z = $('#note-edition'); if (z) z.focus(); return true; }
  if ((b = el('[data-note-annuler]'))) { noteEnEdition = null; majListeNotes(); return true; }
  if ((b = el('[data-note-enregistrer]'))) {
    const notes = lireNotes();
    const n = notes.find((x) => x.id === b.dataset.noteEnregistrer);
    const txt = $('#note-edition').value.trim();
    if (n && (txt || (n.photos || []).length)) { n.txt = txt; n.salon = $('#note-edition-salon').value; }
    if (ecrireNotes(notes)) { noteEnEdition = null; route(true); }
    return true;
  }
  if ((b = el('[data-note-supprimer]'))) {
    if (!confirm('Supprimer définitivement cette note et ses photos ?')) return true;
    const notes = lireNotes();
    const n = notes.find((x) => x.id === b.dataset.noteSupprimer);
    if (ecrireNotes(notes.filter((x) => x.id !== b.dataset.noteSupprimer))) {
      if (n) photosSupprimer(n.photos);
      noteEnEdition = null;
      route(true);
    }
    return true;
  }
  if ((b = el('[data-notes-partager]'))) {
    const txt = texteExport();
    if (navigator.share) navigator.share({ title: 'Mes notes — Chine 2026', text: txt }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => avertir('Notes copiées : collez-les dans un mail ou une note.')).catch(() => {});
    return true;
  }
  if ((b = el('[data-notes-zip]'))) {
    b.disabled = true;
    avertir('Préparation de l\'archive…');
    zipExport().then((r) => {
      telecharger(r.zip, 'notes-chine-' + ymd(maintenant(), TZ_CN) + '.zip');
      avertir('Archive téléchargée : ' + r.nb + ' photo' + (r.nb > 1 ? 's' : '') + (r.manquantes ? ' (' + r.manquantes + ' introuvable)' : '') + ' ✓');
    }).catch(() => avertir('Échec de l\'export. Réessayez.')).finally(() => { b.disabled = false; });
    return true;
  }
  return false;
}

// Choix d'une photo (appareil photo ou galerie)
['#photo-camera', '#photo-galerie'].forEach((sel) => {
  $(sel).addEventListener('change', (e) => {
    const fichiers = [...e.target.files];
    e.target.value = '';
    if (fichiers.length && photoCible) ajouterPhotos(fichiers, photoCible);
  });
});
$('#visionneuse').addEventListener('click', () => { $('#visionneuse').hidden = true; $('#visionneuse-img').removeAttribute('src'); });

/* ---------- Vue : Adresses ---------- */
function lienAmap(a) {
  if (a.lat && a.lng) {
    return 'https://uri.amap.com/marker?position=' + a.lng + ',' + a.lat + '&name=' + encodeURIComponent(nettoyer(a.nomZh || a.nom)) + '&callnative=1';
  }
  return 'https://uri.amap.com/search?keyword=' + encodeURIComponent(nettoyer(a.adresseZh || a.nomZh || a.adresse)) + '&callnative=1';
}
function lienApple(a) {
  if (a.lat && a.lng) return 'https://maps.apple.com/?ll=' + a.lat + ',' + a.lng + '&q=' + encodeURIComponent(nettoyer(a.nom));
  return 'https://maps.apple.com/?q=' + encodeURIComponent(nettoyer(a.adresseZh || a.adresseEn || a.adresse));
}

function vueAdresses() {
  const liste = D.adresses || [];
  const cats = ['Tout'].concat([...new Set(liste.map((a) => a.categorie || 'Autre'))]);
  if (!cats.includes(filtreAdresse)) filtreAdresse = 'Tout';
  let h = '<h2>Adresses</h2><div class="filtres">' + cats.map((c) =>
    '<button class="filtre' + (c === filtreAdresse ? ' actif' : '') + '" data-filtre="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>';
  const visibles = liste.filter((a) => filtreAdresse === 'Tout' || (a.categorie || 'Autre') === filtreAdresse);
  h += visibles.map((a) => {
    let c = '<div class="carte" id="a-' + esc(a.id) + '"><span class="etiquette">' + esc(a.categorie || 'Autre') + '</span>';
    c += '<h3>' + t(a.nom) + '</h3>';
    if (a.nomEn) c += '<div class="meta">' + t(a.nomEn) + '</div>';
    if (a.nomZh) c += '<div class="zh" lang="zh-CN">' + esc(a.nomZh) + '</div>';
    c += '<div class="adresse-bloc">';
    if (a.adresse) c += '<div>' + t(a.adresse) + '</div>';
    if (a.adresseEn) c += '<div class="meta">' + t(a.adresseEn) + '</div>';
    if (a.adresseZh) c += '<div class="zh" lang="zh-CN">' + esc(a.adresseZh) + '</div>';
    c += '</div>';
    if (a.note) c += '<p class="meta">ℹ️ ' + t(a.note) + '</p>';
    c += '<div class="boutons"><button class="btn principal" data-chauffeur="' + esc(a.id) + '">Montrer au chauffeur</button>' +
      '<a class="btn" href="' + esc(lienAmap(a)) + '" target="_blank" rel="noopener">Amap</a>' +
      '<a class="btn" href="' + esc(lienApple(a)) + '" target="_blank" rel="noopener">Apple Plans</a>' +
      (a.nomZh || a.adresseZh ? boutonParler([a.nomZh, a.adresseZh].filter(Boolean).join('，'), '🔊 Écouter') : '');
    if (telValide(a.telephone)) c += '<a class="btn tel" href="tel:' + esc(numeroTel(a.telephone)) + '">☎ Appeler</a>';
    return c + '</div></div>';
  }).join('');
  return h;
}

/* ---------- Vue : Plus ---------- */
function vuePlus() {
  return '<h2>Plus</h2><div class="grille-boutons">' +
    '<a class="btn" href="#contacts"><span class="ico">☎</span>Contacts</a>' +
    '<a class="btn" href="#phrases"><span class="ico">文</span>Phrases utiles</a>' +
    '<a class="btn" href="#pratique"><span class="ico">✓</span>Pratique</a>' +
    '<a class="btn" href="#convertisseur"><span class="ico">¥</span>€ ↔ ¥</a>' +
    '</div>';
}

/* ---------- Vue : Contacts ---------- */
function vueContacts() {
  const groupes = {};
  (D.contacts || []).forEach((c) => { (groupes[c.groupe || 'Autres'] = groupes[c.groupe || 'Autres'] || []).push(c); });
  let h = '<h2>Contacts</h2>';
  Object.keys(groupes).forEach((g) => {
    const urg = /urgence/i.test(g);
    h += '<div class="section-titre">' + esc(g) + '</div><div class="carte' + (urg ? ' urgences' : '') + '">';
    h += groupes[g].map((c) => {
      const ok = telValide(c.telephone);
      return '<div class="contact"><div><div class="nom">' + t(c.nom) + '</div>' +
        (c.role ? '<div class="meta">' + t(c.role) + '</div>' : '') +
        (c.note ? '<div class="meta">' + t(c.note) + '</div>' : '') + '</div>' +
        '<a class="btn ' + (urg ? 'urgence' : 'tel') + '" href="tel:' + esc(numeroTel(c.telephone)) + '"' + (ok ? '' : ' aria-disabled="true"') + '>☎ ' +
        esc(ok ? c.telephone : '—') + '</a></div>';
    }).join('');
    h += '</div>';
  });
  return h;
}

/* ---------- Vue : Pratique ---------- */
function vuePratique() {
  let h = '<h2>Pratique</h2>';
  (D.pratique || []).forEach((r) => {
    h += '<div class="carte"><h3>' + t(r.titre) + '</h3><ul class="liste">' + (r.points || []).map((p) => '<li>' + t(p) + '</li>').join('') + '</ul></div>';
  });
  if ((D.checklist || []).length) {
    h += '<div class="section-titre">Check-list avant le départ (cochée sur ce téléphone)</div><div class="carte">' +
      D.checklist.map((c) => {
        const cle = 'check:' + c;
        return '<label class="coche"><input type="checkbox" data-check="' + esc(cle) + '"' + (lire(cle, '') === '1' ? ' checked' : '') + '><span>' + t(c) + '</span></label>';
      }).join('') + '</div>';
  }
  return h;
}

/* ---------- Vue : Phrases ---------- */
let recherchePhrases = '';

// Catégories dans l'ordre de data.json (« categoriesPhrases »), puis celles qui n'y figurent pas
function categoriesPhrases() {
  const liste = (D.categoriesPhrases || []).map((c) => ({ nom: c.nom, icone: c.icone || '💬' }));
  (D.phrases || []).forEach((p) => {
    const nom = p.categorie || 'Divers';
    if (!liste.some((c) => c.nom === nom)) liste.push({ nom: nom, icone: '💬' });
  });
  return liste;
}
function sansAccents(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function lignePhrase(p, i, avecCategorie) {
  return '<div class="phrase-ligne"><button class="phrase" data-phrase="' + i + '">' +
    (avecCategorie ? '<div class="note-meta">' + esc(p.categorie || 'Divers') + '</div>' : '') +
    '<div class="fr">' + t(p.fr) + '</div>' +
    '<div class="zh" lang="zh-CN">' + esc(p.zh) + '</div><div class="py">' + esc(p.pinyin) + '</div></button>' +
    boutonParler(p.zh) + '</div>';
}
function resultatsPhrasesHtml() {
  const q = sansAccents(recherchePhrases.trim());
  const trouvees = [];
  (D.phrases || []).forEach((p, i) => {
    if (sansAccents(p.fr + ' ' + p.pinyin).includes(q) || (p.zh || '').includes(recherchePhrases.trim())) trouvees.push([p, i]);
  });
  if (!trouvees.length) return '<p class="vide">Aucune phrase trouvée.</p>';
  return '<div class="carte">' + trouvees.map(([p, i]) => lignePhrase(p, i, true)).join('') + '</div>';
}
function majResultatsPhrases() {
  const el = $('#phrases-contenu');
  if (el) el.innerHTML = recherchePhrases.trim() ? resultatsPhrasesHtml() : sommairePhrasesHtml();
}
function sommairePhrasesHtml() {
  const phrases = D.phrases || [];
  const pres = D.presentation && (D.presentation.versions || []).length
    ? '<a class="btn principal tuile-presentation" href="#presentation">🤝 ' + esc(D.presentation.titre || 'Nous présenter') + '<small>texte de présentation en chinois et en anglais</small></a>'
    : '';
  return pres + '<div class="grille-boutons">' + categoriesPhrases().map((c, k) => {
    const n = phrases.filter((p) => (p.categorie || 'Divers') === c.nom).length;
    return n ? '<a class="btn tuile" href="#phrases/' + k + '"><span class="ico">' + esc(c.icone) + '</span>' +
      esc(c.nom) + '<small>' + n + ' phrases</small></a>' : '';
  }).join('') + '</div>';
}

function vuePhrases() {
  const cats = categoriesPhrases();
  const k = cibleRoute !== undefined && cibleRoute !== '' ? +cibleRoute : -1;
  const aide = '<p class="meta">Touchez une phrase pour l\'afficher en grand' + (voixPossible() ? ', ou 🔊 pour l\'entendre' : '') + '.</p>';
  if (k >= 0 && cats[k]) {
    const c = cats[k];
    const lot = [];
    (D.phrases || []).forEach((p, i) => { if ((p.categorie || 'Divers') === c.nom) lot.push([p, i]); });
    return '<a class="btn retour" href="#phrases">← Toutes les catégories</a>' +
      '<h2>' + esc(c.icone) + ' ' + esc(c.nom) + '</h2>' + aide +
      '<div class="carte">' + lot.map(([p, i]) => lignePhrase(p, i, false)).join('') + '</div>';
  }
  return '<h2>Phrases utiles</h2>' +
    '<input id="phrases-recherche" class="recherche" type="search" placeholder="Chercher (français ou pinyin)" value="' + esc(recherchePhrases) + '">' +
    aide + '<div id="phrases-contenu">' + (recherchePhrases.trim() ? resultatsPhrasesHtml() : sommairePhrasesHtml()) + '</div>';
}

/* ---------- Vue : Nous présenter ---------- */
function vuePresentation() {
  const P = D.presentation || {};
  const versions = P.versions || [];
  if (!versions.length) return '<p class="vide">Aucun texte de présentation dans data.json (rubrique "presentation").</p>';
  let k = cibleRoute !== undefined && cibleRoute !== '' ? +cibleRoute : 0;
  if (!versions[k]) k = 0;
  const v = versions[k];
  let h = '<a class="btn retour" href="#phrases">← Phrases utiles</a><h2>🤝 ' + esc(P.titre || 'Nous présenter') + '</h2>';
  if (versions.length > 1) {
    h += '<div class="filtres">' + versions.map((x, i) =>
      '<a class="filtre' + (i === k ? ' actif' : '') + '" href="#presentation/' + i + '">' + esc(x.nom || 'Version ' + (i + 1)) + '</a>').join('') + '</div>';
  }
  h += '<div class="boutons">' +
    (v.zh ? '<button class="btn principal" data-presentation="' + k + '" data-langue="zh">Montrer en chinois</button>' : '') +
    (v.en ? '<button class="btn" data-presentation="' + k + '" data-langue="en">Show in English</button>' : '') +
    (v.zh ? boutonParler(v.zh, '🔊 Lire en chinois') : '') + '</div>';
  if (v.fr) h += '<div class="section-titre">Français (pour vous)</div><div class="carte texte-long">' + t(v.fr) + '</div>';
  if (v.zh) h += '<div class="section-titre">中文</div><div class="carte texte-long zh-long" lang="zh-CN">' + esc(v.zh) + '</div>';
  if (v.en) h += '<div class="section-titre">English</div><div class="carte texte-long" lang="en">' + esc(v.en) + '</div>';
  return h;
}

/* ---------- Vue : Convertisseur ---------- */
function vueConvertisseur() {
  const taux = D.taux && +D.taux.eurCny;
  if (!taux) return '<p class="vide">Taux absent de data.json (rubrique "taux", champ "eurCny").</p>';
  const reperes = [10, 50, 100, 200, 500, 1000];
  return '<h2>Convertisseur</h2><div class="carte conv">' +
    '<label for="eur">€ Euros</label><input id="eur" inputmode="decimal" autocomplete="off" placeholder="0">' +
    '<label for="cny">¥ Yuans (CNY)</label><input id="cny" inputmode="decimal" autocomplete="off" placeholder="0">' +
    '<p class="meta">Taux fixe : 1 € = ' + taux.toLocaleString('fr-BE') + ' ¥ — ' + t(D.taux.date || '') + '</p></div>' +
    '<div class="section-titre">Repères</div><div class="carte"><table class="repere">' +
    reperes.map((n) => '<tr><td>' + n.toLocaleString('fr-BE') + ' ¥</td><td>' + fmt(n / taux) + ' €</td></tr>').join('') +
    '</table></div>';
}
function fmt(n) { return n.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function nombre(s) { const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; }

/* ---------- Navigation par onglets ---------- */
const VUES = {
  aujourdhui: vueAujourdhui, programme: vueProgramme, salons: vueSalons, adresses: vueAdresses,
  notes: vueNotes, presentation: vuePresentation, plus: vuePlus, contacts: vueContacts, pratique: vuePratique, phrases: vuePhrases, convertisseur: vueConvertisseur
};
const SOUS_PLUS = ['contacts', 'pratique', 'phrases', 'convertisseur', 'presentation'];

function route(garderDefilement) {
  if (!D) return;
  const [nom, cible] = (location.hash.replace('#', '') || 'aujourdhui').split('/');
  const vue = VUES[nom] ? nom : 'aujourdhui';
  cibleRoute = cible;
  if (vue === 'adresses' && cible) filtreAdresse = 'Tout';
  if (vue === 'notes' && cible) { filtreNotes = cible; salonChoisi = { salon: cible, jour: ymd(maintenant(), TZ_CN) }; }
  const y = window.scrollY;
  $('#vue').innerHTML = VUES[vue]();
  const actif = SOUS_PLUS.includes(vue) ? 'plus' : vue;
  document.querySelectorAll('.onglets a').forEach((a) => a.classList.toggle('actif', a.dataset.onglet === actif));
  if (garderDefilement) window.scrollTo(0, y);
  else if (cible) {
    const el = document.getElementById('a-' + cible);
    if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); el.classList.add('flash'); }
    else window.scrollTo(0, 0);
  } else window.scrollTo(0, 0);
  hydraterPhotos();
}

/* ---------- Voix chinoise 🔊 ----------
   Utilise la synthèse vocale du téléphone (aucune requête réseau depuis la page).
   iPhone : voix chinoise installée d'origine. Android : installer la voix chinoise
   hors ligne dans les réglages de synthèse vocale avant le départ. */
function voixPossible() { return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
function voixChinoises() {
  return speechSynthesis.getVoices().filter((v) => /^(zh|cmn)([-_](CN|Hans))?/i.test(v.lang) && !/(TW|HK)$/i.test(v.lang));
}
function boutonParler(texte, libelle, langue) {
  if (!voixPossible() || !texte) return '';
  return '<button class="btn parler" data-parler="' + esc(texte) + '"' + (langue ? ' data-parler-langue="' + esc(langue) + '"' : '') +
    ' aria-label="Écouter">' + (libelle || '🔊') + '</button>';
}
function parler(texte, langue) {
  if (!voixPossible() || !texte) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = langue || 'zh-CN';
  u.rate = 0.85;
  if (!/^zh/i.test(u.lang)) { speechSynthesis.speak(u); return; }
  const voix = voixChinoises();
  const locale = voix.find((v) => v.localService);
  if (locale || voix[0]) u.voice = locale || voix[0];
  if (!voix.length) avertir('Aucune voix chinoise trouvée sur ce téléphone : voir Pratique › Voix chinoise.');
  else if (!locale && !navigator.onLine) avertir('La voix chinoise de ce téléphone exige Internet : installer la voix hors ligne (voir Pratique).');
  u.onerror = (ev) => { if (ev.error !== 'canceled' && ev.error !== 'interrupted') avertir('Lecture impossible : voir Pratique › Voix chinoise.'); };
  speechSynthesis.speak(u);
}
let minuterieAvis = null;
function avertir(msg) {
  const el = $('#avis');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(minuterieAvis);
  minuterieAvis = setTimeout(() => { el.hidden = true; }, 5000);
}
if (voixPossible()) speechSynthesis.getVoices(); // lance le chargement de la liste des voix

/* ---------- Plein écran : chauffeur et phrases ---------- */
let verrouEcran = null;
function taillePolice(texte, latin) {
  if (latin) {
    const m = (texte || '').length;
    return m <= 60 ? '9vw' : m <= 300 ? '6.5vw' : '5vw';
  }
  const n = [...(texte || '')].length;
  if (n > 150) return '6vw';
  if (n > 60) return '7vw';
  if (n <= 4) return '22vw';
  if (n <= 10) return '16vw';
  if (n <= 24) return '12vw';
  if (n <= 40) return '10vw';
  return '8vw';
}
// options : { latin: texte en alphabet latin, langue: langue de lecture 🔊 }
function ouvrirPlein(zh, sous, petitHtml, options) {
  const o = options || {};
  $('#plein-parler').dataset.parler = zh;
  $('#plein-parler').dataset.parlerLangue = o.langue || 'zh-CN';
  $('#plein-parler').hidden = !voixPossible();
  $('#plein-zh').textContent = zh;
  $('#plein-zh').style.fontSize = taillePolice(zh, o.latin);
  $('#plein-zh').classList.toggle('latin', !!o.latin);
  $('#plein').classList.toggle('long', [...(zh || '')].length > 60);
  $('#plein-sous').textContent = sous || '';
  $('#plein-petit').innerHTML = petitHtml || '';
  $('#plein').hidden = false;
  document.body.style.overflow = 'hidden';
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then((v) => { verrouEcran = v; }).catch(() => {});
}
function fermerPlein() {
  if (voixPossible()) speechSynthesis.cancel();
  $('#plein').hidden = true;
  document.body.style.overflow = '';
  if (verrouEcran) { verrouEcran.release().catch(() => {}); verrouEcran = null; }
}

/* ---------- Événements ---------- */
document.addEventListener('click', (e) => {
  const pa = e.target.closest('[data-parler]');
  if (pa) { parler(pa.dataset.parler, pa.dataset.parlerLangue); return; }
  const ch = e.target.closest('[data-chauffeur]');
  if (ch) {
    const a = adresse(ch.dataset.chauffeur);
    if (!a) return;
    const zh = [a.nomZh, a.adresseZh].filter(Boolean).join('\n');
    let petit = t(a.nom);
    if (telValide(a.telephone)) petit += '<br>☎ <a href="tel:' + esc(numeroTel(a.telephone)) + '">' + esc(a.telephone) + '</a>';
    ouvrirPlein(zh || a.nom, '请带我去这个地址', petit);
    return;
  }
  const pr = e.target.closest('[data-presentation]');
  if (pr) {
    const v = ((D.presentation || {}).versions || [])[+pr.dataset.presentation];
    if (!v) return;
    if (pr.dataset.langue === 'en') ouvrirPlein(v.en, '', '', { latin: true, langue: 'en-GB' });
    else ouvrirPlein(v.zh, '', '');
    return;
  }
  const ph = e.target.closest('[data-phrase]');
  if (ph) {
    const p = D.phrases[+ph.dataset.phrase];
    if (p) ouvrirPlein(p.zh, p.pinyin, t(p.fr));
    return;
  }
  const f = e.target.closest('[data-filtre]');
  if (f) { filtreAdresse = f.dataset.filtre; route(true); return; }
  if (clicNotes(e)) return;
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'note-saisie') ecrire('note-brouillon', e.target.value);
  if (e.target.id === 'phrases-recherche') { recherchePhrases = e.target.value; majResultatsPhrases(); }
  if (e.target.id === 'notes-recherche') { rechercheNotes = e.target.value; majListeNotes(); }
  if (e.target.id === 'eur' || e.target.id === 'cny') {
    const taux = +D.taux.eurCny;
    const n = nombre(e.target.value);
    const autre = e.target.id === 'eur' ? $('#cny') : $('#eur');
    autre.value = n == null ? '' : fmt(e.target.id === 'eur' ? n * taux : n / taux);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.check) ecrire(e.target.dataset.check, e.target.checked ? '1' : '');
  if (e.target.id === 'note-salon') salonChoisi = { salon: e.target.value, jour: ymd(maintenant(), TZ_CN) };
});
$('#plein-fermer').addEventListener('click', fermerPlein);
window.addEventListener('hashchange', () => { fermerPlein(); $('#visionneuse').hidden = true; route(false); });
window.addEventListener('online', majEtat);
window.addEventListener('offline', majEtat);

// Horloges et créneau en cours rafraîchis toutes les 30 s sur l'écran d'accueil
setInterval(() => {
  const nom = location.hash.replace('#', '') || 'aujourdhui';
  if (D && nom === 'aujourdhui' && $('#plein').hidden) route(true);
  majEtat();
}, 30000);

// Au retour sur l'appli : recharger le contenu (il a pu changer)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  charger().then((ok) => { if (ok && !document.activeElement.matches('textarea, input')) route(true); });
});

/* ---------- Service worker : hors ligne + mises à jour ---------- */
if ('serviceWorker' in navigator) {
  let majDemandee = false;
  navigator.serviceWorker.ready.then((reg) => { if (reg.active) reg.active.postMessage('completer'); }).catch(() => {});
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const proposer = () => {
      const b = $('#maj');
      b.hidden = false;
      b.onclick = () => { majDemandee = true; if (reg.waiting) reg.waiting.postMessage('activer'); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) proposer();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) proposer();
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (majDemandee) location.reload();
  });
}

/* ---------- Démarrage ---------- */
charger().then((ok) => { if (ok) route(false); });
