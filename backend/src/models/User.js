const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    expoPushToken: { type: String, default: null },
    // When this user last opened the notification bell — used to compute
    // their unread count. Null means "never opened it" (everything unread).
    notificationsSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
