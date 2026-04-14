import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import type { IUser } from "@/types";

export type UpsertUserInput = {
  telegramId: number;
  name: string;
  username?: string;
  avatarUrl?: string;
};

export type UpsertUserResult = {
  user: IUser;
  isNew: boolean;
};

export async function upsertUserByTelegramId(
  input: UpsertUserInput,
): Promise<UpsertUserResult> {
  await connectDB();

  const existing = await User.findOne({ telegramId: input.telegramId })
    .select("_id")
    .lean();
  const isNew = !existing;

  const doc = await User.findOneAndUpdate(
    { telegramId: input.telegramId },
    {
      $set: {
        telegramId: input.telegramId,
        name: input.name.trim(),
        username: input.username,
        avatarUrl: input.avatarUrl,
      },
    },
    { upsert: true, new: true, runValidators: true },
  ).lean();

  if (!doc) {
    throw new Error("Failed to create or load user");
  }

  const user: IUser = {
    _id: String(doc._id),
    telegramId: doc.telegramId,
    name: doc.name,
    username: doc.username,
    avatarUrl: doc.avatarUrl,
    role: doc.role,
    departmentPath: doc.departmentPath,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  return { user, isNew };
}
