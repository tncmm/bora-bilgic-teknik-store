/**
 * Moves legacy storefront imagery from `apps/web/public` to Cloudflare R2 and
 * rewrites the matching ProductImage rows to the new public URLs.
 *
 * Why this exists: products seeded before R2 store root-relative paths such as
 * `/storefront/hero-drone.png`. Those files are shipped inside the web bundle
 * (about 20 MB of it). New uploads already go to R2, so without this script the
 * catalogue would stay permanently half-local, half-R2.
 *
 * Safety properties, in order of importance:
 *   1. Dry run by default — nothing is written unless `--apply` is passed.
 *   2. Idempotent — a file already present in R2 is reused, never duplicated,
 *      and rows already pointing at R2 are skipped. Re-running is safe.
 *   3. Non-destructive — local files are read only, never moved or deleted.
 *      Remove them yourself once you have verified the site on R2.
 *
 * Usage:
 *   npm run media:migrate -w apps/api              # dry run
 *   npm run media:migrate -w apps/api -- --apply   # write
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isR2Configured, putR2Object, r2ObjectExists } from '../src/lib/r2.js';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = resolve(scriptDir, '../../web/public');

/** Key prefix reserved for assets moved by this script. */
const KEY_PREFIX = 'storefront';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

function contentTypeFor(filePath: string) {
  return MIME_BY_EXTENSION[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/** Only root-relative paths can be migrated; absolute URLs are already remote. */
function isRootRelative(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

async function main() {
  if (!isR2Configured()) {
    console.error(
      '\nCloudflare R2 is not configured.\n' +
        'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME\n' +
        'and R2_PUBLIC_BASE_URL in apps/api/.env, then run this again.\n' +
        'See apps/api/.env.example for how to obtain each value.\n',
    );
    process.exitCode = 1;
    return;
  }

  const images = await prisma.productImage.findMany({
    select: { id: true, url: true, thumbnailUrl: true },
  });

  /** Distinct relative paths that still need moving. */
  const relativePaths = new Set<string>();
  for (const image of images) {
    if (isRootRelative(image.url)) relativePaths.add(image.url);
    if (isRootRelative(image.thumbnailUrl)) relativePaths.add(image.thumbnailUrl as string);
  }

  if (!relativePaths.size) {
    console.log('\nNothing to migrate — no product media uses a root-relative path.\n');
    return;
  }

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ${relativePaths.size} local asset(s) referenced.\n`);

  /** relative path -> public R2 URL. Populated even in dry run. */
  const resolved = new Map<string, string>();
  const missing: string[] = [];
  let uploaded = 0;
  let reused = 0;

  for (const relativePath of [...relativePaths].sort()) {
    const localPath = join(PUBLIC_DIR, relativePath);

    if (!existsSync(localPath)) {
      missing.push(relativePath);
      console.log(`  MISSING  ${relativePath}`);
      continue;
    }

    const key = `${KEY_PREFIX}/${basename(relativePath)}`;
    const contentType = contentTypeFor(localPath);
    const body = readFileSync(localPath);
    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '')}/${key}`;

    const alreadyPresent = APPLY ? await r2ObjectExists(key) : false;

    if (!APPLY) {
      console.log(`  WOULD UPLOAD  ${relativePath} -> ${key} (${Math.round(body.length / 1024)} KB)`);
    } else if (alreadyPresent) {
      reused += 1;
      console.log(`  REUSED  ${key}`);
    } else {
      await putR2Object({ key, body, contentType });
      uploaded += 1;
      console.log(`  UPLOADED  ${key} (${Math.round(body.length / 1024)} KB)`);
    }

    resolved.set(relativePath, publicUrl);
  }

  if (!APPLY) {
    const rowCount = images.filter(
      (image) => isRootRelative(image.url) || isRootRelative(image.thumbnailUrl),
    ).length;

    console.log(`\nDry run complete.`);
    console.log(`  ${resolved.size} asset(s) would be uploaded to R2.`);
    if (missing.length) console.log(`  ${missing.length} referenced file(s) are missing on disk.`);
    console.log(`  ${rowCount} ProductImage row(s) would be rewritten.`);
    console.log(`\nRe-run with --apply to write. Local files are never deleted by this script.\n`);
    return;
  }

  // Rewrite rows inside a transaction so a partial failure cannot leave the
  // catalogue pointing at a mix of local and remote paths.
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const image of images) {
      const nextUrl = isRootRelative(image.url) ? resolved.get(image.url) : undefined;
      const nextThumbnail = isRootRelative(image.thumbnailUrl)
        ? resolved.get(image.thumbnailUrl as string)
        : undefined;

      if (!nextUrl && !nextThumbnail) {
        continue;
      }

      await tx.productImage.update({
        where: { id: image.id },
        data: {
          ...(nextUrl ? { url: nextUrl } : {}),
          ...(nextThumbnail ? { thumbnailUrl: nextThumbnail } : {}),
        },
      });
      updated += 1;
    }
  });

  console.log(`\nDone.`);
  console.log(`  ${uploaded} uploaded, ${reused} reused from R2.`);
  if (missing.length) console.log(`  ${missing.length} file(s) were missing and left untouched.`);
  console.log(`  ${updated} ProductImage row(s) rewritten.`);
  console.log(
    `\nVerify the site, then delete the originals from apps/web/public/storefront/ yourself.`,
  );
  console.log(`This script never removes local files.\n`);
}

main()
  .catch((error) => {
    console.error('\nMigration failed:', error instanceof Error ? error.message : error, '\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
