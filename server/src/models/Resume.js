import mongoose from "mongoose";

const { Schema } = mongoose;

const SectionsSchema = new Schema(
  {
    summary: { type: String, default: "" },
    experience: { type: String, default: "" },
    skills: { type: String, default: "" },
    education: { type: String, default: "" },
  },
  { _id: false },
);

const ResumeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    source: { type: String, enum: ["file", "paste"], required: true },
    mimeType: { type: String, default: "" },
    rawText: { type: String, default: "" },
    fileData: { type: Buffer, default: null, select: false },
    hasFile: { type: Boolean, default: false },
    sections: { type: SectionsSchema, default: () => ({}) },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.fileData;
        return ret;
      },
    },
  },
);

ResumeSchema.index({ userId: 1, updatedAt: -1 });

export const Resume = mongoose.model("Resume", ResumeSchema);
