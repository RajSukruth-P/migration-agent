import { listTargetEmployees } from "@/lib/target/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId") ?? undefined;
  return Response.json({ employees: listTargetEmployees(jobId) });
}
