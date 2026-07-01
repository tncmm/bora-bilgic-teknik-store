import { prisma } from '../../db/prisma.js';

export class AuthRepository {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { themePreference: true },
    });
  }

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { themePreference: true },
    });
  }

  createUser(data: { firstName: string; lastName: string; email: string; passwordHash: string }) {
    return prisma.user.create({
      data: {
        ...data,
        cart: { create: {} },
        themePreference: { create: { mode: 'system' } },
      },
    });
  }
}
