import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import User from "@/models/User";
import type { IUser, Role } from "@/types";
import type { PaginationMeta } from "@/types/api";

export type AuthedRouteContext = {
  params?: Record<string, string | string[]>;
};

function leanUserToIUser(doc: {
  _id: unknown;
  telegramId: number;
  name: string;
  username?: string;
  avatarUrl?: string;
  role: string;
  departmentPath: string;
  createdAt: Date;
  updatedAt: Date;
}): IUser {
  return {
    _id: String(doc._id),
    telegramId: doc.telegramId,
    name: doc.name,
    username: doc.username,
    avatarUrl: doc.avatarUrl,
    role: doc.role as Role,
    departmentPath: doc.departmentPath,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function apiResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function apiPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  status = 200,
): NextResponse {
  return NextResponse.json({ success: true, data, pagination }, { status });
}

/**
 * Wraps a route handler with JWT auth and loads the full user from MongoDB.
 * Usage: `export const GET = withAuth(async (req, user) => { ... })`
 * Dynamic routes: `withAuth(async (req, user, ctx) => { ... ctx.params })`
 */
export function withAuth(
  handler: (
    req: Request,
    user: IUser,
    context: AuthedRouteContext,
  ) => Promise<Response>,
): (req: Request, context: AuthedRouteContext) => Promise<Response> {
  return async (req: Request, context: AuthedRouteContext) => {
    await connectDB();

    const payload = getAuthUser(req);
    if (!payload) {
      return apiError("Unauthorized", 401);
    }

    const doc = await User.findById(payload.userId).lean();
    if (!doc) {
      return apiError("Unauthorized", 401);
    }

    const user = leanUserToIUser(doc);

    return handler(req, user, context ?? {});
  };
}
