import { NextResponse } from "next/server";
import { supabaseServer } from "~/util/supabase/server";
import { eventBus } from "~/server/events";

export async function GET() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const listener = (payload: { userId: string; fields: string[] }) => {
        if (payload.userId === user.id) {
          controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
        }
      };
      eventBus.on("internal-update", listener);
      const keepAlive = setInterval(() => {
        controller.enqueue(`:\n\n`);
      }, 15000);
      return () => {
        clearInterval(keepAlive);
        eventBus.off("internal-update", listener);
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    },
  });
}
