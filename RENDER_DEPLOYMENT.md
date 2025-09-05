# Live Polling System - Render Deployment Guide

## Prerequisites
1. A Render account (https://render.com)
2. This repository pushed to GitHub

## Deployment Steps

### 1. Deploy the Backend (API Server)

1. Go to https://dashboard.render.com/select-repo?type=web
2. Select your GitHub repository
3. Configure the service:
   - Name: `live-polling-backend` (or any name you prefer)
   - Environment: `Node`
4. Set build command: `npm install --prefix server`
5. Set start command: `npm start --prefix server`
6. Set environment variables:
   - `PORT`: 4000
   - `ORIGIN`: `https://live-polling-frontend.onrender.com` (change this after deploying frontend)
   - `TEACHER_SECRET`: `change-this-secret-key-in-production` (change this to a secure value)
7. Click "Create Web Service"

### 2. Deploy the Frontend (React App)

1. Go to https://dashboard.render.com/select-repo?type=static
2. Select your GitHub repository
3. Configure the service:
   - Name: `live-polling-frontend` (or any name you prefer)
   - Build command: `npm install --prefix client && npm run build --prefix client`
   - Publish directory: `client/dist`
4. Set environment variables:
   - `VITE_SERVER_URL`: `https://live-polling-backend.onrender.com` (change this to your actual backend URL after deployment)
5. Click "Create Static Site"

### 3. Update Environment Variables

After both services are deployed:

1. Update the backend `ORIGIN` environment variable to match your actual frontend URL
2. Update the frontend `VITE_SERVER_URL` environment variable to match your actual backend URL
3. Update the backend `TEACHER_SECRET` to a secure value

### 4. Redeploy Services

After updating environment variables, you'll need to redeploy both services:
1. Go to each service dashboard
2. Click "Manual Deploy" → "Deploy latest commit"

## Notes
- The `.env` file has been committed to the repository for easier deployment
- In production, you should change the `TEACHER_SECRET` to a secure value
- Make sure to update the environment variables with your actual service URLs after deployment