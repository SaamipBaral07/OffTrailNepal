import app from "./app.js";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { setSocketIO } from "./realtime/socketRegistry.js";
import { setupGuideBookingChatSocket } from "./realtime/guideBookingChatSocket.js";

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000"],
    credentials: true,
  },
});

setSocketIO(io);
setupGuideBookingChatSocket(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
