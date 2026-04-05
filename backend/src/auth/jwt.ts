import jwt from 'jsonwebtoken';

export const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: '24h' });

export const verifyToken = (token: string) =>
  jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
