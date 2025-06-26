require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const { Redis } = require('@upstash/redis');

const app = express();
const port = process.env.PORT || 5000;

// Initialize Redis client
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Test Redis connection
redisClient.ping()
  .then(() => {
    console.log('✅ Connected to Upstash Redis');
  })
  .catch(err => {
    console.error('❌ Redis connection error:', err);
    process.exit(1);
  });

app.use(express.json());
app.use(helmet());

const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

app.get('/download', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid URL format' });
    }

    if (!parsedUrl.hostname.includes('tiktok.com')) {
      return res.status(400).json({ success: false, message: 'Only TikTok URLs are allowed' });
    }

    const cacheKey = `download:${url}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for: ${url}`);
      return res.status(200).json({ success: true, message: 'Download served from cache' });
    }

    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');

    // Run yt-dlp CLI directly to get downloaded filename
    const { stdout, stderr } = await execFilePromise('yt-dlp', [
      url,
      '-o', outputTemplate,
      '--print', 'filename',
      '--format', 'best',
      '--no-warnings',
      '--no-call-home',
      '--no-check-certificate',
      '--prefer-free-formats',
    ]);

    const downloadedFilePath = stdout.trim();
    console.log('✅ Download complete:', downloadedFilePath);

    await redisClient.set(cacheKey, 'downloaded', { ex: 60 * 60 * 24 });

    res.status(200).json({
      success: true,
      message: 'Download completed',
      filename: path.basename(downloadedFilePath),
    });

  } catch (err) {
    console.error('❌ Download error:', err);
    res.status(500).json({
      success: false,
      message: 'Download failed',
      error: err.stderr || err.message,
    });
  }
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'TikTok Downloader Backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
});
