import type { User } from "../../drizzle/schema.js";

export const sdk = {
  authenticateRequest: async (req: any): Promise<User | null> => {
    console.warn("SDK: authenticateRequest mockado. Retornando null.");
    return null;
  },
  createSessionToken: async (userId: string, options: { name: string; expiresInMs: number }): Promise<string> => {
    console.warn(`SDK: createSessionToken mockado para userId: ${userId}`);
    return `mock-session-token-${userId}`;
  },
};

// Adicionando export ausente usado em api/chat-stream.ts
export async function getUserFromRequest(req: any): Promise<User | null> {
  console.warn("getUserFromRequest: mockado. Retornando null.");
  return null;
}
