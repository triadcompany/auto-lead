FROM node:20-alpine AS builder

WORKDIR /app

# Valores default para produção (sobrescritos por build args se necessário)
ARG VITE_API_URL=https://auto-lead-api.upw28y.easypanel.host
ARG VITE_CLERK_PUBLISHABLE_KEY=pk_test_Z3JhdGVmdWwtcGVsaWNhbi04OC5jbGVyay5hY2NvdW50cy5kZXYk
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ── Serve com nginx ────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
