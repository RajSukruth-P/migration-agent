import { getJob } from "@/lib/agent/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  const body = await req.json();
  try {
    await job.resolve({
      escalationId: body.escalationId,
      action: body.action,
      payload: body.payload,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not apply that decision" },
      { status: 400 },
    );
  }
  return Response.json(job.snapshot());
}
