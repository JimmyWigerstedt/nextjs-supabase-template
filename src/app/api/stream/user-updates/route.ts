import { type NextRequest } from "next/server";
import { supabaseServer } from "~/util/supabase/server";

export async function GET(req: NextRequest) {
  return new Response(null);
}
