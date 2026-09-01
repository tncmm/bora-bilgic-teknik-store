import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import {
  PRODUCT_MEDIA_IMAGE_MIME_TYPES,
  PRODUCT_MEDIA_LIMITS,
  PRODUCT_MEDIA_POSTER_MIME_TYPES,
  PRODUCT_MEDIA_VIDEO_MIME_TYPES,
  type AdminUploadKind,
} from '@bora/types';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';

import { env } from '../config/env.js';
import { AppError } from './app-error.js';

interface UploadMediaInput {
  kind: AdminUploadKind;
  fileName: string;
  mimeType: string;
  base64: string;
}

interface R2Config {
  bucketName: string;
  publicBaseUrl: string;
}

/**
 * Media objects are immutable: the object key contains a UUID and is never
 * reused. Serving them with a long immutable cache is therefore safe and is
 * what makes the public R2 bucket cheap to serve from.
 */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

let cachedClient: S3Client | null = null;
let cachedConfig: R2Config | null = null;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

/**
 * Reports whether R2 is usable without throwing. Callers use this to degrade
 * gracefully instead of surfacing an opaque 500 at upload time.
 */
export function isR2Configured() {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME &&
      env.R2_PUBLIC_BASE_URL,
  );
}

function requireR2Config(): R2Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!isR2Configured()) {
    throw new AppError(
      'Cloudflare R2 ayarlari eksik. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME ve R2_PUBLIC_BASE_URL degerlerini tanimlayin.',
      500,
    );
  }

  cachedConfig = {
    bucketName: env.R2_BUCKET_NAME as string,
    publicBaseUrl: normalizeBaseUrl(env.R2_PUBLIC_BASE_URL as string),
  };

  return cachedConfig;
}

function getClient(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  requireR2Config();

  const clientConfig: S3ClientConfig = {
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
    },
    // R2 is not virtual-hosted per bucket the way AWS S3 is.
    forcePathStyle: true,
    // R2 does not support the trailing checksum headers newer AWS SDK versions
    // attach by default; without this, PutObject fails signature validation.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  };

  cachedClient = new S3Client(clientConfig);
  return cachedClient;
}

function getAllowedMimeTypes(kind: AdminUploadKind) {
  if (kind === 'video') {
    return [...PRODUCT_MEDIA_VIDEO_MIME_TYPES];
  }

  if (kind === 'poster') {
    return [...PRODUCT_MEDIA_POSTER_MIME_TYPES];
  }

  return [...PRODUCT_MEDIA_IMAGE_MIME_TYPES];
}

function getMaxBytes(kind: AdminUploadKind) {
  if (kind === 'video') return PRODUCT_MEDIA_LIMITS.videoBytes;
  if (kind === 'poster') return PRODUCT_MEDIA_LIMITS.posterBytes;
  return PRODUCT_MEDIA_LIMITS.imageBytes;
}

function getUploadLimitMessage(kind: AdminUploadKind) {
  if (kind === 'video') return 'Video boyutu 100 MB sinirini asamaz.';
  if (kind === 'poster') return 'Poster boyutu 3 MB sinirini asamaz.';
  return 'Gorsel boyutu 5 MB sinirini asamaz.';
}

function getUploadFormatMessage(kind: AdminUploadKind) {
  if (kind === 'video') return 'Yalnizca MP4 veya WEBM yukleyebilirsiniz.';
  return 'Yalnizca JPG, PNG, WEBP veya AVIF yukleyebilirsiniz.';
}

function inferExtension(fileName: string, mimeType: string) {
  const originalExtension = extname(fileName).toLowerCase();
  if (originalExtension) return originalExtension;

  const mapping: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };

  return mapping[mimeType] ?? '';
}

function sanitizeBaseName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  return withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'media';
}

function buildObjectKey(kind: AdminUploadKind, fileName: string, mimeType: string) {
  const now = new Date();
  const prefix = kind === 'video' ? 'products/videos' : kind === 'poster' ? 'products/posters' : 'products/images';
  const extension = inferExtension(fileName, mimeType);
  const baseName = sanitizeBaseName(fileName);

  return [
    prefix,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    `${baseName}-${randomUUID()}${extension}`,
  ].join('/');
}

function validateUpload(kind: AdminUploadKind, mimeType: string, size: number) {
  if (!getAllowedMimeTypes(kind).includes(mimeType as never)) {
    throw new AppError(getUploadFormatMessage(kind), 400);
  }

  if (size > getMaxBytes(kind)) {
    throw new AppError(getUploadLimitMessage(kind), 400);
  }
}

export async function uploadMediaToR2(input: UploadMediaInput) {
  const config = requireR2Config();
  const buffer = Buffer.from(input.base64, 'base64');

  if (!buffer.length) {
    throw new AppError('Bos dosya yuklenemez.', 400);
  }

  validateUpload(input.kind, input.mimeType, buffer.length);

  const key = buildObjectKey(input.kind, input.fileName, input.mimeType);

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: input.mimeType,
        CacheControl: IMMUTABLE_CACHE_CONTROL,
      }),
    );
  } catch (error) {
    // The SDK error message carries the R2/S3 fault detail, which is the only
    // useful signal when credentials or bucket permissions are wrong.
    const detail = error instanceof Error ? error.message : '';
    throw new AppError(`R2 yuklemesi basarisiz oldu.${detail ? ` ${detail}` : ''}`, 502);
  }

  return {
    url: `${config.publicBaseUrl}/${key}`,
    key,
    mimeType: input.mimeType,
    size: buffer.length,
  };
}

/**
 * Low-level write for callers that already know the key they want — the
 * storefront migration uses deterministic keys so re-runs do not duplicate
 * objects.
 */
export async function putR2Object(input: { key: string; body: Buffer; contentType: string }) {
  const config = requireR2Config();

  await getClient().send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
    }),
  );

  return `${config.publicBaseUrl}/${input.key}`;
}

/**
 * Existence check that lets the migration skip work it has already done.
 * A missing object is a normal outcome here, not an error.
 */
export async function r2ObjectExists(key: string) {
  requireR2Config();

  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: requireR2Config().bucketName,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort delete. Losing the R2 object must never block the caller's
 * database operation, and an already-missing object is not an error here.
 */
export async function deleteMediaFromR2(key: string) {
  if (!key || !isR2Configured()) {
    return false;
  }

  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: requireR2Config().bucketName,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    console.warn(`[r2] Object silinemedi: ${key}`, error instanceof Error ? error.message : error);
    return false;
  }
}

/** Batch variant used when product media is replaced wholesale. */
export async function deleteManyMediaFromR2(keys: string[]) {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (!uniqueKeys.length || !isR2Configured()) {
    return 0;
  }

  try {
    const response = await getClient().send(
      new DeleteObjectsCommand({
        Bucket: requireR2Config().bucketName,
        Delete: {
          Objects: uniqueKeys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );
    return response.Deleted?.length ?? 0;
  } catch (error) {
    console.warn('[r2] Toplu silme basarisiz.', error instanceof Error ? error.message : error);
    return 0;
  }
}

/**
 * Extracts the R2 object key from a stored public URL so orphaned objects can
 * be cleaned up when a product or its media is removed.
 */
export function extractR2KeyFromUrl(url: string | null | undefined): string | null {
  if (!url || !isR2Configured()) {
    return null;
  }

  const { publicBaseUrl } = requireR2Config();

  if (!url.startsWith(`${publicBaseUrl}/`)) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith('.r2.dev')) {
        return null;
      }

      return parsed.pathname.replace(/^\/+/, '') || null;
    } catch {
      return null;
    }
  }

  const key = url.slice(publicBaseUrl.length + 1);
  return key.length ? key : null;
}
