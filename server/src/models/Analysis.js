import mongoose from "mongoose";

const { Schema } = mongoose;

const BarSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const IssueSchema = new Schema(
  {
    severity: { type: String, enum: ["Critical", "Moderate", "Minor"], required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
  },
  { _id: false },
);

const AnalysisSchema = new Schema(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    overallScore: { type: Number, required: true, min: 0, max: 100 },
    bars: { type: [BarSchema], default: [] },
    issues: { type: [IssueSchema], default: [] },
    wins: { type: [String], default: [] },
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

AnalysisSchema.index({ resumeId: 1, createdAt: -1 });

export const Analysis = mongoose.model("Analysis", AnalysisSchema);
