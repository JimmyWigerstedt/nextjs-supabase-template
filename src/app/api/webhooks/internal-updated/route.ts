import { type NextRequest } from "next/server";
import { env } from "~/env";
import { internalDb } from "~/server/internal-db";

type Payload = {
  uid: string;
  test1?: string;
  test2?: string;
};

export async function POST(req: NextRequest) {
  if (req.headers.get("x-webhook-secret") !== env.N8N_WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = (await req.json()) as Payload;
  if (!body.uid) {
    return new Response("uid required", { status: 400 });
  }
  await internalDb.query(
    `INSERT INTO "userData" ("UID", "test1", "test2") VALUES ($1, $2, $3)
    ON CONFLICT("UID") DO UPDATE SET "test1" = EXCLUDED."test1", "test2" = EXCLUDED."test2"`,
    [body.uid, body.test1 ?? "", body.test2 ?? ""],
  );
  return new Response("ok");
}
