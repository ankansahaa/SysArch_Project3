FROM docker.io/library/node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_SIMULATOR_BACKEND_URL=http://localhost:9000
ARG VITE_SIMULATOR_DEBUG=false
ENV VITE_SIMULATOR_BACKEND_URL=$VITE_SIMULATOR_BACKEND_URL
ENV VITE_SIMULATOR_DEBUG=$VITE_SIMULATOR_DEBUG

RUN npm run build

FROM docker.io/library/nginx:mainline-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]