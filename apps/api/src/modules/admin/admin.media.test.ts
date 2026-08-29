import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These tests load the service through dynamic `import()` because `env.ts`
 * resolves process.env once, at module-evaluation time. To exercise both the
 * configured and unconfigured R2 paths in one file, the module registry has to
 * be reset between them.
 */
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => {
  /** Captures the command input so assertions can inspect what was sent. */
  class CommandStub {
    readonly input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  return {
    S3Client: class {
      send = sendMock;
    },
    PutObjectCommand: CommandStub,
    DeleteObjectCommand: CommandStub,
    DeleteObjectsCommand: CommandStub,
  };
});

const R2_ENV: Record<string, string> = {
  R2_ACCOUNT_ID: 'test-account-id',
  R2_ACCESS_KEY_ID: 'test-access-key-id',
  R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
  R2_BUCKET_NAME: 'bora-bilgic-teknik-media',
  R2_PUBLIC_BASE_URL: 'https://media.example.com',
};

/** Loads a fresh AdminService with R2 either configured or not. */
async function loadService(configured = true) {
  vi.resetModules();
  sendMock.mockReset();

  for (const key of Object.keys(R2_ENV)) {
    if (configured) {
      process.env[key] = R2_ENV[key] as string;
    } else {
      delete process.env[key];
    }
  }

  const { AdminService } = await import('./admin.service.js');
  return new AdminService({} as never);
}

function base64Of(byteLength: number) {
  return Buffer.alloc(byteLength, 1).toString('base64');
}

const imageUpload = {
  kind: 'image',
  fileName: 'Mavic 3 Pro.png',
  mimeType: 'image/png',
  base64: base64Of(1024),
} as const;

/** Shaped to satisfy serializeProduct, which the write paths return through. */
function productFixture(images: Array<Record<string, unknown>>) {
  return {
    id: 'p1',
    name: 'DJI Mavic 3 Pro',
    slug: 'dji-mavic-3-pro',
    brand: 'DJI',
    shortDescription: 'Kisa aciklama',
    description: 'Detayli aciklama',
    price: 1000,
    stock: 5,
    sku: 'SKU-001',
    isPublished: true,
    isPurchasable: true,
    categoryId: 'category-1',
    category: { id: 'category-1', name: 'Camera Drones', slug: 'camera-drones' },
    images,
    specs: [{ id: 's1', name: 'Sensor', value: '1 inch' }],
  };
}

describe('AdminService.uploadMedia', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('uploads to the configured bucket under a date-partitioned key', async () => {
    sendMock.mockResolvedValue({});
    const service = await loadService();

    const result = await service.uploadMedia(imageUpload);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [command] = sendMock.mock.calls[0] as unknown as [{ input: Record<string, unknown> }];
    expect(command.input.Bucket).toBe('bora-bilgic-teknik-media');
    expect(command.input.ContentType).toBe('image/png');

    const key = String(command.input.Key);
    expect(key).toMatch(/^products\/images\/\d{4}\/\d{2}\/mavic-3-pro-[0-9a-f-]{36}\.png$/);

    expect(result).toMatchObject({
      key,
      url: `https://media.example.com/${key}`,
      mimeType: 'image/png',
      size: 1024,
    });
  });

  it('writes media with an immutable cache header', async () => {
    sendMock.mockResolvedValue({});
    const service = await loadService();

    await service.uploadMedia(imageUpload);

    const [command] = sendMock.mock.calls[0] as unknown as [{ input: Record<string, unknown> }];
    expect(command.input.CacheControl).toBe('public, max-age=31536000, immutable');
  });

  it('routes each upload kind to its own key prefix', async () => {
    sendMock.mockResolvedValue({});
    const service = await loadService();

    await service.uploadMedia({
      kind: 'video',
      fileName: 'flight.mp4',
      mimeType: 'video/mp4',
      base64: base64Of(2048),
    });
    await service.uploadMedia({
      kind: 'poster',
      fileName: 'flight-poster.jpg',
      mimeType: 'image/jpeg',
      base64: base64Of(512),
    });

    const keys = (sendMock.mock.calls as unknown as Array<[{ input: Record<string, unknown> }]>).map(
      (call) => String(call[0].input.Key),
    );

    expect(keys[0]).toMatch(/^products\/videos\//);
    expect(keys[1]).toMatch(/^products\/posters\//);
  });

  it('rejects a mime type that does not match the upload kind', async () => {
    const service = await loadService();

    await expect(
      service.uploadMedia({ ...imageUpload, mimeType: 'application/pdf' }),
    ).rejects.toThrow(/JPG, PNG, WEBP/);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects a video submitted as an image kind', async () => {
    const service = await loadService();

    await expect(
      service.uploadMedia({ ...imageUpload, mimeType: 'video/mp4' }),
    ).rejects.toThrow(/JPG, PNG, WEBP/);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects a file larger than the limit for its kind', async () => {
    const service = await loadService();

    await expect(
      service.uploadMedia({ ...imageUpload, base64: base64Of(5 * 1024 * 1024 + 1) }),
    ).rejects.toThrow(/5 MB/);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects an empty payload before contacting R2', async () => {
    const service = await loadService();

    await expect(
      service.uploadMedia({ ...imageUpload, base64: '' }),
    ).rejects.toThrow();

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('reports a configuration error instead of an opaque failure when R2 is unset', async () => {
    const service = await loadService(false);

    await expect(service.uploadMedia(imageUpload)).rejects.toThrow(/R2 ayarlari eksik/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('surfaces the R2 failure as a bad-gateway error', async () => {
    const service = await loadService();
    // Set after loading: loadService resets the mock to keep cases isolated.
    sendMock.mockRejectedValue(new Error('SignatureDoesNotMatch'));

    await expect(service.uploadMedia(imageUpload)).rejects.toThrow(/R2 yuklemesi basarisiz/);
  });
});

describe('AdminService media URLs', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('accepts root-relative paths so legacy seeded products stay editable', async () => {
    sendMock.mockResolvedValue({});
    const repository = {
      getProduct: vi.fn().mockResolvedValue(productFixture([])),
      updateProduct: vi.fn().mockResolvedValue(productFixture([])),
    };
    vi.resetModules();
    const { AdminService } = await import('./admin.service.js');
    const service = new AdminService(repository as never);

    await service.updateProduct('p1', {
      images: [{ url: '/storefront/product-drone.png', alt: 'Drone', kind: 'image', isPrimary: true }],
    });

    expect(repository.updateProduct).toHaveBeenCalled();
  });

  it('accepts an absolute R2 URL', async () => {
    const repository = {
      getProduct: vi.fn().mockResolvedValue(productFixture([])),
      updateProduct: vi.fn().mockResolvedValue(productFixture([])),
    };
    vi.resetModules();
    const { AdminService } = await import('./admin.service.js');
    const service = new AdminService(repository as never);

    await service.updateProduct('p1', {
      images: [
        {
          url: 'https://media.example.com/products/images/2026/08/drone.png',
          alt: 'Drone',
          kind: 'image',
          isPrimary: true,
        },
      ],
    });

    expect(repository.updateProduct).toHaveBeenCalled();
  });

  it('rejects protocol-relative URLs that would resolve off-origin', async () => {
    vi.resetModules();
    const { AdminService } = await import('./admin.service.js');
    const service = new AdminService({} as never);

    await expect(
      service.createProduct({
        name: 'Demo Product',
        slug: 'demo-product',
        categoryId: 'category-1',
        shortDescription: 'Kisa aciklama',
        description: 'Bu daha detayli bir aciklamadir.',
        sku: 'SKU-001',
        price: 100,
        stock: 1,
        isPublished: true,
        isPurchasable: true,
        images: [
          { url: '//evil.example.com/drone.png', alt: 'Drone', kind: 'image', isPrimary: true },
        ],
        specs: [{ name: 'Sensor', value: '1 inch' }],
      }),
    ).rejects.toThrow();
  });

  it('treats an empty poster string as null rather than an invalid URL', async () => {
    const repository = {
      getProduct: vi.fn().mockResolvedValue(productFixture([])),
      updateProduct: vi.fn().mockResolvedValue(productFixture([])),
    };
    vi.resetModules();
    const { AdminService } = await import('./admin.service.js');
    const service = new AdminService(repository as never);

    await expect(
      service.updateProduct('p1', {
        images: [
          {
            url: 'https://media.example.com/a.png',
            alt: 'Drone',
            kind: 'image',
            isPrimary: true,
            thumbnailUrl: '',
            mimeType: '',
          },
        ],
      }),
    ).resolves.toBeDefined();
  });
});

describe('AdminService orphaned media cleanup', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ Deleted: [] });
  });

  it('deletes R2 objects for media removed by an update', async () => {
    const repository = {
      getProduct: vi.fn().mockResolvedValue({
        id: 'p1',
        images: [
          { url: 'https://media.example.com/products/images/2026/08/old.png', thumbnailUrl: null },
          { url: 'https://media.example.com/products/images/2026/08/kept.png', thumbnailUrl: null },
        ],
      }),
      updateProduct: vi.fn().mockResolvedValue(productFixture([])),
    };
    vi.resetModules();
    const { AdminService } = await import('./admin.service.js');
    const service = new AdminService(repository as never);

    await service.updateProduct('p1', {
      images: [
        {
          url: 'https://media.example.com/products/images/2026/08/kept.png',
          alt: 'Kept',
          kind: 'image',
          isPrimary: true,
        },
      ],
    });

    const [command] = sendMock.mock.calls[0] as unknown as [{ input: Record<string, unknown> }];
    const objects = (command.input.Delete as { Objects: Array<{ Key: string }> }).Objects;

    expect(objects.map((object) => object.Key)).toEqual(['products/images/2026/08/old.png']);
  });

  it('deletes R2 objects when a product is deleted', async () => {
    const repository = {
      getProduct: vi.fn().mockResolvedValue({
        id: 'p1',
        images: [
          { url: 'https://media.example.com/products/images/2026/08/gone.png', thumbnailUrl: null },
        ],
      }),
      deleteProduct: vi.fn().mockResolvedValue(undefined),
    };
    vi.resetModules();
    const { AdminService } = await import('./admin.service.js');
    const service = new AdminService(repository as never);

    await service.deleteProduct('p1');

    const [command] = sendMock.mock.calls[0] as unknown as [{ input: Record<string, unknown> }];
    const objects = (command.input.Delete as { Objects: Array<{ Key: string }> }).Objects;

    expect(objects.map((object) => object.Key)).toEqual(['products/images/2026/08/gone.png']);
  });

  it('skips R2 calls for media hosted outside the configured bucket', async () => {
    const repository = {
      getProduct: vi.fn().mockResolvedValue({
        id: 'p1',
        images: [{ url: 'https://cdn.example.com/other.png', thumbnailUrl: null }],
      }),
      deleteProduct: vi.fn().mockResolvedValue(undefined),
    };
    vi.resetModules();
    const { AdminService } = await import('./admin.service.js');
    const service = new AdminService(repository as never);

    await service.deleteProduct('p1');

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('never fails the caller when R2 cleanup errors', async () => {
    sendMock.mockRejectedValue(new Error('R2 unavailable'));
    const repository = {
      getProduct: vi.fn().mockResolvedValue({
        id: 'p1',
        images: [{ url: 'https://media.example.com/products/images/2026/08/gone.png', thumbnailUrl: null }],
      }),
      deleteProduct: vi.fn().mockResolvedValue(undefined),
    };
    vi.resetModules();
    const { AdminService } = await import('./admin.service.js');
    const service = new AdminService(repository as never);

    await expect(service.deleteProduct('p1')).resolves.toBeUndefined();
    expect(repository.deleteProduct).toHaveBeenCalledWith('p1');
  });
});
