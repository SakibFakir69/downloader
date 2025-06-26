require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const { downloadTikTokVideo } = require('easytiktokdl');
const { Redis } = require('@upstash/redis');

const app = express();
const port = process.env.PORT || 5000;

// Initialize Redis client (same as before)
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

redisClient.ping()
  .then(() => console.log('✅ Connected to Upstash Redis'))
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

    // Basic URL validation (add your own logic)
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('tiktok.com')) {
      return res.status(400).json({ success: false, message: 'Only TikTok URLs are allowed' });
    }

    const cacheKey = `download:${url}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for: ${url}`);
      return res.status(200).json({ success: true, message: 'Download served from cache' });
    }

    const outputPath = path.join(downloadDir, `${Date.now()}.mp4`);

    // Use easytiktokdl to download video
    const videoPath = await downloadTikTokVideo(url, outputPath);
    console.log('✅ Download complete:', videoPath);

    await redisClient.set(cacheKey, 'downloaded', { ex: 60 * 60 * 24 });

    res.status(200).json({
      success: true,
      message: 'Download completed',
      filename: path.basename(videoPath),
    });

  } catch (err) {
    console.error('❌ Download error:', err);
    res.status(500).json({
      success: false,
      message: 'Download failed',
      error: err.message,
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
