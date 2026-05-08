import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { env } from "../config/env.js";

const { Schema } = mongoose;

const RefreshTokenSchema = new Schema(
  {
    jti: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true, maxlength: 80 },

    // Never returned in queries — see `select: false`.
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: ["user", "admin"], default: "user" },

    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    refreshTokens: { type: [RefreshTokenSchema], default: [], select: false },

    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },

    passwordChangedAt: { type: Date, default: null },

    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  },
);

UserSchema.virtual("isLocked").get(function () {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

UserSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, env.bcryptRounds);
  this.passwordChangedAt = new Date();
};

UserSchema.methods.comparePassword = function (plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.methods.registerFailedLogin = async function () {
  // If lock expired, reset counter first.
  if (this.lockUntil && this.lockUntil.getTime() <= Date.now()) {
    this.loginAttempts = 0;
    this.lockUntil = null;
  }
  this.loginAttempts += 1;
  if (this.loginAttempts >= env.loginMaxAttempts) {
    this.lockUntil = new Date(Date.now() + env.loginLockMinutes * 60_000);
  }
  await this.save();
};

UserSchema.methods.registerSuccessfulLogin = async function (ip) {
  this.loginAttempts = 0;
  this.lockUntil = null;
  this.lastLoginAt = new Date();
  this.lastLoginIp = ip || null;
  await this.save();
};

export const User = mongoose.model("User", UserSchema);
