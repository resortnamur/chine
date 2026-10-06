# App « Mission Chine 2026 » — notes pour Claude

PWA hors ligne du voyage de la délégation Gaming1 Retail (groupe B — Circus) en Chine, 10-17 octobre 2026.
En ligne : https://resortnamur.github.io/chine/ — dépôt public `resortnamur/chine`, branche `main`, publiée par GitHub Pages (push = mise en ligne en ~1 min).

## Règles
- HTML/CSS/JS simples, aucun framework, aucune étape de compilation, **aucune ressource externe** (CSP dans `index.html`).
- **Tout le contenu est dans `data.json`.** Le code (`app.js`) ne contient aucune donnée du voyage.
- **Modifier le code ⇒ incrémenter `VERSION` dans `sw.js`** (sinon les téléphones gardent l'ancien code). Modifier seulement `data.json` ne demande rien de plus.
- Garder la copie `..\Chine-Projet-Claude\data.json` identique à `data.json` (projet claude.ai « Chine » de l'utilisateur).
- Site public : ne jamais y publier de code d'accès, de mot de passe ni de référence de réservation (refusé par le contrôle de sécurité). Téléphones et noms de la délégation : publiés avec l'accord de l'utilisateur.
- Sources : l'appli des organisateurs **Expo Trip** (app.expotrip.be, accès par code saisi par l'utilisateur) et le **calendrier Outlook** priment sur le groupe WhatsApp ; une info absente ou plus ancienne est marquée `[à vérifier]`.
- Ne jamais changer l'`id` d'un salon (les notes du téléphone y sont rattachées).

## Structure de `data.json`
`voyage`, `taux`, `jours[]` (date, `fuseau` facultatif — le 10/10 est en heure belge —, `hotel`, `dossier[]`, `creneaux[]` : heure en heure de Chine, `fin`, `titre`, `lieu` = id d'adresse, `salon` = id de salon, `transport`, `note`), `salons[]`, `adresses[]` (nom FR/EN/ZH, adresse FR/EN/ZH, téléphone, note), `contacts[]` (groupe, nom, rôle, téléphone), `pratique[]` (`titre`, `points[]`, `etapes: true` = liste numérotée), `checklist[]`, `dossier[]` (chapitres : `sections[]` avec `paragraphes`, `chiffres`, `points`, plus `incertitudes`, `sources`), `presentation` (`versions[]` de texte + `diaporama.diapos[]` : soit `{photo, fr, en, zh, lieu?, credit?, points?}`, soit `{chapitre: true, fr, en, zh, sous?, chiffres[]}`), `categoriesPhrases`, `phrases[]`.
Marqueurs affichés en jaune : `[À COMPLÉTER]`, `[à vérifier]`.

Écriture conseillée de `data.json` (lisible) : objets de moins de 150 caractères sur une ligne, sinon indentation de 2 espaces ; `json.dumps(..., ensure_ascii=False)`.

## Tester
- Serveur local : configuration « chine » (port 8790) dans `Desktop\Test Claude\.claude\launch.json`.
- Simuler une date : `?t=2026-10-13T08:00:00Z` (heure UTC) dans l'adresse.
- Tester hors ligne : charger une fois, arrêter le serveur, recharger.
- Vérifier qu'aucune requête ne part vers un autre domaine.

## Écrans
Aujourd'hui · Programme · Salons · Notes (photos, export .zip) · Adresses (« Montrer au chauffeur », 🔊) · Plus : Contacts, Phrases (145, par catégories), Pratique, Convertisseur, Nous présenter (diaporama « Notre groupe en images » : 67 diapositives — 45 photos du groupe (dont Circus Sport et Odd's Sportsbar), 11 photos de villes, 2 cartes —, légendes ZH + EN + FR, plein écran, glisser ; puis le texte FR/EN/ZH), Dossier des lieux (10 chapitres, dont « Acheter un robot »).

## Photos du diaporama
- Dossier `photos/` (JPEG 1280 px, qualité 70, ≈ 5 Mo au total). Sources : `Desktop\Divers\IMAGES\Photos CCRN` (Namur) et sites officiels du groupe (circuscasinoresort.com, casinodespa.be, circus-casino-places.be, circus-sport-places.be, odds.be, circuscasino.fr, casinodavos.ch), téléchargées avec l'accord de l'utilisateur le 05/10/2026. Jamais d'image générée par IA.
- Photos de villes (`photos/ville-*.jpg`) : Wikimedia Commons, licences libres ; auteur et licence obligatoires dans le champ `credit` de la diapositive.
- Cartes (`photos/carte-groupe.svg`, `photos/carte-belgique.svg`) : générées par `outils/cartes.py` (fond Natural Earth, coordonnées officielles des 27 salles Circus de circus-casino-places.be/ou-jouer). Aucun nom de lieu écrit dans le SVG (illisible sur téléphone) : pastilles numérotées, et la liste numéro → nom (`points` de la diapositive, copiée de `outils/points.json`) s'affiche en texte HTML sous la carte (classe `carte-geo`). Pas de liseré blanc autour des textes du SVG.
- Le service worker les met dans un cache à part (`photos-chine`) conservé entre versions ; la liste vient de `data.json`. Ajouter une photo = la déposer dans `photos/` + la citer dans `data.json` (pas besoin de changer `VERSION`). **Remplacer** une photo existante : changer son adresse dans `data.json` (`?v=2`), sinon les téléphones gardent l'ancienne.
- Vocabulaire chinois acté : casino = 娱乐场 (jamais 赌场), machine à sous = 电子游戏机, salle de jeux = 游戏厅. Aucune mention du jeu en ligne (sensible en Chine).
