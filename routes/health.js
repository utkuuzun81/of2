import express from 'express';
import os from 'os';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpuLoad: os.loadavg(),
    dbStatus,
    timestamp: new Date().toISOString()
  });
});

export default router;
