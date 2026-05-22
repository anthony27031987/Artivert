# 🌿 ARTIVERT - Application de Gestion Intégrée

**Application de gestion complète pour entreprise de paysagisme** : pointage, géolocalisation, chantiers, paie et reporting.

---

## ✨ Fonctionnalités principales

- ✅ **Pointage intelligent** : one-click avec GPS automatique
- ✅ **Géolocalisation temps réel** : suivi des équipes sur carte
- ✅ **Gestion des chantiers** : planification et affectation drag & drop
- ✅ **Centralisation RH & Paie** : calcul automatique des heures
- ✅ **Tableau de bord & Reporting** : productivité et rentabilité
- ✅ **Communication interne** : messagerie et annonces
- ✅ **Sécurité RGPD** : conformité légale garantie
- ✅ **100% Français** : interface entièrement en français
- ✅ **Mobile-first** : smartphone et web

---

## 🚀 Stack technologique

### Frontend
- **React 18** + TypeScript
- **Tailwind CSS** pour le design responsive
- **Leaflet** pour les cartes géographiques
- **React Hook Form** pour les formulaires
- **Recharts** pour les graphiques

### Backend
- **Node.js + Express**
- **PostgreSQL** pour la base de données
- **JWT** pour l'authentification sécurisée
- **Socket.io** pour le temps réel
- **Nodemailer** pour les notifications

### Déploiement
- **Docker** & **Docker Compose** pour la conteneurisation

---

## 📁 Structure du projet

```
Artivert/
├── frontend/                 # Application React Vite
│   ├── public/
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── pages/           # Pages de l'application
│   │   ├── services/        # Services API
│   │   ├── context/         # Contextes React
│   │   ├── hooks/           # Hooks personnalisés
│   │   ├── styles/          # Styles globaux
│   │   ├── types/           # Types TypeScript
│   │   └── App.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/                  # Serveur Node.js Express
│   ├── src/
│   │   ├── routes/          # Routes API
│   │   ├── controllers/      # Logique métier
│   │   ├── middleware/       # Middlewares
│   │   ├── models/           # Modèles base de données
│   │   ├── utils/            # Utilitaires
│   │   ├── types/            # Types TypeScript
│   │   └── server.ts         # Serveur principal
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── database/                 # Scripts SQL
│   └── init.sql              # Schéma initial
├── docker-compose.yml        # Orchestration Docker
├── .env.example              # Variables d'environnement
└── .gitignore
```

---

## ⚙️ Installation et démarrage

### Prérequis
- Node.js 18+
- Docker & Docker Compose (recommandé)
- Git

### 1️⃣ Cloner le repo
```bash
git clone https://github.com/anthony27031987/Artivert.git
cd Artivert
```

### 2️⃣ Configuration environnement
```bash
cp .env.example .env
# Éditer .env avec vos paramètres
```

### 3️⃣ Démarrage avec Docker (Recommandé)
```bash
docker-compose up -d
```

Accédez à :
- **Frontend** : http://localhost:3000
- **Backend** : http://localhost:5000
- **Database** : localhost:5432

### 4️⃣ Démarrage manuel (sans Docker)

**Backend :**
```bash
cd backend
npm install
npm run dev
```

**Frontend (nouvel onglet) :**
```bash
cd frontend
npm install
npm run dev
```

---

## 👤 Utilisateurs par défaut

| Rôle | Email | Mot de passe |
|---|---|---|
| **Gérant** | gerant@artivert.fr | Artivert123! |
| **Chef d'équipe** | chef@artivert.fr | Chef123! |
| **Salarié** | employe@artivert.fr | Employe123! |

---

## 🔒 Sécurité & RGPD

✅ Authentification JWT sécurisée  
✅ Chiffrement des mots de passe (bcrypt)  
✅ Suppression automatique données géolocalisation après 90j  
✅ Conformité RGPD garantie  
✅ Logs d'audit de tous les accès  
✅ Gestion des rôles et permissions  

---

## 📱 Modules de l'application

### 1. **Pointage**
- One-click pointage arrivée/départ
- Horodatage automatique + GPS
- Alertes oubli de pointage
- Historique modifiable avec audit

### 2. **Géolocalisation Temps Réel**
- Tableau de bord live avec carte
- Historique des trajets
- Temps par site calculé automatiquement
- Activation/désactivation selon horaires (RGPD)

### 3. **Gestion des Chantiers**
- Planning visuel drag & drop
- Affectation équipes par mission
- Notifications automatiques
- Fiche détaillée par chantier

### 4. **RH & Paie**
- Synthèse heures travaillées (par salarié/chantier/semaine)
- Gestion congés et absences
- Calcul automatique paie
- Export compatible logiciels paie
- Bulletins de paie numériques

### 5. **Reporting & Analytics**
- KPIs productivité en temps réel
- Rentabilité par client
- Graphiques et tendances
- Export PDF/Excel

### 6. **Communication**
- Messagerie interne
- Annonces pour équipes
- Notifications push

---

## 📊 Cas d'usage couverts

1. **Lundi matin** : Gérant crée 3 chantiers, assigne équipes → Salariés reçoivent notifications
2. **Sur terrain** : Salarié arrive → pointage 1-click → GPS enregistré
3. **Changement chantier** : Ancien chantier temps stoppé, nouveau démarré auto
4. **Fin de journée** : Oubli pointage = alerte notif
5. **Litige client** : Preuve GPS + pointage irréfutable
6. **Fin de mois** : Export heures pour paie + rapports rentabilité

---

## 🔧 Variables d'environnement

Copier `.env.example` en `.env` et configurer :

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/artivert_db

# JWT
JWT_SECRET=votre_secret_jwt_changerez_en_prod
JWT_EXPIRE=7d

# Backend
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Frontend
REACT_APP_API_URL=http://localhost:5000

# Google Maps
GOOGLE_MAPS_API_KEY=your_api_key_here

# Email (optionnel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

---

## 📖 Documentation complète

- **[Installation détaillée](./docs/INSTALLATION.md)**
- **[API Documentation](./docs/API.md)**
- **[Guide utilisateur](./docs/GUIDE_UTILISATEUR.md)**
- **[Architecture système](./docs/ARCHITECTURE.md)**
- **[Déploiement production](./docs/DEPLOYMENT.md)**

---

## 🤝 Support & Contact

**Email** : support@artivert.fr  
**Téléphone** : +33 X XX XX XX XX  
**Issues** : https://github.com/anthony27031987/Artivert/issues

---

## 📄 Licence

Propriétaire © 2025 Artivert. Tous droits réservés.

---

**Version** : 1.0.0  
**Dernière mise à jour** : Janvier 2025  
**Statut** : 🚀 En développement actif
