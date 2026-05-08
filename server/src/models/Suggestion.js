import mongoose from "mongoose";

const { Schema } = mongoose;

const SuggestionSchema = new Schema(
  {
    analysisId: { type: Schema.Types.ObjectId, ref: "Analysis", required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    section: {
      type: String,
      enum: ["summary", "experience", "skills", "education"],
      required: true,
    },
    old: { type: String, required: true },
    next: { type: String, required: true },
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

SuggestionSchema.index({ resumeId: 1, createdAt: -1 });

export const Suggestion = mongoose.model("Suggestion", SuggestionSchema);
