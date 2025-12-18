# web/Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code & export the standard port
COPY . .
EXPOSE 3000

# Start the dev server
CMD ["npm", "run", "dev"]