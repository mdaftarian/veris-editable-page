/* ------------------------------------------------------------------
   Site configuration
   Leave supabaseUrl / supabaseAnonKey empty and the app runs in
   "local" mode (edits live in each visitor's browser; publish with
   Export → commit edits.json). Fill them in and every visitor shares
   one live copy — edits and comments sync instantly for everyone.
   The anon key is safe to publish: it is a public key, and access is
   governed by the row-level-security policies in supabase.sql.
   ------------------------------------------------------------------ */
window.SITE_CONFIG = {
  supabaseUrl: "https://kehpoavcnspbogfltkxa.supabase.co",
  supabaseAnonKey: "sb_publishable_aDSehuQ59TTcicFZIS8UKg_5AuUvOlf",  // publishable key — safe to expose
  bucket: "images",         // Storage bucket for uploaded images
  editPasscode: ""          // optional: visitors must type this before editing/commenting
};
