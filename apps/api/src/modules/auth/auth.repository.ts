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

  findUserByVerifyToken(token: string) {
    return prisma.user.findUnique({
      where: { verifyToken: token },
      include: { themePreference: true },
    });
  }

  createUser(data: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    emailVerified?: boolean;
    verifyToken?: string | null;
    verifyTokenExpiry?: Date | null;
  }) {
    return prisma.user.create({
      data: {
        ...data,
        cart: { create: {} },
        themePreference: { create: { mode: 'system' } },
      },
    });
  }

  markEmailVerified(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        verifyToken: null,
        verifyTokenExpiry: null,
      },
      include: { themePreference: true },
    });
  }

  updateVerifyToken(userId: string, verifyToken: string, verifyTokenExpiry: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { verifyToken, verifyTokenExpiry },
    });
  }
}
