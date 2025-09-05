# Live Polling Server

Express + Socket.IO backend.

## Quick Start

```bash
cp .env.example .env
npm i
npm run start
```

## Environment Variables

- `PORT`: Port to run the server on (default: 4000)
- `ORIGIN`: CORS origin(s) allowed to connect (comma-separated for multiple)
- `TEACHER_SECRET`: Secret key for teacher authentication

## Deploy to Render

This service is configured for deployment via the root `render.yaml` file. See the main README for detailed instructions.