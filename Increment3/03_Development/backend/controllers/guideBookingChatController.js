import {
  assertGuideBookingChatAccess,
  createGuideBookingChatMessage,
  getGuideBookingChatMessages,
  getGuideBookingChatRoom,
  listMyGuideBookingChats,
  markGuideBookingChatRead,
} from "../services/guideBookingChatService.js";
import { getSocketIO } from "../realtime/socketRegistry.js";

const emitGuideBookingChatEvent = (room, eventName, payload) => {
  const io = getSocketIO();
  if (!io) return;
  io.to(room).emit(eventName, payload);
};

export const getMyGuideBookingChats = async (req, res) => {
  try {
    const chats = await listMyGuideBookingChats({
      userId: req.user.user_id,
      userType: req.user.user_type,
    });

    return res.status(200).json({ chats });
  } catch (err) {
    console.error("Error fetching guide booking chats:", err);
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Server error fetching booking chats",
    });
  }
};

export const getGuideBookingChatMessagesController = async (req, res) => {
  try {
    const bookingContext = await assertGuideBookingChatAccess({
      bookingId: req.params.bookingId,
      userId: req.user.user_id,
      userType: req.user.user_type,
    });

    const messages = await getGuideBookingChatMessages({
      bookingContext,
      currentUserId: req.user.user_id,
      limit: req.query.limit,
    });

    return res.status(200).json({
      booking: bookingContext,
      messages,
    });
  } catch (err) {
    console.error("Error fetching guide booking chat messages:", err);
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Server error fetching chat messages",
    });
  }
};

export const postGuideBookingChatMessageController = async (req, res) => {
  try {
    const bookingContext = await assertGuideBookingChatAccess({
      bookingId: req.params.bookingId,
      userId: req.user.user_id,
      userType: req.user.user_type,
    });

    const message = await createGuideBookingChatMessage({
      bookingContext,
      senderId: req.user.user_id,
      senderRole: req.user.user_type,
      messageText: req.body?.message,
    });

    emitGuideBookingChatEvent(getGuideBookingChatRoom(bookingContext.booking_id), "chat:message:new", message);

    return res.status(201).json({ message: "Message sent", chat_message: message });
  } catch (err) {
    console.error("Error sending guide booking chat message:", err);
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Server error sending message",
    });
  }
};

export const markGuideBookingChatReadController = async (req, res) => {
  try {
    const bookingContext = await assertGuideBookingChatAccess({
      bookingId: req.params.bookingId,
      userId: req.user.user_id,
      userType: req.user.user_type,
    });

    const readSummary = await markGuideBookingChatRead({
      bookingContext,
      viewerRole: req.user.user_type,
    });

    emitGuideBookingChatEvent(getGuideBookingChatRoom(bookingContext.booking_id), "chat:read:update", readSummary);

    return res.status(200).json({
      message: "Messages marked as read",
      ...readSummary,
    });
  } catch (err) {
    console.error("Error marking guide booking chat messages as read:", err);
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Server error updating read state",
    });
  }
};
