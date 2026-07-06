import { getStorage } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** Streams a stored artifact (generated PDFs, uploads) by storage key. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  if (!key || key.length === 0 || key.some((segment) => segment === "..")) {
    return new Response("Not found", { status: 404 });
  }

  const storageKey = key.join("/");
  const data = await getStorage().get(storageKey);
  if (!data) return new Response("Not found", { status: 404 });

  const ext = storageKey.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const filename = key[key.length - 1];

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
