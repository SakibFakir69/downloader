

# Use official Node.js image
FROM node:20

# Install Python3, curl, and yt-dlp
RUN apt-get update && \
    apt-get install -y python3 curl && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy all source files
COPY . .

# Expose port
EXPOSE 5000

# Start the app
CMD ["node", "index.js"]
