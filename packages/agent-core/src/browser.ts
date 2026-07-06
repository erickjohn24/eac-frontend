import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

/**
 * Browser session manager. Runs Chromium (from the pre-installed
 * PLAYWRIGHT_BROWSERS_PATH), records a trace + video per session for the audit
 * trail, and exposes the page to flows. Headless by default; set
 * BROWSER_HEADED=1 to watch runs locally.
 */

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /** finalize tracing + video; returns storage keys (relative paths) */
  close(): Promise<{ traceKey: string; videoKey: string | null }>;
}

export interface OpenSessionOptions {
  sessionId: string;
  storageRoot: string;
  /** persisted cookies/localStorage to restore (per company+portal) */
  storageState?: string;
}

export async function openBrowserSession(
  opts: OpenSessionOptions,
): Promise<BrowserSession> {
  const headed = process.env.BROWSER_HEADED === "1";
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

  const sessionDir = path.join(opts.storageRoot, "agent-sessions", opts.sessionId);
  const videoDir = path.join(sessionDir, "video");
  await mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: !headed,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 900 } },
    ...(opts.storageState ? { storageState: JSON.parse(opts.storageState) } : {}),
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    async close() {
      const traceKey = path.join("agent-sessions", opts.sessionId, "trace.zip");
      await context.tracing.stop({ path: path.join(opts.storageRoot, traceKey) });
      const video = page.video();
      let videoKey: string | null = null;
      await context.close(); // flush video
      if (video) {
        try {
          const abs = await video.path();
          videoKey = path.relative(opts.storageRoot, abs);
        } catch {
          videoKey = null;
        }
      }
      await browser.close();
      return { traceKey, videoKey };
    },
  };
}

/** Persist cookies/localStorage so a portal login survives across steps. */
export async function dumpStorageState(context: BrowserContext): Promise<string> {
  return JSON.stringify(await context.storageState());
}
