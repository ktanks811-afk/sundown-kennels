// ─────────────────────────────────────────────────────────────────────────────
// SITE SETTINGS
//
// Social links, the founder card and the contact form endpoint. Anything left
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

  // The founder card in the "Built from the ground up" section. Leave name,
  // photo and bio blank to keep the placeholder; fill any of them in and the
  // card picks them up.
  founder: {
    role: "Founder & Game Developer",
    name: "",
    photo: "", // e.g. "assets/founder.jpg" (square, at least 480×480)
    bio: "", // a sentence or two in your own words
  },

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
