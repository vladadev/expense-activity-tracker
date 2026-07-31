const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    // Free-form now — validated against the user-managed Category collection
    // (scope: 'event') at the route level instead of a fixed enum.
    type: { type: String, required: true },
    title: { type: String, required: true },
    notes: { type: String, default: '' },
    // Time of day as a literal "HH:MM" string, or null for an all-day entry.
    // Deliberately NOT a Date: storing a wall-clock time inside a Date drags
    // in timezone conversion (the same trap that shifted our month ranges),
    // whereas "18:00" means 18:00 on every device and server.
    startTime: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        message: 'startTime must be "HH:MM" or null',
      },
    },
    // Manual position among the all-day entries of the same day. Timed
    // entries ignore this — their order comes from startTime itself.
    order: { type: Number, default: 0 },
    reminderEnabled: { type: Boolean, default: false },
    reminderAt: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

eventSchema.index({ date: 1 });
eventSchema.index({ reminderAt: 1, reminderSent: 1 });

module.exports = mongoose.model('Event', eventSchema);
