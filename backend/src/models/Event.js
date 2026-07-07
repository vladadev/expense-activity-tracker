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
    reminderEnabled: { type: Boolean, default: false },
    reminderAt: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

eventSchema.index({ date: 1 });
eventSchema.index({ reminderAt: 1, reminderSent: 1 });

module.exports = mongoose.model('Event', eventSchema);
