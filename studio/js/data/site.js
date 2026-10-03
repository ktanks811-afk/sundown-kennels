// ─────────────────────────────────────────────────────────────────────────────
// SITE SETTINGS
//
// Social links, the team and the contact form endpoint. Anything left
// empty is shown as "coming soon" rather than as a dead link.
// ─────────────────────────────────────────────────────────────────────────────

export const site = {
  // Paste full profile URLs here, e.g. "https://www.tiktok.com/@yourhandle".
  // A blank URL renders as a non-clickable "Soon" label.
  socials: [
    { id: "tiktok", label: "TikTok", url: "" },
    { id: "instagram", label: "Instagram", url: "" },
    { id: "youtube", label: "YouTube", url: "" },
    { id: "discord", label: "Discord", url: "" },
  ],

  // The team cards in the "Built from the ground up" section, in the order
  // shown. Add a person by copying an entry. photo and bio are optional; a
  // blank one shows the placeholder instead.
  team: [
    {
      name: "Kimari Tanks",
      role: "Lead Developer",
      photo: "", // e.g. "assets/team/kimari.jpg" (square, at least 480×480)
      bio: "", // a sentence or two in their own words
    },
    {
      name: "Lawrence Millender",
      role: "Idea Junkie",
      photo: "",
      bio: "",
    },
  ],

  // ── Contact form ──────────────────────────────────────────────────────────
  // There is no backend yet, so the form validates input and then tells the
  // visitor plainly that it isn't connected — it never fakes a "sent".
  //
  // To make it live, paste an endpoint that accepts a JSON POST of
  // { name, email, message } and returns a 2xx on success. Formspree works
  // out of the box: create a form at https://formspree.io and paste its
  // endpoint, e.g. "https://formspree.io/f/abcdwxyz". Any serverless
  // function (a Vercel function, Supabase edge function, etc.) works the same.
  contactEndpoint: "",
};
