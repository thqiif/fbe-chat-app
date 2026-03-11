FROM node:20-alpine AS base
WORKDIR /app/client
COPY client/package*.json ./

FROM base AS development
RUN npm install
COPY client ./
COPY proto /app/proto
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm install
COPY client ./
COPY proto /app/proto
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY proto /app/proto
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
