import mongoose from "mongoose";

const { Schema } = mongoose;

const InterviewQuestionSchema = new Schema(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    group: {
      type: String,
      enum: ["Behavioral", "Technical", "Role-Specific", "Culture Fit", "Resume-Based"],
      required: true,
    },
    text: { type: String, required: true },
    answer: { type: String, default: "" },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    ready: { type: Boolean, default: false },
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

InterviewQuestionSchema.index({ resumeId: 1, createdAt: -1 });

export const InterviewQuestion = mongoose.model("InterviewQuestion", InterviewQuestionSchema);
