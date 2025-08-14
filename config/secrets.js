import dotenv from 'dotenv';
dotenv.config();

const rawSecret = process.env.JWT_SECRET || 'supersecretkey';
export const JWT_SECRET = rawSecret.trim();

export function debugSecret() {
  if (process.env.DEBUG_AUTH === 'true') {
    console.log('[DEBUG][JWT] Secret length:', JWT_SECRET.length);
  }
}
