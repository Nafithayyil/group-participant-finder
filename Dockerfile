# Multi-stage build: compile the frontend, compile the backend, then ship a
# single small runtime image that serves both (backend serves the built
# frontend as static files) — one container to deploy and keep alive.

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM node:20-alpine AS backend-build
WORKDIR /app/backend
# Baileys pulls libsignal from a git URL, so npm needs git in the image.
RUN apk add --no-cache git
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY --from=backend-build /app/backend/package*.json ./
RUN npm install --omit=dev
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
