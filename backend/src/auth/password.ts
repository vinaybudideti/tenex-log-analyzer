import argon2 from 'argon2';

export const hashPassword = (p: string) => argon2.hash(p, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

export const verifyPassword = (hash: string, p: string) => argon2.verify(hash, p);
