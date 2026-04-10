require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const FarmData = require('./models/FarmData');
const DeviceConfig = require('./models/DeviceConfig');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const defaultDeviceId = process.env.DEVICE_ID || 'esp32-farm-01';

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfarm', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('MongoDB connected');
  // Initialize default config if not exists
  const config = await DeviceConfig.findOne({ deviceId: defaultDeviceId });
  if (!config) {
    await DeviceConfig.create({ deviceId: defaultDeviceId });
    console.log('Created default device configuration');
  }
}).catch(err => console.error('MongoDB connection error:', err));


// --- API for Frontend ---

// Get current overall status (latest data + config)
app.get('/api/status', async (req, res) => {
  try {
    const config = await DeviceConfig.findOne({ deviceId: defaultDeviceId });
    const latestData = await FarmData.findOne().sort({ timestamp: -1 });
    res.json({ config, latestData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get historical data for charts
app.get('/api/history', async (req, res) => {
  try {
    const data = await FarmData.find().sort({ timestamp: -1 }).limit(100);
    res.json(data.reverse()); // return chronological order
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Mode (AUTO / MANUAL) or Override Motor
app.post('/api/control', async (req, res) => {
  try {
    const { mode, motorOverride, moistureThreshold } = req.body;
    let updateFields = {};
    if (mode !== undefined) updateFields.mode = mode;
    if (motorOverride !== undefined) updateFields.motorOverride = motorOverride;
    if (moistureThreshold !== undefined) updateFields.moistureThreshold = moistureThreshold;

    const config = await DeviceConfig.findOneAndUpdate(
      { deviceId: defaultDeviceId },
      updateFields,
      { new: true }
    );
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API for ESP32 ---

// ESP32 fetches configuration/commands here
app.get('/api/device/config', async (req, res) => {
  try {
    const config = await DeviceConfig.findOne({ deviceId: defaultDeviceId });
    res.json({
      mode: config.mode,
      motorOverride: config.motorOverride,
      moistureThreshold: config.moistureThreshold,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ESP32 posts sensor data here
app.post('/api/device/data', async (req, res) => {
  try {
    const { temperature, humidity, moisture, motorStatus, mode } = req.body;
    
    const newData = await FarmData.create({
      temperature,
      humidity,
      moisture,
      motorStatus,
      mode
    });

    res.json({ success: true, id: newData._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
