FROM node:20-alpine
WORKDIR /app
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN cd backend && npm install --no-audit --no-fund --no-package-lock \
 && cd ../frontend && npm install --no-audit --no-fund --no-package-lock
COPY backend ./backend
COPY frontend ./frontend
RUN cd frontend && npm run build
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "cd backend && exec npm start"]
