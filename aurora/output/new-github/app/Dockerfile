FROM node:20-alpine
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend
RUN cd frontend && node -e "const f=require('fs');f.rmSync('dist',{recursive:true,force:true});f.cpSync('src','dist',{recursive:true})"
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "cd backend && exec node server.js"]
