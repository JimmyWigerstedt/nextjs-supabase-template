import { type NextRequest } from "next/server";
import { env } from "~/env";

export async function POST(req: NextRequest) {
  return new Response("ok");
}
