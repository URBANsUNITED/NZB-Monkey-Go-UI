FROM node:20-slim

ARG APP_VERSION=0.2.1
ENV APP_VERSION=${APP_VERSION}

# Grundpakete
RUN apt-get update && apt-get install -y \
    curl wget unzip nano ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# nzb-monkey-go installieren
WORKDIR /opt
RUN wget https://github.com/Tensai75/nzb-monkey-go/releases/download/v${APP_VERSION}/nzb-monkey-go_v${APP_VERSION}-linux-amd64.zip \
    && unzip nzb-monkey-go_v${APP_VERSION}-linux-amd64.zip \
    && rm nzb-monkey-go_v${APP_VERSION}-linux-amd64.zip \
    && mv nzb-monkey-go /usr/bin/nzb-monkey-go \
    && chmod +x /usr/bin/nzb-monkey-go

# App-Verzeichnis
WORKDIR /app

# Dependencies installieren
COPY package.json ./package.json
RUN npm install --production RUN npm install xterm xterm-addon-fit


# Zielstruktur anlegen
RUN mkdir -p src/server \
    && mkdir -p src/parser \
    && mkdir -p src/config \
    && mkdir -p public

# Backend (aus Root kopieren)
COPY index.js ./src/server/index.js
COPY terminal.js ./src/server/terminal.js
COPY config.js ./src/server/config.js

# Parser (aus Root kopieren)
COPY forum.js ./src/parser/forum.js
COPY parser.js ./src/parser/parser.js

# Config (aus Root kopieren)
COPY flags.json ./src/config/flags.json
COPY settings.json ./src/config/settings.json

# Frontend (aus Root kopieren)
COPY index.html ./public/index.html
COPY styles.css ./public/styles.css
COPY app.js ./public/app.js
COPY parser-client.js ./public/parser-client.js

EXPOSE 3000
CMD ["node", "src/server/index.js"]
