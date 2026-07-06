import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Local filesystem storage adapter. Mirrors @tz/agent-core's LocalStorage —
 *  duplicated here because that package pulls playwright. Swap for S3 later. */
export class LocalStorage {
  constructor(private readonly root: string = process.env.STORAGE_ROOT ?? "./storage") {}

  private full(key: string): string {
    return path.join(this.root, key);
  }

  async put(key: string, data: Buffer, _mimeType?: string): Promise<void> {
    const p = this.full(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.full(key));
    } catch {
      return null;
    }
  }

  publicPath(key: string): string {
    return `/api/artifacts/${key}`;
  }
}

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

let singleton: LocalStorage | null = null;

export function getStorage(): LocalStorage {
  if (!singleton) singleton = new LocalStorage();
  return singleton;
}
