"""WebSocket connection manager for live telemetry streaming."""
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.info(f"Client connected to channel: {channel}")

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
        logger.info(f"Client disconnected from channel: {channel}")

    async def broadcast(self, channel: str, data: dict):
        if channel not in self.active_connections:
            return
        message = json.dumps(data)
        dead = set()
        for ws in self.active_connections[channel]:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active_connections[channel].discard(ws)

    async def broadcast_all(self, data: dict):
        for channel in list(self.active_connections.keys()):
            await self.broadcast(channel, data)


ws_manager = WebSocketManager()
