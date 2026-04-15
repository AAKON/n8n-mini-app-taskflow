import mongoose, { Schema } from "mongoose";

const ROLES = ["admin", "department_head", "manager", "member"] as const;

const UserSchema = new Schema(
  {
    telegramId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    username: String,
    avatarUrl: String,
    role: { type: String, enum: ROLES, default: "member" },
    departmentPath: { type: String, default: "" },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
