const mongoose = require('mongoose');

const farmDataSchema = new mongoose.Schema({
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  moisture: { type: Number, required: true },
  motorStatus: { type: Boolean, required: true },
  mode: { type: String, enum: ['AUTO', 'MANUAL'], default: 'AUTO' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FarmData', farmDataSchema);
