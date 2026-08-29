# Gunakan base image Node.js versi LTS
FROM node:20-bookworm

# Set working directory di dalam container
WORKDIR /app

# Copy file konfigurasi package Node.js
COPY package.json ./

# Install dependensi (ini akan menginstall playwright sesuai versi di package.json)
RUN npm install

# Install dependencies sistem operasi yang dibutuhkan browser Playwright
RUN npx playwright install --with-deps chromium

# Copy seluruh file project ke dalam container
COPY . .

# Set Timezone ke Jakarta (Opsional)
ENV TZ=Asia/Jakarta
