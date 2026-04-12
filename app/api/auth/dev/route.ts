import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { signJWT } from "@/lib/auth";
import User from "@/models/User";

/** Stable ID so the same dev user is reused across sessions. */
const DEV_TELEGRAM_ID = 999_000_001;

/**
 * Local development only: returns a JWT + user without Telegram initData.
 * Disabled in production builds.
 */
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await connectDB();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return NextResponse.json(
      { error: `Cannot connect to MongoDB: ${msg}` },
      { status: 503 },
    );
  }

  let user = await User.findOne({ telegramId: DEV_TELEGRAM_ID });
  if (!user) {
    user = await User.create({
      telegramId: DEV_TELEGRAM_ID,
      name: "Local Dev",
      role: "admin",
      departmentPath: "",
    });
  }

  const token = signJWT({
    userId: String(user._id),
    telegramId: user.telegramId,
    role: user.role,
  });

  const doc = user.toObject();
  return NextResponse.json({
    token,
    user: {
      ...doc,
      _id: String(doc._id),
    },
  });
}
