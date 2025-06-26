# Use official Node.js base image
FROM node:20

# Install Python, curl, and yt-dlp
RUN apt-get update && \
    apt-get install -y python3 curl && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp


# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy all files
COPY . .

# Expose port (optional)
EXPOSE 5000

# Start app
CMD ["node", "index.js"]
