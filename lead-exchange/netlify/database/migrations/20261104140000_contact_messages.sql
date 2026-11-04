-- Replaces the /contact page's Netlify Forms submission (incompatible with
-- @netlify/plugin-nextjs@5 — see migration note in app/contact/page.tsx) with a real,
-- database-backed workflow, same pattern as buyer applications.

CREATE TABLE contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
