import mongoose from "mongoose";

const { Schema } = mongoose;

const ResumeErrorSchema = new Schema(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    section: {
      type: String,
      enum: ["summary", "experience", "skills", "education"],
      required: true,
    },
    line: { type: String, required: true },
    severity: {
      type: String,
      enum: ["Critical", "Moderate", "Minor"],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "grammar",
        "weak-verb",
        "missing-metric",
        "passive-voice",
        "buzzword",
        "formatting",
        "other",
      ],
      required: true,
    },
    reason: { type: String, required: true },
    fix: { type: String, default: null },
    applied: { type: Boolean, default: false },
    appliedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

ResumeErrorSchema.index({ resumeId: 1, createdAt: -1 });

export const ResumeError = mongoose.model("ResumeError", ResumeErrorSchema);
