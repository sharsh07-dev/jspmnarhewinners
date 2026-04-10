const mongoose = require('mongoose');

const deviceConfigSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  mode: { type: String, enum: ['AUTO', 'MANUAL'], default: 'AUTO' },
  motorOverride: { type: Boolean, default: false }, // for manual mode
  moistureThreshold: { type: Number, default: 30 }, // below this, turn ON motor
  maxRuntimeLimitMinutes: { type: Number, default: 60 } // prevent dry run/overwatering
});

module.exports = mongoose.model('DeviceConfig', deviceConfigSchema);
