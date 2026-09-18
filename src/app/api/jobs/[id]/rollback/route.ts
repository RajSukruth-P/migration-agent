import { getJob } from "@/lib/agent/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  await job.rollback();
  return Response.json(job.snapshot());
}
