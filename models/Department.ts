import mongoose, { Schema } from "mongoose";

const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true },
    path: { type: String, required: true, unique: true },
    parentPath: { type: String, default: "" },
    headId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

DepartmentSchema.index({ path: 1 });

export default mongoose.models.Department ||
  mongoose.model("Department", DepartmentSchema);
