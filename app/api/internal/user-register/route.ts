import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { validateN8nSecret } from "@/lib/n8n-auth";
import User from "@/models/User";

export async function POST(request: Request) {
  if (!validateN8nSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: {
    telegramId?: unknown;
    name?: unknown;
    username?: unknown;
    avatarUrl?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const telegramId =
    typeof body.telegramId === "number"
      ? body.telegramId
      : typeof body.telegramId === "string"
        ? Number.parseInt(body.telegramId, 10)
        : NaN;

  if (!Number.isFinite(telegramId)) {
    return NextResponse.json(
      { success: false, error: "telegramId is required" },
      { status: 400 },
    );
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { success: false, error: "name is required" },
      { status: 400 },
    );
  }

  const username =
    typeof body.username === "string" ? body.username : undefined;
  const avatarUrl =
    typeof body.avatarUrl === "string" ? body.avatarUrl : undefined;

  await connectDB();

  const existing = await User.findOne({ telegramId }).select("_id").lean();
  const isNew = !existing;

  const user = await User.findOneAndUpdate(
    { telegramId },
    {
      $set: {
        telegramId,
        name: body.name.trim(),
        username,
        avatarUrl,
      },
    },
    { upsert: true, new: true, runValidators: true },
  ).lean();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Failed to create or load user" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      ...user,
      _id: String(user._id),
    },
    isNew,
  });
}
