import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { CartService } from './cart.service.js';

const productWithPackages = {
  id: 'product-1',
  name: 'DJI Mic 2',
  isPublished: true,
  isPurchasable: true,
  stock: 10,
  price: 1499.5,
  discountPercent: 0,
  packageOptions: [
    { id: 'standard', name: 'Standart Paket', price: 1499.5, isDefault: true },
    { id: 'combo', name: 'Fly More Combo', price: 1999.5, isDefault: false },
  ],
};

function createRepository() {
  return {
    ensureCart: vi.fn().mockResolvedValue({ id: 'cart-1', items: [] }),
    findProduct: vi.fn().mockResolvedValue({ ...productWithPackages }),
    addOrUpdateItem: vi.fn().mockResolvedValue('created'),
    findCart: vi.fn().mockResolvedValue({ id: 'cart-1', items: [] }),
    updateItem: vi.fn().mockResolvedValue('updated'),
    removeItem: vi.fn().mockResolvedValue({ count: 1 }),
  };
}

describe('CartService', () => {
  it('rejects non-purchasable products', async () => {
    const repository = createRepository();
    repository.findProduct.mockResolvedValue({ ...productWithPackages, isPurchasable: false });

    const service = new CartService(repository as any);

    await expect(
      service.addItem('user-1', {
        productId: 'product-1',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects with 404 when updating an item owned by another user', async () => {
    const repository = createRepository();
    repository.updateItem.mockResolvedValue('removed');

    const service = new CartService(repository as any);

    await expect(service.updateItem('user-1', 'item-1', { quantity: 2 })).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 404,
      message: 'Sepet kalemi bulunamadi.',
    });
    expect(repository.findCart).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the updated quantity exceeds the product stock', async () => {
    const repository = createRepository();
    repository.updateItem.mockResolvedValue('stock-exceeded');

    const service = new CartService(repository as any);

    await expect(service.updateItem('user-1', 'item-1', { quantity: 9 })).rejects.toMatchObject({
      statusCode: 409,
      message: 'Stok yetersiz.',
    });
  });

  it('rejects with 404 when removing an item owned by another user', async () => {
    const repository = createRepository();
    repository.removeItem.mockResolvedValue({ count: 0 });

    const service = new CartService(repository as any);

    await expect(service.removeItem('user-1', 'item-1')).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 404,
      message: 'Sepet kalemi bulunamadi.',
    });
    expect(repository.findCart).not.toHaveBeenCalled();
  });

  it('passes the userId to repository update/remove calls', async () => {
    const repository = createRepository();
    const service = new CartService(repository as any);

    await service.updateItem('user-1', 'item-1', { quantity: 3 });
    await service.removeItem('user-1', 'item-1');

    expect(repository.updateItem).toHaveBeenCalledWith('user-1', 'item-1', 3);
    expect(repository.removeItem).toHaveBeenCalledWith('user-1', 'item-1');
  });

  describe('package options', () => {
    it('adds a base-product line without package info by default', async () => {
      const repository = createRepository();
      const service = new CartService(repository as any);

      await service.addItem('user-1', { productId: 'product-1', quantity: 1 });

      expect(repository.addOrUpdateItem).toHaveBeenCalledWith({
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 1,
        packageOptionId: '',
        packageLabel: null,
      });
    });

    it('stores the chosen package option id and label', async () => {
      const repository = createRepository();
      const service = new CartService(repository as any);

      await service.addItem('user-1', { productId: 'product-1', quantity: 1, packageOptionId: 'combo' });

      expect(repository.addOrUpdateItem).toHaveBeenCalledWith({
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 1,
        packageOptionId: 'combo',
        packageLabel: 'Fly More Combo',
      });
    });

    it('rejects a package id that does not exist on the product', async () => {
      const repository = createRepository();
      const service = new CartService(repository as any);

      await expect(
        service.addItem('user-1', { productId: 'product-1', quantity: 1, packageOptionId: 'olmayan-paket' }),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 400,
        message: 'Gecersiz paket secimi.',
      });
      expect(repository.addOrUpdateItem).not.toHaveBeenCalled();
    });

    it('rejects a package id on a product without package options', async () => {
      const repository = createRepository();
      repository.findProduct.mockResolvedValue({ ...productWithPackages, packageOptions: null });
      const service = new CartService(repository as any);

      await expect(
        service.addItem('user-1', { productId: 'product-1', quantity: 1, packageOptionId: 'combo' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Gecersiz paket secimi.' });
    });

    it('lets the same product live on separate lines per package', async () => {
      const repository = createRepository();
      const service = new CartService(repository as any);

      await service.addItem('user-1', { productId: 'product-1', quantity: 1, packageOptionId: 'combo' });
      await service.addItem('user-1', { productId: 'product-1', quantity: 1, packageOptionId: 'standard' });
      await service.addItem('user-1', { productId: 'product-1', quantity: 2 });

      const optionIds = repository.addOrUpdateItem.mock.calls.map((call) => call[0].packageOptionId);
      expect(optionIds).toEqual(['combo', 'standard', '']);
    });
  });

  describe('quantity guards', () => {
    it('maps the per-line cap violation to a Turkish 409', async () => {
      const repository = createRepository();
      repository.addOrUpdateItem.mockResolvedValue('cap-exceeded');
      const service = new CartService(repository as any);

      await expect(service.addItem('user-1', { productId: 'product-1', quantity: 5 })).rejects.toMatchObject({
        statusCode: 409,
        message: 'Ayni urunden en fazla 10 adet satin alabilirsiniz.',
      });
      expect(repository.findCart).not.toHaveBeenCalled();
    });

    it('maps the stock violation to the existing Turkish 409', async () => {
      const repository = createRepository();
      repository.addOrUpdateItem.mockResolvedValue('stock-exceeded');
      const service = new CartService(repository as any);

      await expect(service.addItem('user-1', { productId: 'product-1', quantity: 5 })).rejects.toMatchObject({
        statusCode: 409,
        message: 'Stok yetersiz.',
      });
      expect(repository.findCart).not.toHaveBeenCalled();
    });
  });
});
