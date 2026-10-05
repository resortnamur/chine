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
`voyage`, `taux`, `jours[]` (date, `fuseau` facultatif — le 10/10 est en heure belge —, `hotel`, `dossier[]`, `creneaux[]` : heure en heure de Chine, `fin`, `titre`, `lieu` = id d'adresse, `salon` = id de salon, `transport`, `note`), `salons[]`, `adresses[]` (nom FR/EN/ZH, adresse FR/EN/ZH, téléphone, note), `contacts[]` (groupe, nom, rôle, téléphone), `pratique[]` (`titre`, `points[]`, `etapes: true` = liste numérotée), `checklist[]`, `dossier[]` (chapitres : `sections[]` avec `paragraphes`, `chiffres`, `points`, plus `incertitudes`, `sources`), `presentation`, `categoriesPhrases`, `phrases[]`.
Marqueurs affichés en jaune : `[À COMPLÉTER]`, `[à vérifier]`.

Écriture conseillée de `data.json` (lisible) : objets de moins de 150 caractères sur une ligne, sinon indentation de 2 espaces ; `json.dumps(..., ensure_ascii=False)`.

## Tester
- Serveur local : configuration « chine » (port 8790) dans `Desktop\Test Claude\.claude\launch.json`.
- Simuler une date : `?t=2026-10-13T08:00:00Z` (heure UTC) dans l'adresse.
- Tester hors ligne : charger une fois, arrêter le serveur, recharger.
- Vérifier qu'aucune requête ne part vers un autre domaine.

## Écrans
Aujourd'hui · Programme · Salons · Notes (photos, export .zip) · Adresses (« Montrer au chauffeur », 🔊) · Plus : Contacts, Phrases (145, par catégories), Pratique, Convertisseur, Nous présenter (FR/EN/ZH), Dossier des lieux (10 chapitres, dont « Acheter un robot »).
