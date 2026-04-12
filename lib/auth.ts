import jwt from "jsonwebtoken";

export type AuthJwtPayload = {
  userId: string;
  telegramId: number;
  role: string;
};

export function signJWT(payload: {
  userId: string;
  telegramId: number;
  role: string;
}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyJWT(token: string): AuthJwtPayload | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const decoded = jwt.verify(token, secret);
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof (decoded as AuthJwtPayload).userId !== "string" ||
      typeof (decoded as AuthJwtPayload).telegramId !== "number" ||
      typeof (decoded as AuthJwtPayload).role !== "string"
    ) {
      return null;
    }
    return decoded as AuthJwtPayload;
  } catch {
    return null;
  }
}

export function getAuthUser(request: Request): AuthJwtPayload | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  if (!token) return null;
  return verifyJWT(token);
}
