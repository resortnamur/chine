'use strict';

/* ============================================================
   Mission Chine 2026 — tout le contenu vient de data.json.
   Ce fichier n'a pas à être modifié pour changer le voyage.
   ============================================================ */

const TZ_CN = 'Asia/Shanghai';
const TZ_BE = 'Europe/Brussels';
let D = null;          // contenu de data.json
let filtreAdresse = 'Tout';
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
  return String(s || '').replace(/\[(À COMPLÉTER|à vérifier)\]/gi, '').trim();
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
    const m = minutes(maintenant(), TZ_CN);
    cr.forEach((c, i) => {
      const deb = enMinutes(c.heure);
      const next = cr[i + 1] ? enMinutes(cr[i + 1].heure) : null;
      const fin = enMinutes(c.fin) != null ? enMinutes(c.fin) : (next != null ? next : deb + 60);
      if (deb == null) return;
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

function enteteJour(jour, index) {
  const d = midiPekin(jour.date);
  let h = '<div class="jour-date">Jour ' + (index + 1) + ' · ' + esc(dateLongue(d, TZ_CN)) + '</div>';
  h += '<div class="meta">' + t(jour.titre || '') + (jour.ville ? ' — ' + t(jour.ville) : '') + '</div>';
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
  const index = jours.findIndex((j) => j.date === jourCN);

  let h = '<div class="horloges">' +
    '<div class="horloge"><div class="lieu">🇨🇳 Pékin</div><div class="heure">' + hm(now, TZ_CN) + '</div><div class="date">' + esc(dateCourte(now, TZ_CN)) + '</div></div>' +
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
  } else if (v.debut && jourCN < v.debut) {
    const n = joursEntre(jourCN, v.debut);
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
  h += '<a class="btn urgence" href="#contacts"><span class="ico">☎</span>Urgences</a>' +
    '<a class="btn" href="#phrases"><span class="ico">文</span>Phrases utiles</a>' +
    '<a class="btn" href="#convertisseur"><span class="ico">¥</span>€ ↔ ¥</a>' +
    '<a class="btn" href="#programme"><span class="ico">▦</span>Toute la semaine</a>' +
    '</div>';
  if (v.note) h += '<p class="meta">' + t(v.note) + '</p>';
  return h;
}

/* ---------- Vue : Programme ---------- */
function vueProgramme() {
  const jourCN = ymd(maintenant(), TZ_CN);
  const jours = D.jours || [];
  if (!jours.length) return '<p class="vide">Aucun jour dans data.json.</p>';
  return '<h2>Programme</h2>' + jours.map((j, i) => {
    const auj = j.date === jourCN;
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
    const cle = 'notes:' + (s.id || s.nom);
    h += '<div class="section-titre">Mes notes (sur ce téléphone uniquement)</div>' +
      '<textarea data-notes="' + esc(cle) + '" placeholder="Notes de visite…">' + esc(lire(cle, '')) + '</textarea>' +
      '<div class="boutons"><button class="btn" data-copier="' + esc(cle) + '">Copier mes notes</button></div>';
    return h + '</div>';
  }).join('');
}

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
function vuePhrases() {
  const groupes = {};
  (D.phrases || []).forEach((p, i) => { (groupes[p.categorie || 'Divers'] = groupes[p.categorie || 'Divers'] || []).push([p, i]); });
  let h = '<h2>Phrases utiles</h2><p class="meta">Touchez une phrase pour l\'afficher en grand' + (voixPossible() ? ', ou 🔊 pour l\'entendre' : '') + '.</p>';
  Object.keys(groupes).forEach((g) => {
    h += '<div class="section-titre">' + esc(g) + '</div><div class="carte">' + groupes[g].map(([p, i]) =>
      '<div class="phrase-ligne"><button class="phrase" data-phrase="' + i + '"><div class="fr">' + t(p.fr) + '</div>' +
      '<div class="zh" lang="zh-CN">' + esc(p.zh) + '</div><div class="py">' + esc(p.pinyin) + '</div></button>' +
      boutonParler(p.zh) + '</div>').join('') + '</div>';
  });
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
  plus: vuePlus, contacts: vueContacts, pratique: vuePratique, phrases: vuePhrases, convertisseur: vueConvertisseur
};
const SOUS_PLUS = ['contacts', 'pratique', 'phrases', 'convertisseur'];

function route(garderDefilement) {
  if (!D) return;
  const [nom, cible] = (location.hash.replace('#', '') || 'aujourdhui').split('/');
  const vue = VUES[nom] ? nom : 'aujourdhui';
  if (vue === 'adresses' && cible) filtreAdresse = 'Tout';
  const y = window.scrollY;
  $('#vue').innerHTML = VUES[vue]();
  const actif = SOUS_PLUS.includes(vue) ? 'plus' : vue;
  document.querySelectorAll('.onglets a').forEach((a) => a.classList.toggle('actif', a.dataset.onglet === actif));
  if (garderDefilement) window.scrollTo(0, y);
  else if (cible) {
    const el = document.getElementById('a-' + cible);
    if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); el.classList.add('flash'); }
  } else window.scrollTo(0, 0);
}

/* ---------- Voix chinoise 🔊 ----------
   Utilise la synthèse vocale du téléphone (aucune requête réseau depuis la page).
   iPhone : voix chinoise installée d'origine. Android : installer la voix chinoise
   hors ligne dans les réglages de synthèse vocale avant le départ. */
function voixPossible() { return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
function voixChinoises() {
  return speechSynthesis.getVoices().filter((v) => /^(zh|cmn)([-_](CN|Hans))?/i.test(v.lang) && !/(TW|HK)$/i.test(v.lang));
}
function boutonParler(texte, libelle) {
  if (!voixPossible() || !texte) return '';
  return '<button class="btn parler" data-parler="' + esc(texte) + '" aria-label="Écouter en chinois">' + (libelle || '🔊') + '</button>';
}
function parler(texte) {
  if (!voixPossible() || !texte) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = 'zh-CN';
  u.rate = 0.85;
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
function taillePolice(texte) {
  const n = [...(texte || '')].length;
  if (n <= 4) return '22vw';
  if (n <= 10) return '16vw';
  if (n <= 24) return '12vw';
  if (n <= 40) return '10vw';
  return '8vw';
}
function ouvrirPlein(zh, sous, petitHtml) {
  $('#plein-parler').dataset.parler = zh;
  $('#plein-parler').hidden = !voixPossible();
  $('#plein-zh').textContent = zh;
  $('#plein-zh').style.fontSize = taillePolice(zh);
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
  if (pa) { parler(pa.dataset.parler); return; }
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
  const ph = e.target.closest('[data-phrase]');
  if (ph) {
    const p = D.phrases[+ph.dataset.phrase];
    if (p) ouvrirPlein(p.zh, p.pinyin, t(p.fr));
    return;
  }
  const f = e.target.closest('[data-filtre]');
  if (f) { filtreAdresse = f.dataset.filtre; route(true); return; }
  const cp = e.target.closest('[data-copier]');
  if (cp) {
    const txt = lire(cp.dataset.copier, '');
    const ok = () => { cp.textContent = 'Copié ✓'; setTimeout(() => { cp.textContent = 'Copier mes notes'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok).catch(() => {});
    return;
  }
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.notes) ecrire(e.target.dataset.notes, e.target.value);
  if (e.target.id === 'eur' || e.target.id === 'cny') {
    const taux = +D.taux.eurCny;
    const n = nombre(e.target.value);
    const autre = e.target.id === 'eur' ? $('#cny') : $('#eur');
    autre.value = n == null ? '' : fmt(e.target.id === 'eur' ? n * taux : n / taux);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.check) ecrire(e.target.dataset.check, e.target.checked ? '1' : '');
});
$('#plein-fermer').addEventListener('click', fermerPlein);
window.addEventListener('hashchange', () => { fermerPlein(); route(false); });
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
