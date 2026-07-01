import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  it('does not pass the raw password field to the repository during registration', async () => {
    const createUser = vi.fn().mockResolvedValue({
      id: 'user-1',
      firstName: 'Mustafa',
      lastName: 'Tunc',
      email: 'mustafa@example.com',
      role: Role.CUSTOMER,
      passwordHash: 'hashed-password',
      themePreference: { mode: 'system' },
    });

    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue(null),
      createUser,
      findUserById: vi.fn(),
    };

    const service = new AuthService(repository as any);

    await service.register({
      firstName: 'Mustafa',
      lastName: 'Tunc',
      email: 'mustafa@example.com',
      password: 'Password123!',
    });

    expect(createUser).toHaveBeenCalledWith({
      firstName: 'Mustafa',
      lastName: 'Tunc',
      email: 'mustafa@example.com',
      passwordHash: expect.any(String),
    });
    expect(createUser.mock.calls[0][0]).not.toHaveProperty('password');
  });
});
