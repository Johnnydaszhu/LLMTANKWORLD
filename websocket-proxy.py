#!/usr/bin/env python3
"""
StepFun Realtime API WebSocket Proxy
This proxy handles WebSocket connections to StepFun's realtime API,
solving CORS issues and securely handling API keys.
"""

import asyncio
import json
import logging
import websockets
from urllib.parse import parse_qs
from collections import defaultdict
from http import HTTPStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store active connections
active_connections = defaultdict(set)

async def handle_websocket(websocket, path):
    """Handle WebSocket connections"""
    try:
        # Extract API key from query parameters
        query = parse_qs(path.split('?')[1] if '?' in path else '')
        api_key = query.get('api_key', [None])[0]
        
        if not api_key:
            await websocket.close(code=4000, reason="API key required")
            return
        
        logger.info(f"New WebSocket connection from {websocket.remote_address}")
        
        # Connect to StepFun's WebSocket
        stepfun_uri = "wss://api.stepfun.com/v1/realtime"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        
        logger.info(f"Connecting to StepFun: {stepfun_uri}")
        
        try:
            logger.info(f"Attempting to connect to StepFun with headers: {headers}")
            stepfun_ws = await websockets.connect(stepfun_uri, extra_headers=headers)
            logger.info("Connected to StepFun successfully")
        except websockets.exceptions.InvalidStatusCode as e:
            logger.error(f"StepFun connection failed with status {e.status_code}: {e}")
            await websocket.close(code=1011, reason=f"StepFun connection failed: {e.status_code}")
            return
        except Exception as e:
            logger.error(f"Failed to connect to StepFun: {type(e).__name__}: {e}")
            await websocket.close(code=1011, reason=f"StepFun connection failed: {e}")
            return
        
        async with stepfun_ws:
            # Create bidirectional proxy
            async def forward_to_client():
                async for message in stepfun_ws:
                    logger.info(f"Received from StepFun: {message[:200]}...")
                    await websocket.send(message)
            
            async def forward_to_stepfun():
                async for message in websocket:
                    logger.info(f"Forwarding to StepFun: {message[:200]}...")
                    await stepfun_ws.send(message)
            
            # Run both directions concurrently
            await asyncio.gather(
                forward_to_client(),
                forward_to_stepfun(),
                return_exceptions=True
            )
            
    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason=str(e))

async def health_check(path, request_headers):
    """Handle health check requests"""
    if path == "/health":
        return HTTPStatus.OK, [], b"OK"
    return None

async def main():
    """Start the WebSocket proxy server"""
    host = "localhost"
    port = 8765
    
    logger.info(f"Starting WebSocket proxy on {host}:{port}")
    logger.info("StepFun Realtime API Proxy is running")
    logger.info(f"Connect to: ws://{host}:{port}/realtime?api_key=YOUR_API_KEY")
    
    # Start WebSocket server
    async with websockets.serve(
        handle_websocket,
        host,
        port,
        process_request=health_check
    ):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped")