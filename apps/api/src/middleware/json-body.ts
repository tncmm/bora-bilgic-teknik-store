import express, { type NextFunction, type Request, type Response } from 'express';

/**
 * Regular API payloads are small — product drafts, cart updates and checkout
 * bodies are all far below this. Keeping the default tight means an
 * unauthenticated caller cannot exhaust server memory with an oversized body.
 */
export const jsonBody = express.json({ limit: '2mb' });

/**
 * Admin media uploads arrive as base64 inside a JSON field. A 100 MB video
 * expands to roughly 133 MB of base64, so this one endpoint genuinely needs a
 * limit that large. It is only ever mounted behind requireAuth + requireAdmin,
 * which is why it is safe here.
 */
export const largeJsonBody = express.json({ limit: '160mb' });

/** Paths that opt out of the small default limit. */
const LARGE_BODY_PATHS = new Set(['/api/v1/admin/media/upload']);

/**
 * Skips the default parser for paths that mount `largeJsonBody` themselves
 * further down the chain. Without the skip, the small limit would reject the
 * upload with a 413 before the route-specific parser ever ran.
 */
export function jsonBodyUnlessLarge(req: Request, res: Response, next: NextFunction) {
  if (LARGE_BODY_PATHS.has(req.path)) {
    next();
    return;
  }

  jsonBody(req, res, next);
}
