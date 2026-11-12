import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Never cache: this is for uptime monitors, so it has to reach the database every time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("health check failed", error);
    // No detail in the body. The log has it.
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
