require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const ytdlp = require('yt-dlp-exec').exec;
const { Redis } = require('@upstash/redis');
const { limiter } = require('./middleware/limitter');

const app = express();
const port = process.env.PORT || 5000;

// Initialize Redis client
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Verify Redis connection
redisClient.ping().then(() => {
  console.log('✅ Connected to Upstash Redis');
}).catch(err => {
  console.error('❌ Redis connection error:', err);
  process.exit(1);
});

// Verify yt-dlp installation
ytdlp('--version').then(version => {
  console.log(`✅ yt-dlp version: ${version}`);
}).catch(err => {
  console.error('❌ yt-dlp not found or not working. Please install it first.');
  process.exit(1);
});

// Middleware
app.use(express.json());
app.use(helmet());

// Set up downloads directory
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}


app.use(limiter);

// TikTok downloader endpoint
app.get('/download', async (req, res) => {
  try {
    const url = req.query.url;

    // Validate URL
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

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
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for: ${url}`);
      return res.status(200).json({ success: true, message: 'Download served from cache' });
    }

    // Download video
    const result = await ytdlp(url, {
      output: path.join(downloadDir, '%(title)s.%(ext)s'),
      format: 'best',
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
    });

    console.log('✅ Download complete:', result.filename);

    // Cache result for 24 hours
    await redisClient.set(cacheKey, 'downloaded', { ex: 60 * 60 * 24 });

    res.status(200).json({ 
      success: true, 
      message: 'Download completed',
      filename: path.basename(result.filename)
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

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'TikTok Downloader Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
});