import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import axios from "axios";
import { FaPen, FaTimes, FaSignOutAlt } from "react-icons/fa";
import {
  getCommunityDetailsRoute,
  updateCommunityInfoRoute,
  leaveCommunityRoute
} from "../utils/APIRoutes";
import { toast } from "react-toastify";

export default function CommunityDetails({ community, currentUser, onClose, refreshCommunities }) {
  const [communityData, setCommunityData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const inputFile = useRef(null);

  const isAdmin = communityData?.admin?._id === currentUser?._id || communityData?.admin === currentUser?._id;

  useEffect(() => {
    fetchCommunityDetails();
  }, [community._id]);

  const fetchCommunityDetails = async () => {
    const { data } = await axios.get(`${getCommunityDetailsRoute}/${community._id}`);
    if (data.status) {
      setCommunityData(data.community);
      setEditName(data.community.name);
      setEditDescription(data.community.description || "");
    }
  };

  const handleUpdateInfo = async () => {
    const { data } = await axios.post(updateCommunityInfoRoute, {
      communityId: community._id,
      name: editName,
      description: editDescription
    });
    if (data.status) {
      setIsEditing(false);
      fetchCommunityDetails();
      refreshCommunities();
      toast.success("Community info updated");
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      const { data } = await axios.post(updateCommunityInfoRoute, {
        communityId: community._id,
        avatar: base64String
      });
      if (data.status) {
        fetchCommunityDetails();
        refreshCommunities();
        toast.success("Community icon updated");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLeaveCommunity = async () => {
    if (window.confirm("Are you sure you want to leave this community?")) {
      const { data } = await axios.post(leaveCommunityRoute, {
        communityId: community._id,
        userId: currentUser._id
      });
      if (data.status) {
        onClose();
        refreshCommunities();
        toast.success("Left community");
      }
    }
  };

  if (!communityData) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <Header>
          <h2>Community Info</h2>
          <button onClick={onClose}><FaTimes /></button>
        </Header>
        <ScrollableContent>
          <InfoSection>
            <AvatarContainer>
              <img
                src={communityData.avatar || "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                alt="community avatar"
              />
              {isAdmin && (
                <EditAvatar onClick={() => inputFile.current.click()}>
                  <FaPen />
                </EditAvatar>
              )}
              <input
                type="file"
                ref={inputFile}
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </AvatarContainer>

            {isEditing ? (
              <EditForm>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Community Name"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Community Description"
                />
                <div className="actions">
                  <button onClick={() => setIsEditing(false)}>Cancel</button>
                  <button onClick={handleUpdateInfo} className="save">Save</button>
                </div>
              </EditForm>
            ) : (
              <DisplayInfo>
                <div className="name-row">
                  <h1>{communityData.name}</h1>
                  {isAdmin && <FaPen onClick={() => setIsEditing(true)} />}
                </div>
                <p className="description">{communityData.description || "No description set"}</p>
                <p className="meta">{communityData.members.length} Members</p>
              </DisplayInfo>
            )}
          </InfoSection>

          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ color: "white", marginBottom: "0.8rem", fontSize: "1.12rem" }}>Admin</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", backgroundColor: "#ffffff05", padding: "0.8rem", borderRadius: "0.5rem" }}>
              <img
                src={communityData.admin?.avatar ? (communityData.admin.avatar.startsWith("data:") ? communityData.admin.avatar : `data:image/svg+xml;base64,${communityData.admin.avatar}`) : "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                alt=""
                style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
              />
              <span style={{ color: "white" }}>{communityData.admin?.name || "Unknown"}</span>
            </div>
          </div>

          <DangerZone>
            <button onClick={handleLeaveCommunity} className="leave-btn">
              <FaSignOutAlt /> Leave Community
            </button>
          </DangerZone>
        </ScrollableContent>
      </ModalContent>
    </ModalOverlay>
  );
}

const ModalOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
`;

const ModalContent = styled.div`
    background-color: #0d0d30;
    width: 450px;
    max-height: 85vh;
    border-radius: 1rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
`;

const Header = styled.div`
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ffffff15;
    h2 {
        color: white;
        font-size: 1.2rem;
    }
    button {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
    }
`;

const ScrollableContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    &::-webkit-scrollbar {
        width: 0.3rem;
        &-thumb {
            background-color: #ffffff39;
            border-radius: 1rem;
        }
    }
`;

const InfoSection = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
`;

const AvatarContainer = styled.div`
    position: relative;
    img {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid #4e0eff;
    }
`;

const EditAvatar = styled.div`
    position: absolute;
    bottom: 5px;
    right: 5px;
    background-color: #4e0eff;
    width: 35px;
    height: 35px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    &:hover {
        background-color: #9a86f3;
    }
`;

const DisplayInfo = styled.div`
    text-align: center;
    width: 100%;
    .name-row {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 0.5rem;
        h1 {
            color: white;
            font-size: 1.8rem;
            margin: 0;
        }
        svg {
            color: #9a86f3;
            cursor: pointer;
            font-size: 1rem;
        }
    }
    .description {
        color: #d1d1d1;
        font-size: 0.95rem;
        line-height: 1.4;
        margin-bottom: 0.5rem;
    }
    .meta {
        color: #9a86f3;
        font-size: 0.85rem;
        font-weight: bold;
    }
`;

const EditForm = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    input, textarea {
        background-color: #ffffff10;
        border: 1px solid #4e0eff;
        border-radius: 0.5rem;
        padding: 0.8rem;
        color: white;
        font-size: 1rem;
        width: 100%;
        &:focus {
            outline: none;
            border-color: #9a86f3;
        }
    }
    textarea {
        height: 100px;
        resize: none;
    }
    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        button {
            padding: 0.5rem 1.2rem;
            border-radius: 0.4rem;
            cursor: pointer;
            font-weight: bold;
            background: none;
            border: 1px solid #ffffff30;
            color: white;
            &.save {
                background-color: #4e0eff;
                border: none;
                &:hover {
                    background-color: #9a86f3;
                }
            }
        }
    }
`;

const DangerZone = styled.div`
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #ffffff15;
    .leave-btn {
        width: 100%;
        padding: 0.8rem;
        background-color: #ff4b2b20;
        color: #ff4b2b;
        border: 1px solid #ff4b2b;
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: bold;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        transition: 0.3s;
        &:hover {
            background-color: #ff4b2b;
            color: white;
        }
    }
`;
