

const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	limit: 5, // Limit each IP to 5 requests per 1 minute
	standardHeaders: 'draft-8', // Use RateLimit headers
	legacyHeaders: false, // Disable X-RateLimit-* headers
	// store: ... , // You can add Redis store here for distributed rate limiting
});

module.exports = { limiter };
