import { Profile } from "../models/Profile.js";

export async function getOnboarding(req, res) {
  const profile = await Profile.findOne({ userId: req.user._id });
  res.json({ profile: profile || null });
}

export async function saveOnboarding(req, res) {
  const allowed = [
    "fullName",
    "jobTitle",
    "experienceLevel",
    "industry",
    "targetRole",
    "dreamCompanies",
    "careerSwitch",
    "previousField",
    "resumeType",
    "priorities",
    "primaryGoal",
  ];
  const update = {};
  for (const key of allowed) {
    if (key in req.body) update[key] = req.body[key];
  }

  // Merge with existing profile to evaluate completeness across multiple PUTs.
  const existing = await Profile.findOne({ userId: req.user._id }).lean();
  const merged = { ...(existing || {}), ...update };

  const minimumComplete =
    Boolean(merged.experienceLevel) &&
    Boolean((merged.targetRole || "").trim()) &&
    Boolean(merged.primaryGoal);

  if (minimumComplete) update.onboardingCompleted = true;

  const profile = await Profile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ profile });
}
