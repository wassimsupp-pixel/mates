'use strict';
// Seed content carried over from the original static prototype (js/data.js).

const INITIAL_SPORTS = [
  {
    id: "padel",
    name: "Padel",
    icon: "🎾",
    slug: "padel",
    playersPerMatch: "4 joueurs (2 vs 2)",
    duration: "60 - 90 min",
    category: "Raquette",
    slogan: "Le sport de raquette le plus convivial. 4 joueurs, du rythme et du pur plaisir.",
    description: "Mélange détonant de tennis et de squash avec parois vitrées. Rapide à prendre en main, ultra convivial et parfait pour se dépenser entre potes.",
    venuesCount: 18,
    activeMatesCount: 420,
    popularIn: "Liège, Bruxelles, Namur, Wavre",
    accentColor: "#bef264"
  },
  {
    id: "football",
    name: "Football",
    icon: "⚽",
    slug: "football",
    playersPerMatch: "10 joueurs (Five) ou 14 (Seven)",
    duration: "60 min",
    category: "Collectif",
    slogan: "Trouve ton 5e ou rejoins une team sur terrain synthétique indoor ou outdoor",
    description: "Foot à 5 (UrbanSoccer / Five) ou foot classique. Ne repousse plus jamais un match parce qu'il manque un gardien ou un attaquant.",
    venuesCount: 24,
    activeMatesCount: 780,
    popularIn: "Liège, Bruxelles, Charleroi, Liège-Angleur",
    accentColor: "#22c55e"
  },
  {
    id: "tennis",
    name: "Tennis",
    icon: "🎾",
    slug: "tennis",
    playersPerMatch: "2 ou 4 joueurs",
    duration: "60 - 90 min",
    category: "Raquette",
    slogan: "Simples ou doubles, trouve un joueur de ton classement sur terre ou résine",
    description: "Sur surface rapide, terre battue ou synthétique. Affronte des partenaires réguliers calibrés exactement sur ton niveau technique.",
    venuesCount: 15,
    activeMatesCount: 310,
    popularIn: "Liège, Sart-Tilman, Louvain-la-Neuve",
    accentColor: "#84cc16"
  },
  {
    id: "basketball",
    name: "Basket-ball",
    icon: "🏀",
    slug: "basketball",
    playersPerMatch: "6 joueurs (3x3) ou 10 (5x5)",
    duration: "45 - 60 min",
    category: "Collectif",
    slogan: "Du playground urbain au parquet en salle, forme ton 3x3 n'importe quel jour",
    description: "Ambiance streetball ou match officiel en salle. Rejoins des pick-up games locaux et enchaîne les paniers sans prise de tête.",
    venuesCount: 12,
    activeMatesCount: 290,
    popularIn: "Liège Centre, Bruxelles, Namur",
    accentColor: "#f97316"
  },
  {
    id: "badminton",
    name: "Badminton",
    icon: "🏸",
    slug: "badminton",
    playersPerMatch: "2 ou 4 joueurs",
    duration: "60 min",
    category: "Raquette",
    slogan: "Le sport le plus rapide du monde pour brûler des calories à toute allure",
    description: "Réflexes éclair, cardio à bloc et amortis millimétrés. Idéal après le boulot ou les cours pour une séance intense et dynamique.",
    venuesCount: 11,
    activeMatesCount: 215,
    popularIn: "Liège, Rocourt, Bruxelles",
    accentColor: "#06b6d4"
  },
  {
    id: "volleyball",
    name: "Volley-ball",
    icon: "🏐",
    slug: "volleyball",
    playersPerMatch: "4 à 12 joueurs",
    duration: "60 - 90 min",
    category: "Collectif",
    slogan: "Salle ou beach-volley, partage de l'énergie et des smashs spectaculaires",
    description: "Pour les adeptes du jeu en équipe, passes précises et contres au filet. Disponible en gymnase couvert ou sur sable l'été.",
    venuesCount: 8,
    activeMatesCount: 165,
    popularIn: "Liège, Bruxelles, Namur",
    accentColor: "#eab308"
  },
  {
    id: "running",
    name: "Running",
    icon: "🏃‍♂️",
    slug: "running",
    playersPerMatch: "Groupes de 2 à 15",
    duration: "45 - 75 min",
    category: "Endurance",
    slogan: "Ne cours plus jamais seul : sorties collectives, fractionné et prépa trail",
    description: "De la simple boucle de 5 km pour reprendre en douceur jusqu'aux sorties longues le dimanche matin le long de la Meuse ou en forêt.",
    venuesCount: 9,
    activeMatesCount: 540,
    popularIn: "Liège (Bords de Meuse), Bruxelles (Bois de la Cambre)",
    accentColor: "#10b981"
  },
  {
    id: "escalade",
    name: "Escalade",
    icon: "🧗",
    slug: "escalade",
    playersPerMatch: "2 joueurs (voie) ou solo / groupe (bloc)",
    duration: "90 - 120 min",
    category: "Agilité",
    slogan: "Trouve ton assureur pour la voie ou partage des sessions bloc stimulantes",
    description: "Salles de bloc ouvertes et murs de cordes. Trouve un assureur de confiance du même gabarit et dépasse tes plafonds de cotation.",
    venuesCount: 7,
    activeMatesCount: 195,
    popularIn: "Liège (Top Rock), Louvain-la-Neuve, Bruxelles",
    accentColor: "#f43f5e"
  },
  {
    id: "squash",
    name: "Squash",
    icon: "🎾",
    slug: "squash",
    playersPerMatch: "2 joueurs",
    duration: "45 min",
    category: "Raquette",
    slogan: "45 minutes non-stop d'intensité pure pour se vider la tête",
    description: "Un court clos, une balle noire et un rythme effréné. Idéal pour ceux qui recherchent une dépense cardio maximale en un temps record.",
    venuesCount: 6,
    activeMatesCount: 140,
    popularIn: "Liège, Bruxelles, Wavre",
    accentColor: "#a855f7"
  },
  {
    id: "pingpong",
    name: "Tennis de table",
    icon: "🏓",
    slug: "pingpong",
    playersPerMatch: "2 ou 4 joueurs",
    duration: "45 - 60 min",
    category: "Précision",
    slogan: "Topspin, slice et batailles de réflexes à la table",
    description: "Que ce soit sur des tables de club ou en extérieur dans un parc au soleil, défie des mates pour des parties fun et disputées.",
    venuesCount: 10,
    activeMatesCount: 180,
    popularIn: "Liège, Namur, Mons",
    accentColor: "#3b82f6"
  },
  {
    id: "rugby",
    name: "Rugby",
    icon: "🏉",
    slug: "rugby",
    playersPerMatch: "10 à 14 joueurs",
    duration: "60 - 80 min",
    category: "Collectif",
    slogan: "Touch rugby, rugby à 7 ou entraînement aux valeurs collectives fortes",
    description: "Sans placage violent pour les sessions loisir (touch rugby) ou entraînement physique complet. Solidarité et 3e mi-temps garanties.",
    venuesCount: 5,
    activeMatesCount: 110,
    popularIn: "Liège, Bruxelles, Ottignies",
    accentColor: "#14b8a6"
  },
  {
    id: "handball",
    name: "Handball",
    icon: "🤾",
    slug: "handball",
    playersPerMatch: "12 à 14 joueurs",
    duration: "60 min",
    category: "Collectif",
    slogan: "Puissance, tactique et roucoulettes dans la zone des 9 mètres",
    description: "Sport collectif spectaculaire nécessitant cohésion et esprit d'équipe. Rejoins des matchs organisés en salle par les clubs partenaires.",
    venuesCount: 6,
    activeMatesCount: 95,
    popularIn: "Liège, Herstal, Visé, Bruxelles",
    accentColor: "#ec4899"
  },
  {
    id: "fitness",
    name: "Fitness & Muscu",
    icon: "🏋️",
    slug: "fitness",
    playersPerMatch: "2 à 4 mates",
    duration: "60 - 90 min",
    category: "Force",
    slogan: "Un binôme pour se motiver à la salle, t'assurer au développé couché et progresser",
    description: "Finis les entraînements en solo où l'on hésite à charger la barre. Trouve un partenaire régulier pour garder le cap et dépasser tes objectifs.",
    venuesCount: 22,
    activeMatesCount: 620,
    popularIn: "Liège, Bruxelles, Namur, Mons",
    accentColor: "#e11d48"
  },
  {
    id: "natation",
    name: "Natation",
    icon: "🏊‍♂️",
    slug: "natation",
    playersPerMatch: "2 à 6 nageurs",
    duration: "45 - 60 min",
    category: "Aquatique",
    slogan: "Longueurs en couloir dédié ou sessions eau libre en groupe",
    description: "Nage sportive, travail technique ou récupération active. Motivez-vous mutuellement pour enchaîner les 50 mètres de bon matin.",
    venuesCount: 8,
    activeMatesCount: 150,
    popularIn: "Liège (Outremeuse, Sart-Tilman), Bruxelles",
    accentColor: "#0284c7"
  }
];

// Matrice des jours et créneaux (pour le wireframe 5 & 6)
const DAYS_OF_WEEK = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const TIME_SLOTS = [
  { id: "matin", label: "Matin (08h - 12h)" },
  { id: "midi", label: "Midi (12h - 14h)" },
  { id: "apresmidi", label: "Après-midi (14h - 18h)" },
  { id: "soir", label: "Soir (18h - 22h)" }
];

// 12 Profils de Mates réalistes avec villes locales (Liège / Belgique / environs)
const INITIAL_MATES = [
  {
    id: "mate-1",
    firstName: "Thomas",
    lastName: "Lambert",
    age: 23,
    city: "Liège",
    distanceKm: 1.8,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    bio: "Étudiant à HELMo, passionné de sports de raquette ! Je joue au padel 2x par semaine et je cherche un 4e joueur pour des parties intenses le soir.",
    sports: [
      { id: "padel", name: "Padel", level: "Confirmé", rating: 4 },
      { id: "football", name: "Football", level: "Intermédiaire", rating: 3 },
      { id: "running", name: "Running", level: "Débutant", rating: 2 }
    ],
    matchesPlayed: 48,
    reliability: "99%",
    fairPlayScore: 4.9,
    // Matrice [jour][créneau]: true si dispo
    availability: {
      "Lundi": ["soir"],
      "Mardi": ["midi", "soir"],
      "Mercredi": ["apresmidi", "soir"],
      "Jeudi": ["soir"],
      "Vendredi": ["soir"],
      "Samedi": ["matin", "apresmidi"],
      "Dimanche": ["matin", "midi"]
    }
  },
  {
    id: "mate-2",
    firstName: "Camille",
    lastName: "Dubois",
    age: 25,
    city: "Bruxelles",
    distanceKm: 8.4,
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    bio: "Grande adepte de tennis et de running. J'adore les sorties rythmées au Bois de la Cambre et les matchs accrochés le week-end.",
    sports: [
      { id: "tennis", name: "Tennis", level: "Expert", rating: 5 },
      { id: "running", name: "Running", level: "Confirmé", rating: 4 },
      { id: "padel", name: "Padel", level: "Intermédiaire", rating: 3 }
    ],
    matchesPlayed: 62,
    reliability: "100%",
    fairPlayScore: 5.0,
    availability: {
      "Lundi": ["matin"],
      "Mardi": ["soir"],
      "Mercredi": ["matin", "soir"],
      "Jeudi": ["midi"],
      "Vendredi": ["soir"],
      "Samedi": ["matin", "midi", "apresmidi"],
      "Dimanche": ["matin", "soir"]
    }
  },
  {
    id: "mate-3",
    firstName: "Julien",
    lastName: "Renard",
    age: 27,
    city: "Liège",
    distanceKm: 2.3,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    bio: "Gardien ou joueur de champ en Foot Five. Toujours chaud pour un match le mardi ou jeudi soir à Angleur ou Rocourt.",
    sports: [
      { id: "football", name: "Football", level: "Confirmé", rating: 4 },
      { id: "badminton", name: "Badminton", level: "Intermédiaire", rating: 3 },
      { id: "fitness", name: "Fitness & Muscu", level: "Confirmé", rating: 4 }
    ],
    matchesPlayed: 74,
    reliability: "98%",
    fairPlayScore: 4.8,
    availability: {
      "Lundi": ["soir"],
      "Mardi": ["soir"],
      "Mercredi": ["soir"],
      "Jeudi": ["soir"],
      "Vendredi": ["midi", "soir"],
      "Samedi": ["apresmidi", "soir"],
      "Dimanche": ["soir"]
    }
  },
  {
    id: "mate-4",
    firstName: "Sarah",
    lastName: "Vandamme",
    age: 22,
    city: "Namur",
    distanceKm: 14.0,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    bio: "Grimpeuse passionnée de bloc et falaise. En recherche d'un mate motivé pour progresser dans le 6b/6c et partager de bonnes sessions.",
    sports: [
      { id: "escalade", name: "Escalade", level: "Confirmé", rating: 4 },
      { id: "natation", name: "Natation", level: "Intermédiaire", rating: 3 },
      { id: "running", name: "Running", level: "Intermédiaire", rating: 3 }
    ],
    matchesPlayed: 39,
    reliability: "100%",
    fairPlayScore: 4.9,
    availability: {
      "Lundi": ["apresmidi"],
      "Mardi": ["soir"],
      "Mercredi": ["midi", "soir"],
      "Jeudi": ["soir"],
      "Vendredi": ["apresmidi", "soir"],
      "Samedi": ["matin", "apresmidi", "soir"],
      "Dimanche": ["apresmidi"]
    }
  },
  {
    id: "mate-5",
    firstName: "Maxime",
    lastName: "Clément",
    age: 29,
    city: "Liège",
    distanceKm: 3.1,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    bio: "Joueur de basket 3x3 et squash. Ambiance dynamique, zéro prise de tête, que du beau jeu et de l'énergie à revendre.",
    sports: [
      { id: "basketball", name: "Basket-ball", level: "Expert", rating: 5 },
      { id: "squash", name: "Squash", level: "Confirmé", rating: 4 },
      { id: "padel", name: "Padel", level: "Débutant", rating: 2 }
    ],
    matchesPlayed: 53,
    reliability: "96%",
    fairPlayScore: 4.9,
    availability: {
      "Lundi": ["midi", "soir"],
      "Mardi": ["matin"],
      "Mercredi": ["soir"],
      "Jeudi": ["midi", "soir"],
      "Vendredi": ["soir"],
      "Samedi": ["apresmidi"],
      "Dimanche": ["matin", "apresmidi"]
    }
  },
  {
    id: "mate-6",
    firstName: "Elena",
    lastName: "Moreau",
    age: 24,
    city: "Bruxelles",
    distanceKm: 6.7,
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80",
    bio: "Padel addict ! Niveau 4 sur Playtomic. Je cherche des partenaires pour des matchs réguliers en semaine sur Bruxelles ou Brabant Wallon.",
    sports: [
      { id: "padel", name: "Padel", level: "Expert", rating: 5 },
      { id: "tennis", name: "Tennis", level: "Confirmé", rating: 4 },
      { id: "fitness", name: "Fitness & Muscu", level: "Intermédiaire", rating: 3 }
    ],
    matchesPlayed: 88,
    reliability: "100%",
    fairPlayScore: 5.0,
    availability: {
      "Lundi": ["soir"],
      "Mardi": ["soir"],
      "Mercredi": ["soir"],
      "Jeudi": ["soir"],
      "Vendredi": ["midi", "soir"],
      "Samedi": ["matin", "midi"],
      "Dimanche": ["soir"]
    }
  },
  {
    id: "mate-7",
    firstName: "Antoine",
    lastName: "Dupont",
    age: 26,
    city: "Charleroi",
    distanceKm: 18.2,
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80",
    bio: "Volleyeur de club en recherche de tournois et matchs amicaux le weekend. Chaud aussi pour du beach-volley dès les premiers rayons de soleil.",
    sports: [
      { id: "volleyball", name: "Volley-ball", level: "Confirmé", rating: 4 },
      { id: "rugby", name: "Rugby", level: "Intermédiaire", rating: 3 },
      { id: "fitness", name: "Fitness & Muscu", level: "Confirmé", rating: 4 }
    ],
    matchesPlayed: 41,
    reliability: "97%",
    fairPlayScore: 4.8,
    availability: {
      "Lundi": ["soir"],
      "Mardi": ["apresmidi"],
      "Mercredi": ["soir"],
      "Jeudi": ["soir"],
      "Vendredi": ["soir"],
      "Samedi": ["matin", "apresmidi", "soir"],
      "Dimanche": ["apresmidi", "soir"]
    }
  },
  {
    id: "mate-8",
    firstName: "Chloé",
    lastName: "Martin",
    age: 21,
    city: "Liège",
    distanceKm: 0.9,
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
    bio: "Reprise du sport en douceur ! Débutante motivée en badminton et natation. Je cherche une personne sympa pour progresser ensemble.",
    sports: [
      { id: "badminton", name: "Badminton", level: "Débutant", rating: 1 },
      { id: "natation", name: "Natation", level: "Débutant", rating: 2 },
      { id: "running", name: "Running", level: "Débutant", rating: 1 }
    ],
    matchesPlayed: 12,
    reliability: "100%",
    fairPlayScore: 4.9,
    availability: {
      "Lundi": ["matin", "midi"],
      "Mardi": ["midi"],
      "Mercredi": ["matin", "apresmidi"],
      "Jeudi": ["midi"],
      "Vendredi": ["matin"],
      "Samedi": ["matin"],
      "Dimanche": ["matin", "midi"]
    }
  },
  {
    id: "mate-9",
    firstName: "Lucas",
    lastName: "Simon",
    age: 28,
    city: "Liège",
    distanceKm: 3.4,
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80",
    bio: "Passionné de ping-pong et de squash. Matchs rapides entre midi et deux ou en fin de journée pour décompresser.",
    sports: [
      { id: "pingpong", name: "Tennis de table", level: "Expert", rating: 5 },
      { id: "squash", name: "Squash", level: "Confirmé", rating: 4 },
      { id: "football", name: "Football", level: "Intermédiaire", rating: 3 }
    ],
    matchesPlayed: 57,
    reliability: "99%",
    fairPlayScore: 4.9,
    availability: {
      "Lundi": ["midi"],
      "Mardi": ["midi", "soir"],
      "Mercredi": ["midi"],
      "Jeudi": ["midi", "soir"],
      "Vendredi": ["midi"],
      "Samedi": ["apresmidi"],
      "Dimanche": ["soir"]
    }
  },
  {
    id: "mate-10",
    firstName: "Inès",
    lastName: "Belhadj",
    age: 24,
    city: "Bruxelles",
    distanceKm: 5.2,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    bio: "Joueuse de hand et fitness girl. Toujours partante pour une grosse session de fractionné ou un match d'équipe avec bonne humeur.",
    sports: [
      { id: "handball", name: "Handball", level: "Confirmé", rating: 4 },
      { id: "fitness", name: "Fitness & Muscu", level: "Expert", rating: 5 },
      { id: "running", name: "Running", level: "Confirmé", rating: 4 }
    ],
    matchesPlayed: 46,
    reliability: "100%",
    fairPlayScore: 5.0,
    availability: {
      "Lundi": ["matin", "soir"],
      "Mardi": ["soir"],
      "Mercredi": ["soir"],
      "Jeudi": ["matin", "soir"],
      "Vendredi": ["soir"],
      "Samedi": ["matin", "apresmidi"],
      "Dimanche": ["matin"]
    }
  },
  {
    id: "mate-11",
    firstName: "Nathan",
    lastName: "Lefebvre",
    age: 22,
    city: "Namur",
    distanceKm: 11.5,
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
    bio: "Padel & Foot à 5. J'adore l'ambiance des tournois du dimanche et rencontrer de nouveaux mates motivés.",
    sports: [
      { id: "padel", name: "Padel", level: "Intermédiaire", rating: 3 },
      { id: "football", name: "Football", level: "Confirmé", rating: 4 },
      { id: "tennis", name: "Tennis", level: "Intermédiaire", rating: 3 }
    ],
    matchesPlayed: 35,
    reliability: "98%",
    fairPlayScore: 4.8,
    availability: {
      "Lundi": ["soir"],
      "Mardi": ["soir"],
      "Mercredi": ["apresmidi"],
      "Jeudi": ["soir"],
      "Vendredi": ["soir"],
      "Samedi": ["matin", "apresmidi", "soir"],
      "Dimanche": ["apresmidi", "soir"]
    }
  },
  {
    id: "mate-12",
    firstName: "Romain",
    lastName: "Wouters",
    age: 31,
    city: "Liège",
    distanceKm: 2.7,
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80",
    bio: "Adepte de cross-training, rugby et padel. Je privilégie le fair-play et les belles rencontres sportives.",
    sports: [
      { id: "rugby", name: "Rugby", level: "Expert", rating: 5 },
      { id: "padel", name: "Padel", level: "Intermédiaire", rating: 3 },
      { id: "fitness", name: "Fitness & Muscu", level: "Confirmé", rating: 4 }
    ],
    matchesPlayed: 79,
    reliability: "100%",
    fairPlayScore: 5.0,
    availability: {
      "Lundi": ["midi"],
      "Mardi": ["soir"],
      "Mercredi": ["midi", "soir"],
      "Jeudi": ["soir"],
      "Vendredi": ["soir"],
      "Samedi": ["matin", "apresmidi"],
      "Dimanche": ["matin", "midi"]
    }
  }
];

// Matchs ouverts (style Playtomic)
const INITIAL_OPEN_MATCHES = [
  {
    id: "match-1",
    sportId: "padel",
    sportName: "Padel",
    sportIcon: "🎾",
    clubName: "Padel Club Liège Belle-Île",
    courtName: "Terrain 2 (Panoramique)",
    date: "Aujourd'hui",
    time: "19:00 - 20:30",
    levelRequired: "Intermédiaire (Niveau 3 - 4)",
    pricePerPerson: "10 €",
    totalSlots: 4,
    bookedSlots: 3,
    host: {
      name: "Thomas L.",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
    },
    players: [
      { name: "Thomas L.", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" },
      { name: "Elena M.", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=200&q=80" },
      { name: "Romain W.", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80" }
    ]
  },
  {
    id: "match-2",
    sportId: "football",
    sportName: "Football Five",
    sportIcon: "⚽",
    clubName: "Five Arena Rocourt",
    courtName: "Terrain Synthétique 1",
    date: "Demain",
    time: "20:00 - 21:00",
    levelRequired: "Tous niveaux bienvenus",
    pricePerPerson: "8 €",
    totalSlots: 10,
    bookedSlots: 9,
    host: {
      name: "Julien R.",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
    },
    players: [
      { name: "Julien R." }, { name: "Nathan L." }, { name: "Maxime C." },
      { name: "Sami B." }, { name: "Arnaud K." }, { name: "Mehdi T." },
      { name: "Alex V." }, { name: "Cédric D." }, { name: "Bastien F." }
    ]
  },
  {
    id: "match-3",
    sportId: "tennis",
    sportName: "Tennis",
    sportIcon: "🎾",
    clubName: "Royal Tennis Club de Liège",
    courtName: "Court Terre Battue N°4",
    date: "Samedi",
    time: "10:30 - 12:00",
    levelRequired: "Confirmé",
    pricePerPerson: "12 €",
    totalSlots: 2,
    bookedSlots: 1,
    host: {
      name: "Camille D.",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80"
    },
    players: [
      { name: "Camille D." }
    ]
  }
];

// Profil de l'utilisateur connecté par défaut (éditable dans l'écran 6)
const DEFAULT_MY_PROFILE = {
  id: "my-profile",
  isLoggedIn: true,
  firstName: "Alexandre",
  lastName: "Deville",
  email: "alex.deville@etudiant.helmo.be",
  age: 23,
  city: "Liège",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
  bio: "Étudiant passionné de sport. Je cherche des mates motivés pour des sessions de padel, de Five ou de badminton en région liégeoise.",
  sports: [
    { id: "padel", name: "Padel", level: "Intermédiaire", rating: 3 },
    { id: "football", name: "Football", level: "Confirmé", rating: 4 },
    { id: "badminton", name: "Badminton", level: "Débutant", rating: 2 }
  ],
  matchesPlayed: 19,
  reliability: "100%",
  fairPlayScore: 5.0,
  availability: {
    "Lundi": ["soir"],
    "Mardi": ["midi", "soir"],
    "Mercredi": ["soir"],
    "Jeudi": ["soir"],
    "Vendredi": ["apresmidi", "soir"],
    "Samedi": ["matin", "apresmidi"],
    "Dimanche": ["matin"]
  }
};

module.exports = { INITIAL_SPORTS, DAYS_OF_WEEK, TIME_SLOTS, INITIAL_MATES, DEFAULT_MY_PROFILE };
