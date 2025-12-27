import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import axios from "axios";
import { FaPen, FaTimes, FaUserPlus, FaUserShield, FaUserMinus, FaSignOutAlt } from "react-icons/fa";
import {
    getGroupDetailsRoute,
    updateGroupInfoRoute,
    addGroupMembersRoute,
    removeGroupMemberRoute,
    assignGroupAdminRoute,
    removeGroupAdminRoute,
    searchUserRoute
} from "../utils/APIRoutes";
import { toast } from "react-toastify";

export default function GroupDetails({ group, currentUser, socket, onClose, refreshGroup }) {
    const [groupData, setGroupData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [showAddMember, setShowAddMember] = useState(false);
    const [searchEmail, setSearchEmail] = useState("");
    const inputFile = useRef(null);

    const isAdmin = groupData?.admins.some(admin => (admin._id || admin).toString() === currentUser?._id);

    useEffect(() => {
        fetchGroupDetails();
    }, [group._id]);

    const fetchGroupDetails = async () => {
        const { data } = await axios.get(`${getGroupDetailsRoute}/${group._id}`);
        if (data.status) {
            setGroupData(data.group);
            setEditName(data.group.name);
            setEditDescription(data.group.description || "");
        }
    };

    const handleUpdateInfo = async () => {
        const { data } = await axios.post(updateGroupInfoRoute, {
            groupId: group._id,
            name: editName,
            description: editDescription
        });
        if (data.status) {
            setIsEditing(false);
            fetchGroupDetails();
            refreshGroup();
            toast.success("Group info updated");
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;
            const { data } = await axios.post(updateGroupInfoRoute, {
                groupId: group._id,
                avatar: base64String
            });
            if (data.status) {
                fetchGroupDetails();
                refreshGroup();
                toast.success("Group icon updated");
            }
        };
        reader.readAsDataURL(file);
    };

    const handleAddMember = async () => {
        const { data: userData } = await axios.get(`${searchUserRoute}/${searchEmail}`);
        if (userData.status) {
            const { data } = await axios.post(addGroupMembersRoute, {
                groupId: group._id,
                members: [userData.user._id],
                operatorId: currentUser._id
            });
            if (data.status) {
                setSearchEmail("");
                setShowAddMember(false);
                fetchGroupDetails();
                toast.success("Member added");
            }
        } else {
            toast.error(userData.msg);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (window.confirm("Are you sure you want to remove this member?")) {
            const { data } = await axios.post(removeGroupMemberRoute, {
                groupId: group._id,
                userId,
                operatorId: currentUser._id
            });
            if (data.status) {
                fetchGroupDetails();
                if (userId === currentUser._id) {
                    socket.current.emit("leave-group", group._id);
                }
                toast.success("Member removed");
            }
        }
    };

    const handleAssignAdmin = async (userId) => {
        const { data } = await axios.post(assignGroupAdminRoute, {
            groupId: group._id,
            userId,
            operatorId: currentUser._id
        });
        if (data.status) {
            fetchGroupDetails();
            toast.success("Admin assigned");
        }
    };

    const handleRemoveAdmin = async (userId) => {
        const { data } = await axios.post(removeGroupAdminRoute, {
            groupId: group._id,
            userId,
            operatorId: currentUser._id
        });
        if (data.status) {
            fetchGroupDetails();
            toast.success("Admin removed");
        }
    };

    const handleLeaveGroup = async () => {
        if (window.confirm("Are you sure you want to leave this group?")) {
            const { data } = await axios.post(removeGroupMemberRoute, {
                groupId: group._id,
                userId: currentUser._id,
                operatorId: currentUser._id
            });
            if (data.status) {
                socket.current.emit("leave-group", group._id);
                onClose();
                refreshGroup();
                toast.success("Left group");
            }
        }
    };

    if (!groupData) return null;

    return (
        <ModalOverlay onClick={onClose}>
            <ModalContent onClick={(e) => e.stopPropagation()}>
                <Header>
                    <h2>Group Info</h2>
                    <button onClick={onClose}><FaTimes /></button>
                </Header>
                <ScrollableContent>
                    <GroupInfoSection>
                        <AvatarContainer>
                            <img
                                src={groupData.avatar || "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                                alt="group avatar"
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
                                    placeholder="Group Name"
                                />
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Group Description"
                                />
                                <div className="actions">
                                    <button onClick={() => setIsEditing(false)}>Cancel</button>
                                    <button onClick={handleUpdateInfo} className="save">Save</button>
                                </div>
                            </EditForm>
                        ) : (
                            <DisplayInfo>
                                <div className="name-row">
                                    <h1>{groupData.name}</h1>
                                    {isAdmin && <FaPen onClick={() => setIsEditing(true)} />}
                                </div>
                                <p className="description">{groupData.description || "No description set"}</p>
                            </DisplayInfo>
                        )}
                    </GroupInfoSection>

                    <MembersSection>
                        <div className="section-header">
                            <h3>{groupData.members.length} Members</h3>
                            {isAdmin && (
                                <button onClick={() => setShowAddMember(!showAddMember)}>
                                    <FaUserPlus /> Add Member
                                </button>
                            )}
                        </div>

                        {showAddMember && (
                            <AddMemberForm>
                                <input
                                    type="text"
                                    placeholder="Enter user email"
                                    value={searchEmail}
                                    onChange={(e) => setSearchEmail(e.target.value)}
                                />
                                <button onClick={handleAddMember}>Add</button>
                            </AddMemberForm>
                        )}

                        <MemberList>
                            {groupData.members.map((member) => {
                                const isMemberAdmin = groupData.admins.some(a => (a._id || a).toString() === member._id.toString());
                                return (
                                    <MemberItem key={member._id}>
                                        <div className="user-info">
                                            <img
                                                src={member.avatar ? (member.avatar.startsWith("data:") ? member.avatar : `data:image/svg+xml;base64,${member.avatar}`) : "https://www.transparentpng.com/thumb/user/black-user-png-icon-bUbPKd.png"}
                                                alt=""
                                            />
                                            <div className="details">
                                                <span className="name">{member.name} {member._id === currentUser._id && "(You)"}</span>
                                                {isMemberAdmin && <span className="admin-badge">Admin</span>}
                                            </div>
                                        </div>
                                        <div className="member-actions">
                                            {isAdmin && member._id !== currentUser._id && (
                                                <>
                                                    {isMemberAdmin ? (
                                                        <button onClick={() => handleRemoveAdmin(member._id)} title="Remove Admin">
                                                            <FaUserShield style={{ color: "#ff4b2b" }} />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleAssignAdmin(member._id)} title="Make Admin">
                                                            <FaUserShield />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleRemoveMember(member._id)} title="Remove Member">
                                                        <FaUserMinus />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </MemberItem>
                                );
                            })}
                        </MemberList>
                    </MembersSection>

                    <DangerZone>
                        <button onClick={handleLeaveGroup} className="leave-btn">
                            <FaSignOutAlt /> Leave Group
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

const GroupInfoSection = styled.div`
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

const MembersSection = styled.div`
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        h3 {
            color: white;
            font-size: 1.1rem;
        }
        button {
            background: none;
            border: none;
            color: #4e0eff;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            &:hover {
                color: #9a86f3;
            }
        }
    }
`;

const AddMemberForm = styled.div`
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    input {
        flex: 1;
        background-color: #ffffff10;
        border: 1px solid #4e0eff;
        border-radius: 0.4rem;
        padding: 0.5rem;
        color: white;
        &:focus {
            outline: none;
        }
    }
    button {
        background-color: #4e0eff;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.4rem;
        cursor: pointer;
    }
`;

const MemberList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
`;

const MemberItem = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background-color: #ffffff05;
    .user-info {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        img {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }
        .details {
            display: flex;
            flex-direction: column;
            .name {
                color: white;
                font-size: 0.95rem;
            }
            .admin-badge {
                color: #4e0eff;
                font-size: 0.7rem;
                font-weight: bold;
                text-transform: uppercase;
            }
        }
    }
    .member-actions {
        display: flex;
        gap: 0.5rem;
        button {
            background: none;
            border: none;
            color: #ffffff60;
            cursor: pointer;
            font-size: 1rem;
            &:hover {
                color: #9a86f3;
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
