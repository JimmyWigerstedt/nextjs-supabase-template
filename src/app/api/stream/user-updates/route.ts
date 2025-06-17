import { type NextRequest } from "next/server";
import { internalDb } from "~/server/internal-db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  if (!uid) return new Response("uid required", { status: 400 });

  const encoder = new TextEncoder();
  let last: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const interval = setInterval(async () => {
        try {
          const result = await internalDb.query(
            'SELECT test1, test2 FROM "userData" WHERE "UID" = $1',
            [uid],
          );
          if (result.rows[0]) {
            const payload = JSON.stringify(result.rows[0]);
            if (payload !== last) {
              last = payload;
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${err}\n\n`));
        }
      }, 2000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
