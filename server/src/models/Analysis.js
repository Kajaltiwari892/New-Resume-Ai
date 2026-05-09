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

// Legacy simple issue (kept for backward compat)
const IssueSchema = new Schema(
  {
    id: { type: String },
    severity: { type: String, enum: ["Critical", "Moderate", "Minor"], required: true },
    category: { type: String },
    title: { type: String, required: true },
    body: { type: String },
    // FAANG enriched fields
    description: { type: String },
    original_text: { type: String },
    location: { type: String },
    fix_instruction: { type: String },
    example_fix: { type: String },
  },
  { _id: false },
);

const DimensionScoreSchema = new Schema(
  {
    score: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  { _id: false },
);

const PositiveSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
  },
  { _id: false },
);

const AnalysisSchema = new Schema(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    overallScore: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, enum: ["A", "B", "C", "D", "F"], default: null },
    verdict: { type: String, default: null },
    bars: { type: [BarSchema], default: [] },
    issues: { type: [IssueSchema], default: [] },
    wins: { type: [String], default: [] },
    // FAANG enriched fields
    dimensionScores: {
      type: {
        impact_quantification: DimensionScoreSchema,
        action_verbs: DimensionScoreSchema,
        bullet_quality: DimensionScoreSchema,
        ats_keywords: DimensionScoreSchema,
        leadership_scope: DimensionScoreSchema,
        formatting: DimensionScoreSchema,
        summary: DimensionScoreSchema,
        projects: DimensionScoreSchema,
      },
      default: null,
    },
    positives: { type: [PositiveSchema], default: [] },
    top3Priorities: { type: [String], default: [] },
    interviewRedFlags: { type: [String], default: [] },
    atsPassProbability: { type: String, enum: ["low", "medium", "high"], default: null },
    estimatedInterviewRate: { type: String, default: null },
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
