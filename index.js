require('dotenv').config();
const express = require('express');
const redis = require('redis');
const path = require("path");
const fs = require('fs');
const helmet = require("helmet");
const app = express();
const port = process.env.PORT || 5000;
const { limiter } = require('./middleware/limitter');
const ytdlp = require('yt-dlp-exec');


const { Redis } = require("@upstash/redis");

const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});



// Connect Redis (wrap in async function)
redisClient.ping().then(() => {
  console.log("✅ Connected to Upstash Redis");
}).catch(console.error);



// middleware
app.use(limiter);
app.use(express.json());
app.use(helmet());

// stroage

const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

// TikTok downloader endpoint
app.get('/download', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ success: false, message: "URL is required" });
  }

  // Validate URL format
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ success: false, message: "Invalid URL format" });
  }

  // Allow only TikTok URLs
  if (!parsedUrl.hostname.includes('tiktok.com')) {
    return res.status(400).json({ success: false, message: "Only TikTok URLs are allowed" });
  }

  const cacheKey = `download:${url}`;
  try {
    // Check if already downloaded
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for: ${url}`);
      return res.status(200).json({ success: true, message: "Download served from cache" });
    }

    // Command to download video (best format)
    const cmd = `yt-dlp -f "best" -o "${downloadDir}/%(title)s.%(ext)s" "${url}"`;
    //  `yt-dlp -f "best" -o "%(title)s.%(ext)s" "${url}"`;


    // Run the yt-dlp command
    // exec(cmd, async (err, stdout, stderr) => {
    //   if (err) {
    //     console.error("❌ Download error:", err);
    //     return res.status(500).json({
    //       success: false,
    //       message: "Download failed",
    //       error: stderr,
    //     });
    //   }

    //   console.log("✅ Download complete:\n", stdout);

    //   // Set Redis cache for this URL (24 hours)
    //   await redisClient.set(cacheKey, "downloaded", { EX: 60 * 60 * 24 });

    //   res.status(200).json({ success: true, message: "Download completed" });
    // });


    ytdlp(url, {
      output: `${downloadDir}/%(title)s.%(ext)s`,
      format: 'best',
    }).then(async () => {
      console.log("✅ Download complete");

      // Cache result
      await redisClient.set(cacheKey, "downloaded", { ex: 60 * 60 * 24 });

      res.status(200).json({ success: true, message: "Download completed" });
    }).catch(err => {
      console.error("❌ Download error:", err);
      res.status(500).json({
        success: false,
        message: "Download failed",
        error: err.message,
      });
    });


  } catch (err) {
    console.error("❌ Server error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send("🎉 TikTok Downloader Backend is running!");
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
