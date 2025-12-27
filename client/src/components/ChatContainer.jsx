import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import Logout from "./Logout";
import { FaUserPlus } from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { sendMessageRoute, getAllMessagesRoute, markReadRoute, addGroupMessageRoute, getGroupMessagesRoute, markGroupReadRoute, addCommunityMessageRoute, getCommunityMessagesRoute, markCommunityReadRoute } from "../utils/APIRoutes";

import GroupDetails from "./GroupDetails";
import CommunityDetails from "./CommunityDetails";

export default function ChatContainer({ currentChat, socket, refreshContacts, onLeave }) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [showCommunityDetails, setShowCommunityDetails] = useState(false);
  const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    const fetchUser = async () => {
      const data = await JSON.parse(localStorage.getItem("chat-app-user"));
      setCurrentUser(data);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const data = await JSON.parse(
        localStorage.getItem("chat-app-user")
      );

      if (currentChat.isCommunity) {
        const response = await axios.post(getCommunityMessagesRoute, {
          communityId: currentChat._id,
          userId: data._id
        });
        setMessages(response.data);

        await axios.post(markCommunityReadRoute, {
          communityId: currentChat._id,
          userId: data._id
        });
        refreshContacts();

        socket.current.emit("join-community", currentChat._id);
      } else if (currentChat.isGroup) {
        const response = await axios.post(getGroupMessagesRoute, {
          groupId: currentChat._id,
          userId: data._id
        });
        // Map response to match state structure if needed, but backend should return compatible structure
        const formattedMessages = response.data.map(msg => ({
          ...msg,
          fromSelf: (msg.senderId?._id || msg.senderId)?.toString() === data._id
        }));
        setMessages(formattedMessages);

        // Mark group as read
        await axios.post(markGroupReadRoute, {
          groupId: currentChat._id,
          userId: data._id
        });
        refreshContacts();

        socket.current.emit("join-group", currentChat._id);
      } else {
        const response = await axios.post(getAllMessagesRoute, {
          from: data._id,
          to: currentChat._id,
        });
        setMessages(response.data);

        // Mark as read
        await axios.post(markReadRoute, {
          from: currentChat._id,
          to: data._id
        });
        refreshContacts();
      }
    };
    if (currentChat) {
      fetchData();
    }
  }, [currentChat]);

  useEffect(() => {
    const getCurrentChat = async () => {
      if (currentChat) {
        await JSON.parse(
          localStorage.getItem("chat-app-user")
        );
      }
    };
    getCurrentChat();
  }, [currentChat]);

  const handleSendMsg = async (msg, type = 'text', fileUrl = null, fileName = null) => {
    const data = await JSON.parse(
      localStorage.getItem("chat-app-user")
    );
    const createdAt = new Date().toISOString();

    if (currentChat.isCommunity) {
      socket.current.emit("send-community-msg", {
        communityId: currentChat._id,
        from: data._id,
        senderName: data.name,
        senderAvatar: data.avatar,
        msg,
        messageType: type,
        fileUrl,
        fileName,
        createdAt
      });
      await axios.post(addCommunityMessageRoute, {
        from: data._id,
        communityId: currentChat._id,
        message: msg,
        messageType: type,
        fileUrl,
        fileName
      });
    } else if (currentChat.isGroup) {
      socket.current.emit("send-group-msg", {
        groupId: currentChat._id,
        from: data._id,
        senderName: data.name,
        senderAvatar: data.avatar,
        msg,
        messageType: type,
        fileUrl,
        fileName,
        createdAt
      });
      await axios.post(addGroupMessageRoute, {
        from: data._id,
        groupId: currentChat._id,
        message: msg,
        messageType: type,
        fileUrl,
        fileName
      });
    } else {
      socket.current.emit("send-msg", {
        to: currentChat._id,
        from: data._id,
        msg,
        messageType: type,
        fileUrl,
        fileName,
        createdAt
      });
      await axios.post(sendMessageRoute, {
        from: data._id,
        to: currentChat._id,
        message: msg,
        messageType: type,
        fileUrl,
        fileName
      });
    }

    const msgs = [...messages];
    msgs.push({
      fromSelf: true,
      message: msg,
      messageType: type,
      fileUrl,
      fileName,
      createdAt,
      read: false
    });
    setMessages(msgs);
    if (!currentChat.isGroup) refreshContacts();
  };

  useEffect(() => {
    const socketCopy = socket.current;
    if (socketCopy) {
      socketCopy.on("msg-recieve", (data) => {
        setArrivalMessage({
          fromSelf: false,
          message: data.msg,
          messageType: data.messageType,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          createdAt: data.createdAt || new Date().toISOString()
        });
      });

      socketCopy.on("group-msg-recieve", (data) => {
        if (currentChat && currentChat._id.toString() === data.groupId.toString()) {
          setArrivalMessage({
            fromSelf: data.from.toString() === currentUser?._id,
            senderId: data.from,
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            message: data.msg,
            messageType: data.messageType,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      });

      socketCopy.on("community-msg-recieve", (data) => {
        if (currentChat && currentChat._id.toString() === data.communityId.toString()) {
          setArrivalMessage({
            fromSelf: data.from.toString() === currentUser?._id,
            senderId: data.from,
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            message: data.msg,
            messageType: data.messageType,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      });

      return () => {
        socketCopy.off("msg-recieve");
        socketCopy.off("group-msg-recieve");
        socketCopy.off("community-msg-recieve");
      };
    }
  }, [currentChat, currentUser]);

  useEffect(() => {
    arrivalMessage && setMessages((prev) => [...prev, arrivalMessage]);
  }, [arrivalMessage]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const renderMessageContent = (message) => {
    switch (message.messageType) {
      case "image":
        return <img src={message.fileUrl} alt={message.fileName} style={{ maxWidth: "100%", borderRadius: "0.5rem" }} />;
      case "video":
        return <video src={message.fileUrl} controls style={{ maxWidth: "100%", borderRadius: "0.5rem" }} />;
      case "document":
        return (
          <a href={message.fileUrl} download={message.fileName} style={{ color: "#9a86f3", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📄</span> {message.fileName}
          </a>
        );
      default:
        return <span>{message.message}</span>;
    }
  };

  return (
    <Container>
      <div className="chat-header">
        <div className="user-details" onClick={() => {
          if (currentChat.isGroup) setShowGroupDetails(true);
          if (currentChat.isCommunity) setShowCommunityDetails(true);
        }} style={{ cursor: (currentChat.isGroup || currentChat.isCommunity) ? "pointer" : "default" }}>
          <div className="avatar">
            <img
              src={currentChat.avatar || (currentChat.avatarImage ? `data:image/svg+xml;base64,${currentChat.avatarImage}` : "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png")}
              alt=""
            />
          </div>
          <div className="username">
            <h3>{currentChat.name || currentChat.username}</h3>
          </div>
        </div>
        {currentChat.isGroup && currentChat.admins?.some(id => (id._id || id).toString() === currentUser?._id) && (
          <button className="add-member-btn" onClick={() => setShowGroupDetails(true)}>
            <FaUserPlus /> Add Members
          </button>
        )}
      </div>
      <div className="chat-messages">
        {messages.map((message, index) => {
          if (message.messageType === "system") {
            return (
              <div ref={scrollRef} key={uuidv4()} className="system-message">
                <span>
                  {message.senderId?.toString() === currentUser?._id?.toString() ? "You" : message.senderName} {message.message}
                </span>
              </div>
            );
          }

          const showSenderInfo = currentChat.isGroup && !message.fromSelf && (
            index === 0 || messages[index - 1]?.senderId?.toString() !== message.senderId?.toString()
          );

          return (
            <div ref={scrollRef} key={uuidv4()}>
              <div
                className={`message ${message.fromSelf ? "sended" : "recieved"} ${currentChat.isGroup && !message.fromSelf && !showSenderInfo ? "group-consecutive" : ""
                  }`}
              >
                {showSenderInfo && (
                  <div className="sender-avatar">
                    <img
                      src={message.senderAvatar ? (message.senderAvatar.startsWith("data:") ? message.senderAvatar : `data:image/svg+xml;base64,${message.senderAvatar}`) : "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                      alt=""
                    />
                  </div>
                )}
                <div className="content">
                  {showSenderInfo && <span className="sender-name">{message.senderName}</span>}
                  <div className="text-container">
                    {renderMessageContent(message)}
                  </div>
                  <span className="timestamp">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {message.fromSelf && (
                      <span className={`ticks ${message.read ? "read" : ""}`}>
                        ✓✓
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <ChatInput handleSendMsg={handleSendMsg} />
      {showGroupDetails && (
        <GroupDetails
          group={currentChat}
          currentUser={currentUser}
          socket={socket}
          onClose={() => setShowGroupDetails(false)}
          refreshGroup={onLeave}
        />
      )}
      {showCommunityDetails && (
        <CommunityDetails
          community={currentChat}
          currentUser={currentUser}
          onClose={() => setShowCommunityDetails(false)}
          refreshCommunities={onLeave}
        />
      )}
    </Container>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  gap: 0.1rem;
  overflow: hidden;
  @media screen and (min-width: 720px) and (max-width: 1080px) {
    grid-template-rows: 15% 70% 15%;
  }
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
    .user-details {
      display: flex;
      align-items: center;
      gap: 1rem;
      .avatar {
        img {
          height: 3rem;
          width: 3rem;
          border-radius: 50%;
          object-fit: cover;
        }
      }
      .username {
        display: flex;
        flex-direction: column;
        h3 {
          color: white;
        }
      }
    }
    .add-member-btn {
      background-color: #4e0eff;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: bold;
      transition: 0.3s ease-in-out;
      &:hover {
        background-color: #9a86f3;
      }
    }
  }
  .chat-messages {
    padding: 0.5rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    overflow: auto;
    background-image: linear-gradient(to right bottom, #080420, #0d0d30);
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }
    .message {
      display: flex;
      flex-direction: row; // Changed to row to align avatar and bubble
      align-items: flex-start;
      gap: 0.5rem;
      .sender-avatar {
          img {
              width: 2rem;
              height: 2rem;
              border-radius: 50%;
              object-fit: cover;
          }
      }
      .content {
        width: fit-content;
        max-width: 65%;
        overflow-wrap: break-word;
        padding: 0.5rem 0.8rem;
        font-size: 0.9rem;
        border-radius: 0.5rem;
        color: #d1d1d1;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        position: relative;
        display: flex;
        flex-direction: column;
        
        @media screen and (min-width: 720px) and (max-width: 1080px) {
          max-width: 85%;
        }
        .sender-name {
            color: #ff9f6f; // Orange/Peach color
            font-weight: bold;
            font-size: 0.8rem;
            margin-bottom: 0.2rem;
        }
        .text-container {
          display: inline;
          word-break: break-word;
        }
        .timestamp {
          font-size: 0.65rem;
          color: #999;
          align-self: flex-end;
          margin-top: 0.2rem;
          line-height: 1;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          .ticks {
            font-size: 0.7rem;
            &.read {
              color: #34b7f1;
            }
          }
        }
      }
    }
    .sended {
      justify-content: flex-end;
      .content {
        background: linear-gradient(to right, #4f04ff, #9a86f3);
        color: white;
        border-top-right-radius: 0;
      }
    }
    .recieved {
      justify-content: flex-start;
      .content {
        background: #202c33;
        border-top-left-radius: 0;
      }
      &.group-consecutive {
          margin-left: 2.5rem; // 2rem avatar width + 0.5rem gap
          .content {
              border-top-left-radius: 0.5rem; // Restore radius for consecutive messages
          }
      }
    }
    .system-message {
      display: flex;
      justify-content: center;
      margin: 1rem 0;
      span {
        background-color: #111b21;
        color: #8696a0;
        padding: 0.3rem 0.8rem;
        border-radius: 0.5rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05rem;
        box-shadow: 0 1px 1px rgba(0,0,0,0.2);
        text-align: center;
      }
    }
  }
`;
