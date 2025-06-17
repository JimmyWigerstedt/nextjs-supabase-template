import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { eventBus } from "~/server/events";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    user_id: string;
    updatedFields: string[];
  };

  console.info(`[webhook] internal updated`, body);

  eventBus.emit("internal-update", {
    userId: body.user_id,
    fields: body.updatedFields,
  });

  return NextResponse.json({ success: true });
}
