import jwt from "jsonwebtoken";
import {
  assertGuideBookingChatAccess,
  createGuideBookingChatMessage,
  getGuideBookingChatRoom,
  markGuideBookingChatRead,
} from "../services/guideBookingChatService.js";

const JWT_SECRET = process.env.JWT_SECRET;

const ack = (callback, payload) => {
  if (typeof callback === "function") {
    callback(payload);
  }
};

export const setupGuideBookingChatSocket = (io) => {
  io.use((socket, next) => {
    try {
      const tokenFromAuth = String(socket.handshake?.auth?.token || "").trim();
      const tokenFromHeader = String(socket.handshake?.headers?.authorization || "")
        .replace(/^Bearer\s+/i, "")
        .trim();

      const token = tokenFromAuth || tokenFromHeader;
      if (!token) {
        return next(new Error("No auth token provided"));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.data.user = {
        user_id: decoded.user_id,
        user_type: decoded.user_type,
      };
      return next();
    } catch (_err) {
      return next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("chat:join", async (payload, callback) => {
      try {
        const bookingId = Number.parseInt(payload?.bookingId, 10);

        const bookingContext = await assertGuideBookingChatAccess({
          bookingId,
          userId: socket.data.user.user_id,
          userType: socket.data.user.user_type,
        });

        const room = getGuideBookingChatRoom(bookingContext.booking_id);
        await socket.join(room);

        ack(callback, {
          ok: true,
          booking: bookingContext,
        });
      } catch (err) {
        ack(callback, {
          ok: false,
          message: err?.message || "Unable to join chat room",
          statusCode: err?.statusCode || 500,
        });
      }
    });

    socket.on("chat:message:send", async (payload, callback) => {
      try {
        const bookingId = Number.parseInt(payload?.bookingId, 10);
        const text = payload?.message;

        const bookingContext = await assertGuideBookingChatAccess({
          bookingId,
          userId: socket.data.user.user_id,
          userType: socket.data.user.user_type,
        });

        const message = await createGuideBookingChatMessage({
          bookingContext,
          senderId: socket.data.user.user_id,
          senderRole: socket.data.user.user_type,
          messageText: text,
        });

        const room = getGuideBookingChatRoom(bookingContext.booking_id);
        io.to(room).emit("chat:message:new", message);

        ack(callback, {
          ok: true,
          message,
        });
      } catch (err) {
        ack(callback, {
          ok: false,
          message: err?.message || "Unable to send message",
          statusCode: err?.statusCode || 500,
        });
      }
    });

    socket.on("chat:read", async (payload, callback) => {
      try {
        const bookingId = Number.parseInt(payload?.bookingId, 10);

        const bookingContext = await assertGuideBookingChatAccess({
          bookingId,
          userId: socket.data.user.user_id,
          userType: socket.data.user.user_type,
        });

        const summary = await markGuideBookingChatRead({
          bookingContext,
          viewerRole: socket.data.user.user_type,
        });

        const room = getGuideBookingChatRoom(bookingContext.booking_id);
        io.to(room).emit("chat:read:update", summary);

        ack(callback, {
          ok: true,
          read: summary,
        });
      } catch (err) {
        ack(callback, {
          ok: false,
          message: err?.message || "Unable to update read state",
          statusCode: err?.statusCode || 500,
        });
      }
    });
  });
};
