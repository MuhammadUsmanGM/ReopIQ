import { warmupModel } from "@/lib/embedder";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await warmupModel();
    return Response.json({ status: "ready" });
  } catch (error: any) {
    return Response.json({ status: "error", message: error.message }, { status: 500 });
  }
}
