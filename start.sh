#!/bin/sh
# Railway start script - uses PORT env var or defaults to 8080
PORT=${PORT:-8080}
echo "Starting app on port $PORT"
npm run preview -- --host 0.0.0.0 --port $PORT
