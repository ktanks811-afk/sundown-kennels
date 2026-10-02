// ─────────────────────────────────────────────────────────────────────────────
// GAMES
//
// Every game card, the game detail dialog, the hero "now playing" ticker and
// the studio stats are all built from this one array. To add a game, copy an
// entry, change the fields, and drop its artwork into assets/art/. Nothing
// else needs touching.
//
//   id           url-safe slug, unique. Used for #game-<id> deep links.
//   title        display name
//   category     list of genre tags, shown as "RANCH • BREEDING • …"
//   description  card copy — keep it to two or three sentences
//   status       one of the STATUS values below. Only PLAYABLE games get a
//                PLAY GAME button; anything else shows a disabled status
//                button so the site never implies a game is out when it isn't.
//   url          where PLAY GAME goes. Leave "" until the game is live.
//   image        artwork path, relative to studio/
//   imageAlt     describe the image honestly (it's artwork, not gameplay)
//   artCredit    small label on the artwork. Keep it truthful — if you swap in
//                a real screenshot, change it to "Gameplay screenshot".
//   features     short bullet points for the card and the detail dialog
//   platform     where it's played
//   accent       one colour used for this game's glow, chips and highlights
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS = {
  PLAYABLE: "PLAYABLE",
  IN_DEVELOPMENT: "IN DEVELOPMENT",
  COMING_SOON: "COMING SOON",
};

export const games = [
  {
    id: "hogs-and-dogs",
    title: "Hogs & Dogs",
    category: ["Ranch", "Breeding", "Hunting", "Simulation"],
    description:
      "Build your ranch, breed powerful hunting dogs, train your bloodline, and head into the field. Build your kennel, expand your operation, and create the ultimate hunting dogs.",
    status: STATUS.PLAYABLE,
    url: "https://hogs-and-dogs.vercel.app",
    image: "assets/art/hogs-and-dogs.svg",
    imageAlt:
      "Illustration of a ranch at dusk: a windmill and treeline against a setting sun, with dog and hog tracks crossing a tracking map.",
    artCredit: "Key art · Illustration",
    features: [
      "Ranch building",
      "Dog breeding",
      "Bloodline training",
      "Field hunting",
      "Kennel management",
      "Expand your operation",
    ],
    platform: "Web browser",
    accent: "#3dffa8",
  },
  {
    id: "roll-for-glory",
    title: "Roll For Glory",
    category: ["Racing", "Street", "Life Simulation"],
    description:
      "Build your car, build your reputation, and race your way through a world where every run can change everything.",
    status: STATUS.COMING_SOON,
    url: "",
    image: "assets/art/roll-for-glory.svg",
    imageAlt:
      "Illustration of a neon-lit highway at night with light trails racing toward a city skyline and distant police lights.",
    artCredit: "Key art · Illustration",
    features: [
      "Street racing",
      "Roll racing",
      "Drag racing",
      "Police pursuits",
      "Car customization",
      "Money progression",
      "Reputation",
      "Open-world activities",
    ],
    platform: "Web browser",
    accent: "#b18cff",
  },
];
