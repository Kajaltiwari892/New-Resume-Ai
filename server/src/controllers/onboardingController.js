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
  ];
  const update = {};
  for (const key of allowed) {
    if (key in req.body) update[key] = req.body[key];
  }
  const profile = await Profile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ profile });
}
