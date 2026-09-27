# Mission Chine 2026

Site mobile du voyage, utilisable **sans réseau** une fois ouvert une première fois.
Adresse : https://resortnamur.github.io/chine/

## Modifier le contenu

Tout le contenu est dans **`data.json`**. Aucun autre fichier n'est à toucher.

1. Sur github.com, ouvrir `data.json` et cliquer sur le crayon ✏️.
2. Modifier le texte **entre guillemets**, en gardant les guillemets, les virgules et les accolades.
3. Cliquer sur **Commit changes**. Le site se met à jour en 1 à 2 minutes.

Les téléphones récupèrent le nouveau contenu à la prochaine ouverture avec du réseau.

Repères :
- Les passages `[À COMPLÉTER]` et `[à vérifier]` sont surlignés en jaune sur le site. Il suffit de les supprimer une fois le champ rempli.
- **Heures** : toutes les heures du programme sont en heure de Pékin, au format `"09:30"`. `"fin"` est facultatif.
- **Dates** : au format `"2026-10-20"`. L'écran Aujourd'hui s'appuie sur ces dates.
- **Lieux** : dans le programme et les salons, `"lieu"` reprend l'`"id"` d'une adresse (ex. `"hotel-1"`). `"hotel"` sur un jour indique l'hôtel du soir.
- **Coordonnées** (facultatif) : ajouter `"lat"` et `"lng"` à une adresse, relevées dans Amap, pour un repérage plus précis.
- **Taux de change** : `"taux"` → `"eurCny"`, avec un point décimal (ex. `7.85`).
- **Erreur de syntaxe** (virgule oubliée, par exemple) : le site affiche un message qui indique l'endroit.

⚠️ Le dépôt est public : tout ce qui est dans `data.json` est lisible par qui connaît l'adresse. Le site demande aux moteurs de recherche de ne pas l'indexer.

## Tester en mode avion

1. Ouvrir le site une fois avec du réseau et attendre l'affichage complet.
2. Activer le mode avion.
3. Fermer complètement le navigateur ou l'appli, puis la rouvrir.
4. Le site doit s'afficher, avec la pastille orange **Hors ligne** en haut à droite.

La pastille verte **À jour** signifie que le contenu vient d'être récupéré en ligne.

## Installer sur le téléphone

**iPhone (Safari obligatoire)** : ouvrir l'adresse → bouton Partager (carré avec flèche) → **Sur l'écran d'accueil** → Ajouter.

**Android (Chrome)** : ouvrir l'adresse → menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).

À faire **avant le départ**, avec du réseau.

## Notes

Onglet **Notes** : une note à la fois, tapée ou dictée (🎤 du clavier), enregistrée avec l'heure de Pékin et le salon du moment, que l'on peut changer.
Toutes les notes sont réunies dans une seule liste, avec un filtre par salon et une recherche. Toucher une note pour la modifier ou la supprimer.
Boutons **📷 Photo** et **🖼 Galerie** pour joindre des photos à une note (réduites pour économiser la place). Toucher une vignette pour l'agrandir.
Elles restent **sur le téléphone uniquement** : les exporter chaque soir avec **Tout télécharger (.zip)**, qui contient le texte et toutes les photos, ou **Partager le texte**.
Le texte exporté peut être collé dans Claude pour en faire un compte rendu.
Ne pas changer l'`"id"` d'un salon dans `data.json`, sinon ses notes passent en « Sans salon » à l'export.

## Phrases utiles

Environ 150 phrases, classées par catégories dans `data.json` (`categoriesPhrases` fixe l'ordre et l'icône des catégories, `phrases` la liste).
L'écran s'ouvre sur un sommaire de catégories et propose une recherche en français ou en pinyin (sans les accents).
Pour ajouter une phrase : copier une ligne existante dans `phrases` et changer `categorie`, `fr`, `zh` et `pinyin`.

## Nous présenter

Texte de présentation de la délégation, en version courte et complète, en français, anglais et chinois : rubrique `presentation` de `data.json`.
Accès : tuile en tête des Phrases utiles et bouton sur l'écran Aujourd'hui. « Montrer en chinois » ou « Show in English » l'affiche en plein écran ; 🔊 le lit en chinois.
Si le texte français change, faire refaire la traduction chinoise et anglaise, puis la faire relire par un locuteur chinois.

## Bouton 🔊

Prononce les phrases et les adresses en chinois avec la voix du téléphone, sans Internet.
Sur Android, installer la voix chinoise hors ligne avant le départ (détail dans l'onglet Pratique du site).

## Mises à jour du code

Si le code change (pas le contenu), un bandeau jaune « Nouvelle version disponible » apparaît : le toucher.
Pour la personne qui modifie le code : augmenter `VERSION` dans `sw.js` à chaque modification.

## Simuler une date

Pour vérifier l'écran Aujourd'hui avant le voyage, ajouter `?t=` à l'adresse, avec une heure en temps universel :
`https://resortnamur.github.io/chine/?t=2026-10-20T03:30:00Z` (= 11 h 30 à Pékin).
