-- Sessions for the moderation area, replacing HTTP Basic auth.
--
-- Server-side rather than a self-contained signed cookie, for one reason that
-- matters here: revocation. Removing someone from the allowlist should end the
-- session they already have, not wait for it to expire.
--
-- The cookie carries a random token; only its SHA-256 lands in this table, so a
-- database leak does not hand anyone a working session.

create table admin_sessions (
  token_hash   text primary key,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  user_agent   text,
  ip           inet
);

create index admin_sessions_email_idx  on admin_sessions (email);
create index admin_sessions_expiry_idx on admin_sessions (expires_at);
