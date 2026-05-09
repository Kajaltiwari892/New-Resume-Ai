import mongoose from "mongoose";

const { Schema } = mongoose;

const ProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    fullName: { type: String, trim: true, maxlength: 120, default: "" },
    jobTitle: { type: String, trim: true, maxlength: 120, default: "" },
    experienceLevel: {
      type: String,
      enum: ["Fresher", "1-3 yrs", "3-7 yrs", "7+ yrs", ""],
      default: "",
    },
    industry: { type: String, trim: true, maxlength: 80, default: "" },
    targetRole: { type: String, trim: true, maxlength: 120, default: "" },
    dreamCompanies: { type: [String], default: [] },
    careerSwitch: { type: Boolean, default: false },
    previousField: { type: String, trim: true, maxlength: 120, default: "" },
    resumeType: {
      type: String,
      enum: ["Chronological", "Functional", "Hybrid", ""],
      default: "Chronological",
    },
    priorities: { type: [String], default: [] },
    primaryGoal: {
      type: String,
      enum: [
        "Get more interviews",
        "Switch careers",
        "Land first job",
        "Improve resume quality",
        "",
      ],
      default: "",
    },
    onboardingCompleted: { type: Boolean, default: false },
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

export const Profile = mongoose.model("Profile", ProfileSchema);
