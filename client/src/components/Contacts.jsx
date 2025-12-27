import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import Logo from "../assets/logo.svg";
import axios from "axios";
import { searchUserRoute, setAvatarRoute, getUserGroupsRoute, createGroupRoute, getAllCommunitiesRoute, createCommunityRoute, joinCommunityRoute, leaveCommunityRoute } from "../utils/APIRoutes";
import { ToastContainer, toast } from "react-toastify";
import Logout from "./Logout";
import { FaPen, FaArrowRight } from "react-icons/fa";

export default function Contacts({ contacts, changeChat, addContact, socket, refreshTrigger }) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentUserImage, setCurrentUserImage] = useState(undefined);
  const [currentUserId, setCurrentUserId] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  const [searchEmail, setSearchEmail] = useState("");
  const [groups, setGroups] = useState([]);
  const [activeTab, setActiveTab] = useState(localStorage.getItem("active-tab") || "chats");
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [communities, setCommunities] = useState([]);
  const [showCreateCommunityModal, setShowCreateCommunityModal] = useState(false);
  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [communityAvatar, setCommunityAvatar] = useState("");
  const inputFile = useRef(null);

  const toastOptions = {
    position: "bottom-right",
    autoClose: 8000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  useEffect(() => {
    const data = JSON.parse(
      localStorage.getItem("chat-app-user")
    );
    if (data) {
      setCurrentUserName(data.name);
      setCurrentUserImage(data.avatar);
      setCurrentUserId(data._id);
    }
  }, []);
  useEffect(() => {
    if (currentUserId) {
      fetchGroups();
      fetchCommunities();
    }
  }, [currentUserId, refreshTrigger]);

  const fetchGroups = async () => {
    if (currentUserId) {
      const { data } = await axios.get(`${getUserGroupsRoute}/${currentUserId}`);
      setGroups(data);
    }
  };

  const fetchCommunities = async () => {
    if (currentUserId) {
      const { data } = await axios.get(`${getAllCommunitiesRoute}/${currentUserId}`);
      setCommunities(data);
    }
  };

  useEffect(() => {
    if (socket.current) {
      socket.current.on("group-msg-recieve", (data) => {
        fetchGroups();
      });
      socket.current.on("community-msg-recieve", (data) => {
        fetchCommunities();
      });
      return () => {
        socket.current.off("group-msg-recieve");
        socket.current.off("community-msg-recieve");
      };
    }
  }, [socket.current, currentUserId]);

  const changeCurrentChat = (index, contact) => {
    setCurrentSelected(index);
    changeChat(contact);
  };

  const handleSearch = async () => {
    if (searchEmail) {
      const { data } = await axios.get(`${searchUserRoute}/${searchEmail}`);
      if (data.status) {
        addContact(data.user);
        setSearchEmail("");
      } else {
        toast.error(data.msg, toastOptions);
      }
    }
  };

  const onButtonClick = () => {
    inputFile.current.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      const user = await JSON.parse(localStorage.getItem("chat-app-user"));
      const { data } = await axios.post(`${setAvatarRoute}/${user._id}`, {
        image: base64String,
      });

      if (data.isSet) {
        user.isAvatarImageSet = true;
        user.avatar = data.image;
        localStorage.setItem("chat-app-user", JSON.stringify(user));
        setCurrentUserImage(data.image);
        toast.success("Avatar updated successfully", toastOptions);
      } else {
        toast.error("Error setting avatar. Please try again.", toastOptions);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddMember = async () => {
    if (memberEmail) {
      const { data } = await axios.get(`${searchUserRoute}/${memberEmail}`);
      if (data.status) {
        setGroupMembers([...groupMembers, data.user]);
        setMemberEmail("");
      } else {
        toast.error(data.msg, toastOptions);
      }
    }
  };

  const handleGroupAvatarUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setGroupAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateGroup = async () => {
    if (groupName.length < 3) {
      toast.error("Group name must be at least 3 characters", toastOptions);
      return;
    }
    if (groupMembers.length < 1) {
      toast.error("Group must have at least 1 other member", toastOptions);
      return;
    }

    const { data } = await axios.post(createGroupRoute, {
      name: groupName,
      description: groupDescription,
      members: groupMembers.map(m => m._id),
      admin: currentUserId,
      avatar: groupAvatar
    });

    if (data.status) {
      setGroups([data.group, ...groups]);
      setShowCreateGroupModal(false);
      setGroupName("");
      setGroupDescription("");
      setGroupAvatar("");
      setGroupMembers([]);
      toast.success("Group created successfully", toastOptions);
    } else {
      toast.error(data.msg, toastOptions);
    }
  };

  const handleCommunityAvatarUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setCommunityAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCommunity = async () => {
    if (communityName.length < 3) {
      toast.error("Community name must be at least 3 characters", toastOptions);
      return;
    }
    const { data } = await axios.post(createCommunityRoute, {
      name: communityName,
      description: communityDescription,
      admin: currentUserId,
      avatar: communityAvatar
    });
    if (data.status) {
      fetchCommunities();
      setShowCreateCommunityModal(false);
      setCommunityName("");
      setCommunityDescription("");
      setCommunityAvatar("");
      toast.success("Community created successfully", toastOptions);
    } else {
      toast.error(data.msg, toastOptions);
    }
  };

  const handleJoinCommunity = async (communityId) => {
    const { data } = await axios.post(joinCommunityRoute, { communityId, userId: currentUserId });
    if (data.status) {
      fetchCommunities();
      toast.success("Joined community", toastOptions);
      if (socket.current) {
        socket.current.emit("join-community", communityId);
      }
    }
  };

  const handleLeaveCommunity = async (communityId) => {
    const { data } = await axios.post(leaveCommunityRoute, { communityId, userId: currentUserId });
    if (data.status) {
      fetchCommunities();
      toast.success("Left community", toastOptions);
    }
  };

  return (
    <>
      {currentUserName && (
        <Container>
          <div className="brand">
            <img src={Logo} alt="logo" />
            <h3>Notify</h3>
          </div>
          <div className="tabs">
            <button
              className={activeTab === "chats" ? "active" : ""}
              onClick={() => {
                setActiveTab("chats");
                localStorage.setItem("active-tab", "chats");
              }}
            >
              Chats
            </button>
            <button
              className={activeTab === "groups" ? "active" : ""}
              onClick={() => {
                setActiveTab("groups");
                localStorage.setItem("active-tab", "groups");
              }}
            >
              Groups
            </button>
            <button
              className={activeTab === "communities" ? "active" : ""}
              onClick={() => {
                setActiveTab("communities");
                localStorage.setItem("active-tab", "communities");
              }}
            >
              Communities
            </button>
          </div>
          {activeTab === "chats" && (
            <div className="search-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Enter email to chat"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
                <button onClick={handleSearch}>
                  ➤
                </button>
              </div>
            </div>
          )}
          <div className="contacts">

            {activeTab === "chats" && (
              contacts.map((contact, index) => (
                <div
                  key={contact._id}
                  className={`contact ${index === currentSelected && activeTab === 'chats' ? "selected" : ""}`}
                  onClick={() => changeCurrentChat(index, contact)}
                >
                  <div className="avatar">
                    <img
                      src={contact.avatar ? (contact.avatar.startsWith("data:") ? contact.avatar : `data:image/svg+xml;base64,${contact.avatar}`) : "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                      alt=""
                    />
                  </div>
                  <div className="username">
                    <h3>{contact.name}</h3>
                    {contact.lastMessage && (
                      <div className="msg-row">
                        {contact.lastMessageSender === currentUserId && (
                          <span className={`ticks ${contact.lastMessageRead ? "read" : ""}`}>
                            ✓✓
                          </span>
                        )}
                        <p className="last-msg">{contact.lastMessage.substring(0, 30)}...</p>
                      </div>
                    )}
                  </div>
                  <div className="status-info">
                    {contact.lastMessageTime && (
                      <span className="last-msg-time">
                        {new Date(contact.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {contact.unreadCount > 0 && (
                      <div className="unread-badge">{contact.unreadCount}</div>
                    )}
                  </div>
                </div>
              ))
            )}

            {activeTab === "groups" && (
              <>
                <div className="create-group-btn">
                  <button onClick={() => setShowCreateGroupModal(true)}>Create New Group</button>
                </div>
                {groups.map((group, index) => (
                  <div
                    key={group._id}
                    className={`contact ${index === currentSelected && activeTab === 'groups' ? "selected" : ""}`}
                    onClick={() => changeCurrentChat(index, group)}
                  >
                    <div className="avatar">
                      <img
                        src={group.avatar || "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                        alt=""
                      />
                    </div>
                    <div className="username">
                      <div className="name-admin">
                        <h3>{group.name}</h3>
                      </div>
                      {group.lastMessage && (
                        <div className="msg-row">
                          {group.lastMessageSender === currentUserId && (
                            <span className="ticks">
                              ✓✓
                            </span>
                          )}
                          <p className="last-msg">
                            {group.lastMessageSenderName}: {group.lastMessage.substring(0, 20)}...
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="status-info">
                      {group.lastMessageTime && (
                        <span className="last-msg-time">
                          {new Date(group.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {group.unreadCount > 0 && (
                        <div className="unread-badge">{group.unreadCount}</div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeTab === "communities" && (
              <>
                <div className="create-group-btn">
                  <button onClick={() => setShowCreateCommunityModal(true)}>Create New Community</button>
                </div>
                {[...communities].sort((a, b) => (b.isMember === a.isMember ? 0 : b.isMember ? 1 : -1)).map((comm, index) => (
                  <div
                    key={comm._id}
                    className={`contact community-tile ${index === currentSelected && activeTab === 'communities' ? "selected" : ""}`}
                    onClick={() => changeCurrentChat(index, comm)}
                  >
                    <div className="avatar">
                      <img
                        src={comm.avatar || "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                        alt=""
                      />
                    </div>
                    <div className="username">
                      <div className="name-admin">
                        <h3>{comm.name}</h3>
                        {!comm.isMember && <span className="discover-tag">Public</span>}
                      </div>
                      <p className="last-msg">
                        {comm.memberCount} members • {comm.description?.substring(0, 30) || "No description"}
                      </p>
                    </div>
                    <div className="status-info">
                      {comm.isMember && comm.unreadCount > 0 && (
                        <div className="unread-badge">{comm.unreadCount}</div>
                      )}
                      {!comm.isMember && (
                        <button className="join-btn" onClick={(e) => {
                          e.stopPropagation();
                          handleJoinCommunity(comm._id);
                        }}>Join</button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="current-user">
            <div className="avatar" onClick={onButtonClick} style={{ cursor: "pointer", position: "relative" }}>
              <img
                src={currentUserImage ? (currentUserImage.startsWith("data:") ? currentUserImage : `data:image/svg+xml;base64,${currentUserImage}`) : "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                alt="avatar"
              />
              <FaPen style={{ position: "absolute", bottom: 0, right: 0, color: "white", backgroundColor: "#9a86f3", borderRadius: "50%", padding: "0.2rem", fontSize: "1rem" }} />
            </div>
            <input
              type='file'
              id='file'
              ref={inputFile}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <div className="username">
              <h2>{currentUserName}</h2>
            </div>
            <Logout />
          </div>
          <ToastContainer />
        </Container>
      )}
      {showCreateGroupModal && (
        <ModalOverlay>
          <div className="modal-content">
            <h2>Create Group</h2>
            <div className="group-avatar-upload" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <label htmlFor="group-avatar-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <img
                  src={groupAvatar || "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                  alt="group-avatar"
                  style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "3px solid #4e0eff", boxShadow: "0 0 10px #4e0eff55" }}
                />
                <span style={{ color: "#9a86f3", fontSize: "0.8rem", fontWeight: "bold" }}>Set Group Icon</span>
              </label>
              <input
                type="file"
                id="group-avatar-input"
                style={{ display: "none" }}
                onChange={handleGroupAvatarUpload}
                accept="image/*"
              />
            </div>
            <input
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <textarea
              placeholder="Group Description (Optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              style={{
                backgroundColor: "transparent",
                padding: "0.5rem",
                border: "0.1rem solid #4e0eff",
                borderRadius: "0.4rem",
                color: "white",
                resize: "none",
                height: "80px"
              }}
            />
            <div className="add-member">
              <input
                type="text"
                placeholder="Add Member by Email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
              <button onClick={handleAddMember}>Add</button>
            </div>
            <div className="members-list">
              {groupMembers.map((member, index) => (
                <div key={index} className="member-tag">
                  {member.name}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowCreateGroupModal(false)}>Cancel</button>
              <button onClick={handleCreateGroup}>Create</button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {showCreateCommunityModal && (
        <ModalOverlay>
          <div className="modal-content">
            <h2>Create Community</h2>
            <div className="group-avatar-upload" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <label htmlFor="community-avatar-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <img
                  src={communityAvatar || "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                  alt="community-avatar"
                  style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "3px solid #4e0eff", boxShadow: "0 0 10px #4e0eff55" }}
                />
                <span style={{ color: "#9a86f3", fontSize: "0.8rem", fontWeight: "bold" }}>Set Community Icon</span>
              </label>
              <input
                type="file"
                id="community-avatar-input"
                style={{ display: "none" }}
                onChange={handleCommunityAvatarUpload}
                accept="image/*"
              />
            </div>
            <input
              type="text"
              placeholder="Community Name"
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
            />
            <textarea
              placeholder="Community Purpose (Optional)"
              value={communityDescription}
              onChange={(e) => setCommunityDescription(e.target.value)}
              style={{
                backgroundColor: "transparent",
                padding: "0.5rem",
                border: "0.1rem solid #4e0eff",
                borderRadius: "0.4rem",
                color: "white",
                resize: "none",
                height: "80px"
              }}
            />
            <div className="modal-actions">
              <button onClick={() => setShowCreateCommunityModal(false)}>Cancel</button>
              <button onClick={handleCreateCommunity}>Create</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  .modal-content {
    background-color: #0d0d30;
    padding: 2rem;
    border-radius: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 400px;
    h2 {
      color: white;
      text-align: center;
    }
    input {
      background-color: transparent;
      padding: 0.5rem;
      border: 0.1rem solid #4e0eff;
      border-radius: 0.4rem;
      color: white;
      &:focus {
        outline: none;
      }
    }
    .add-member {
      display: flex;
      gap: 0.5rem;
      input {
        flex: 1;
      }
      button {
        background-color: #9a86f3;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.4rem;
        color: white;
        cursor: pointer;
      }
    }
    .members-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      .member-tag {
        background-color: #4e0eff;
        color: white;
        padding: 0.3rem 0.6rem;
        border-radius: 0.4rem;
        font-size: 0.8rem;
      }
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      button {
        background-color: #9a86f3;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.4rem;
        color: white;
        cursor: pointer;
        &:first-child {
          background-color: transparent;
          border: 1px solid #9a86f3;
        }
      }
    }
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: #080420;
  .brand {
    height: 10%;
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    img {
      height: 2rem;
    }
    h3 {
      color: white;
      text-transform: uppercase;
      font-size: 1.2rem;
    }
  }
  .tabs {
    height: 8%;
    display: flex;
    justify-content: center;
    gap: 1rem;
    align-items: center;
    button {
      background-color: transparent;
      border: none;
      color: white;
      font-weight: bold;
      cursor: pointer;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      transition: 0.3s ease-in-out;
      &:hover {
        background-color: #ffffff34;
      }
      &.active {
        background-color: #9a86f3;
      }
    }
  }
  .search-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 1rem;
    padding-bottom: 0.5rem;
    .search-input-wrapper {
      width: 100%;
      display: flex;
      align-items: center;
      background-color: #ffffff15;
      border-radius: 0.4rem;
      padding: 0.2rem 0.5rem;
      border: 0.1rem solid #4e0eff;
      input {
        flex: 1;
        background-color: transparent;
        border: none;
        color: white;
        padding: 0.3rem;
        font-size: 0.85rem;
        &:focus {
          outline: none;
        }
      }
      button {
        background-color: transparent;
        color: #4e0eff !important;
        border: none;
        width: 1.5rem;
        height: 1.5rem;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.1rem;
        transition: 0.2s ease-in-out;
        &:hover {
          color: #9a86f3 !important;
        }
      }
    }
  }
  .contacts {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: auto;
    gap: 0.3rem;
    &::-webkit-scrollbar {
      display: none;
    }
    scrollbar-width: none;
    -ms-overflow-style: none;
    .create-group-btn {
        width: 95%;
        margin-bottom: 0.5rem;
        button {
            width: 100%;
            background-color: #4e0eff;
            color: white;
            border: none;
            padding: 0.4rem;
            border-radius: 0.4rem;
            cursor: pointer;
            font-weight: bold;
            transition: 0.3s ease-in-out;
            &:hover {
                background-color: #9a86f3;
            }
        }
    }
    .contact {
      background-color: #ffffff34;
      cursor: pointer;
      width: 95%;
      border-radius: 0.3rem;
      padding: 0.3rem 0.5rem;
      display: flex;
      gap: 0.6rem;
      align-items: center;
      transition: 0.3s ease-in-out;
      .avatar {
        display: flex;
        align-items: center;
        img {
          height: 2rem;
          width: 2rem;
          border-radius: 50%;
          object-fit: cover;
        }
      }
      .username {
        display: flex;
        flex-direction: column;
        justify-content: center;
        overflow: hidden;
        flex: 1;
        h3 {
          color: white;
          font-size: 0.9rem;
          margin: 0;
          padding: 0;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .name-admin {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          .admin-tag {
            background-color: #4e0eff;
            color: white;
            font-size: 0.6rem;
            padding: 0.1rem 0.3rem;
            border-radius: 0.2rem;
            text-transform: uppercase;
            font-weight: bold;
          }
          .discover-tag {
            background-color: #25d366;
            color: white;
            font-size: 0.55rem;
            padding: 0.1rem 0.3rem;
            border-radius: 0.2rem;
            text-transform: uppercase;
            font-weight: bold;
          }
        }
        .msg-row {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          .ticks {
            font-size: 0.7rem;
            color: #d1d1d1;
            &.read {
              color: #34b7f1;
            }
          }
          .last-msg {
            color: #d1d1d1;
            font-size: 0.75rem;
            margin: 0;
            padding: 0;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
          }
        }
      }
      .status-info {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.2rem;
        .last-msg-time {
          font-size: 0.65rem;
          color: #d1d1d1;
          white-space: nowrap;
        }
        .unread-badge {
          background-color: #4e0eff;
          color: white;
          border-radius: 50%;
          padding: 0.1rem 0.3rem;
          font-size: 0.6rem;
          min-width: 1.1rem;
          height: 1.1rem;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .join-btn {
          background-color: #4e0eff;
          color: white;
          border: none;
          padding: 0.2rem 0.6rem;
          border-radius: 0.3rem;
          font-size: 0.7rem;
          font-weight: bold;
          cursor: pointer;
          transition: 0.2s;
          &:hover {
            background-color: #9a86f3;
          }
        }
      }
    }
    .selected {
      background-color: #9a86f3;
    }
  }

  .current-user {
    background-color: #0d0d30;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.8rem;
    padding: 0.5rem 1rem;
    height: 10%; // Explicit height for bottom area
    min-height: 4rem;
    .avatar {
      img {
        height: 2.5rem;
        width: 2.5rem;
        border-radius: 50%;
        object-fit: cover;
        max-inline-size: 100%;
      }
    }
    .username {
      h2 {
        color: white;
        font-size: 1.1rem;
      }
    }
    @media screen and (min-width: 720px) and (max-width: 1080px) {
      gap: 0.5rem;
      .username {
        h2 {
          font-size: 1rem;
        }
      }
    }
  }
`;
