# Mates.

Trouve des partenaires de sport de ton niveau, rejoins des matchs ouverts et réserve un terrain.
Reconstruction avec un vrai backend du prototype statique (projet UE04 – Analyse Informatique, HELMo).

## Stack

- **API** : Node.js ≥ 22.13 + Express 4
- **Base de données** : SQLite via le module intégré `node:sqlite` (aucune compilation native)
- **Front** : HTML + Tailwind CSS (compilé, plus de CDN) + JavaScript vanilla, routeur par hash
- **Auth** : email + mot de passe (bcrypt), session en cookie `HttpOnly` / `SameSite=Lax`

## Lancer en local

```bash
npm install
npm run build      # compile public/css/app.css
npm start          # http://localhost:3000
npm test           # tests de l'API (node:test)
```

Au premier démarrage, la base (`data/mates.db`) est créée et remplie avec les 14 sports,
10 clubs / 119 terrains, les 12 mates de démonstration et 3 matchs ouverts.
`npm run seed` remet la base à zéro.

**Compte démo** : `alex.deville@mates.test`, mot de passe `demo-mates-2026`
(modifiable via `DEMO_PASSWORD` avant le premier démarrage). Les 12 autres profils n'ont pas de mot de passe.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `DATABASE_PATH` | `data/mates.db` | Fichier SQLite (doit être sur un disque persistant en production) |
| `NODE_ENV` | — | `production` active `trust proxy` (cookies `Secure` derrière Render/Railway) |
| `DEMO_PASSWORD` | `demo-mates-2026` | Mot de passe du compte démo (au seed) |
| `PUBLIC_DEMO` | `true` | `false` masque le bouton « compte de démonstration » |

## API

Toutes les routes sont sous `/api`. Les requêtes qui modifient des données doivent envoyer l'en-tête
`X-Mates: 1` (protection CSRF).

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/meta`, `/stats`, `/health` | | Vocabulaire (niveaux, créneaux…), compteurs |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | | Comptes et sessions |
| GET | `/auth/me` | | Utilisateur courant ou `null` |
| GET | `/sports`, `/sports/:id` | | Catalogue (compteurs calculés) |
| GET | `/mates?sport=&level=&city=` | | Recherche (le niveau s'applique au sport choisi) |
| GET | `/mates/:id` (`me` = moi) | | Profil public + disponibilités |
| PUT | `/me` | ✔ | Mise à jour du profil, sports et disponibilités |
| GET | `/cities/nearest?lat=&lng=` | | Ville la plus proche (bouton GPS) |
| GET | `/venues?sport=` | | Clubs et terrains pour un sport |
| GET | `/courts/:id/slots?date=&duration=` | | Créneaux libres d'un terrain |
| GET | `/matches?sport=` | | Matchs ouverts à venir |
| POST | `/matches` | ✔ | Réserve le terrain et publie un match (refuse les chevauchements) |
| POST | `/matches/:id/join`, `/matches/:id/leave` | ✔ | Rejoindre / se désister (complet, doublon, déjà commencé → 409) |
| DELETE | `/matches/:id` | ✔ | Annulation par l'organisateur |
| GET / POST | `/invitations` | ✔ | Invitations reçues / envoyées, en envoyer une |
| POST | `/invitations/:id/respond` | ✔ | Accepter / refuser |

## Hors périmètre (pour l'instant)

- Paiement en ligne (le paiement se fait sur place au club)
- Connexion Google et mot de passe oublié (nécessitent un fournisseur OAuth / un service d'emails)
- Upload de photo (on renseigne une URL https)
- Notation fair-play et fiabilité calculées (valeurs de démo pour les profils seedés)
