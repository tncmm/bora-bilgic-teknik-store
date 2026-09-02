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

  // --- Refresh token saklama (sunucu tarafi iptal) -----------------------
  // Yalnizca token'in sha256 ozeti tutulur; ham JWT veritabanina yazilmaz.

  findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  }

  /**
   * Rotasyon: eski token'i tek seferlik olarak iptal eder ve yenisini ayni
   * islemde kaydeder. revokedAt null kosulu sayesinde ayni token ile islenen
   * paralel isteklerden yalnizca ilki basarilir; digeri null dondurur ve
   * boylece token yeniden kullanimi reddedilir.
   */
  rotateRefreshToken(input: {
    oldTokenHash: string;
    userId: string;
    newTokenHash: string;
    expiresAt: Date;
    revokedAt: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { tokenHash: input.oldTokenHash, revokedAt: null },
        data: { revokedAt: input.revokedAt },
      });

      if (revoked.count === 0) {
        return null;
      }

      return tx.refreshToken.create({
        data: { userId: input.userId, tokenHash: input.newTokenHash, expiresAt: input.expiresAt },
      });
    });
  }

  /** Cerezden gelen token'i (varsa ve hala aktifse) iptal eder. */
  revokeRefreshTokenByHash(tokenHash: string, revokedAt: Date) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }

  /**
   * Giris/verify aninda ucuz temizlik: kullanicinin suresi dolmus veya daha
   * once iptal edilmis tum refresh satirlari silinir (hash'i veritabaninda
   * bulunamayan token zaten reddedildigi icin tombstone saklamak gerekmez).
   */
  deleteStaleRefreshTokens(userId: string, now: Date) {
    return prisma.refreshToken.deleteMany({
      where: { userId, OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] },
    });
  }
}
