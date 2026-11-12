-- Supabase exposes every table in the public schema through its REST API using
-- the anon and authenticated roles. This app never uses that API; it connects
-- straight to Postgres with the server's own credentials. Enabling row-level
-- security with no policies makes the REST API return nothing for those roles,
-- so password hashes and deal data cannot be read with the public anon key.
-- The server's connection role bypasses RLS and is unaffected.
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "membership" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
