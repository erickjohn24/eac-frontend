import type { Request, Response, NextFunction, RequestHandler } from "express";
import multer from "multer";
import { db } from "./db.js";

export const upload = multer({ storage: multer.memoryStorage() });

export type Account = Record<string, any>;

export function currentAccount(req: Request, portal: string): Account | null {
  const sess = req.session as Record<string, any> | undefined;
  const id = sess?.[portal];
  if (!id) return null;
  const acc = db.prepare("SELECT * FROM accounts WHERE id = ? AND portal = ?").get(id, portal) as
    | Account
    | undefined;
  return acc ?? null;
}

export function requireAuth(portal: string, loginPath: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const acc = currentAccount(req, portal);
    if (!acc) {
      res.redirect(loginPath);
      return;
    }
    res.locals.userEmail = acc.email;
    (req as Request & { account?: Account }).account = acc;
    next();
  };
}

/** Merge per-render locals over the response defaults set in server.ts. */
export function view(res: Response, template: string, locals: Record<string, unknown>): void {
  res.render(template, locals);
}
