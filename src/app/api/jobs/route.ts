import { MigrationJob, saveJob } from "@/lib/agent/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const job = new MigrationJob();
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const uploads = form.getAll("files");
    const files: Array<{ name: string; buffer: Buffer }> = [];
    for (const upload of uploads) {
      if (typeof upload === "string") continue;
      const bytes = Buffer.from(await upload.arrayBuffer());
      files.push({ name: upload.name, buffer: bytes });
    }
    if (!files.length) {
      return Response.json({ error: "Upload at least one CSV or Excel file." }, { status: 400 });
    }
    job.loadUploads(files);
  } else {
    await job.loadSamples();
  }

  saveJob(job);
  void job.start();
  return Response.json({ id: job.id, snapshot: job.snapshot() });
}

export async function GET() {
  return Response.json({
    jobs: [...((globalThis as unknown as { __jobs?: Map<string, MigrationJob> }).__jobs?.keys() ?? [])],
  });
}
