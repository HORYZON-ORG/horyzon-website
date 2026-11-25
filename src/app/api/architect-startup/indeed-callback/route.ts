import { handleIndeedStartupCallback } from "@/lib/public-leads/architect-indeed-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleIndeedStartupCallback(request);
}
