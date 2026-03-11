FROM node:20-alpine AS base
WORKDIR /app/server
COPY server/package*.json ./

FROM base AS development
RUN npm install
COPY server ./
COPY proto /app/proto
EXPOSE 3001
CMD ["npm", "run", "dev"]

FROM base AS production-deps
RUN npm install --omit=dev

FROM node:20-alpine AS production
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=production-deps /app/server/node_modules ./node_modules
COPY server ./
COPY proto /app/proto
EXPOSE 3001
CMD ["npm", "run", "start"]
