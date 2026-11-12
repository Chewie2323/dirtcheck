CREATE INDEX "account_user" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "membership_user" ON "membership" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_user" ON "session" USING btree ("userId");