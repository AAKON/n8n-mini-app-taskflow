import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { signJWT } from "@/lib/auth";
import { parseTelegramUser, validateTelegramInitData } from "@/lib/telegram";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { initData?: unknown };
    const initData = body.initData;

    if (typeof initData !== "string" || !initData.trim()) {
      return NextResponse.json(
        { success: false, error: "initData is required" },
        { status: 400 },
      );
    }

    if (!validateTelegramInitData(initData)) {
      return NextResponse.json(
        { success: false, error: "Invalid init data" },
        { status: 401 },
      );
    }

    let tgUser;
    try {
      tgUser = parseTelegramUser(initData);
    } catch {
      return NextResponse.json(
        { success: false, error: "Could not parse Telegram user" },
        { status: 400 },
      );
    }

    await connectDB();

    const name =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim() ||
      tgUser.first_name;

    const user = await User.findOneAndUpdate(
      { telegramId: tgUser.id },
      {
        $set: {
          telegramId: tgUser.id,
          name,
          username: tgUser.username,
          avatarUrl: tgUser.photo_url,
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

    const token = signJWT({
      userId: String(user._id),
      telegramId: user.telegramId,
      role: user.role,
    });

    return NextResponse.json({
      token,
      user: {
        ...user,
        _id: String(user._id),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
