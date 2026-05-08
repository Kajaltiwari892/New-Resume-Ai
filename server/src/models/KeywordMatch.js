import mongoose from "mongoose";

const { Schema } = mongoose;

const KeywordMatchSchema = new Schema(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobDescription: { type: String, required: true, maxlength: 20000 },
    found: { type: [String], default: [] },
    missing: { type: [String], default: [] },
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

KeywordMatchSchema.index({ resumeId: 1, createdAt: -1 });

export const KeywordMatch = mongoose.model("KeywordMatch", KeywordMatchSchema);
