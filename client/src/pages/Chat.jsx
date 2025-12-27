import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import styled from "styled-components";
import { host, getContactsRoute } from "../utils/APIRoutes";
import ChatContainer from "../components/ChatContainer";
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";

export default function Chat() {
    const navigate = useNavigate();
    const socket = useRef();
    const [contacts, setContacts] = useState([]);
    const [currentChat, setCurrentChat] = useState(undefined);
    const [currentUser, setCurrentUser] = useState(undefined);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const checkUser = async () => {
            if (!localStorage.getItem("chat-app-user")) {
                navigate("/login");
            } else {
                setCurrentUser(
                    await JSON.parse(
                        localStorage.getItem("chat-app-user")
                    )
                );
            }
        };
        checkUser();
    }, []);

    useEffect(() => {
        if (currentUser) {
            socket.current = io(host);
            socket.current.emit("add-user", currentUser._id);
        }
    }, [currentUser]);

    useEffect(() => {
        const fetchContacts = async () => {
            if (currentUser) {
                const { data } = await axios.get(`${getContactsRoute}/${currentUser._id}`);
                setContacts(data);
            }
        };
        fetchContacts();
    }, [currentUser]);

    useEffect(() => {
        if (socket.current) {
            socket.current.on("msg-recieve", (data) => {
                refreshContacts();
            });
        }
    }, [currentUser]);

    const handleChatChange = (chat) => {
        setCurrentChat(chat);
    };

    const refreshContacts = async () => {
        if (currentUser) {
            const { data } = await axios.get(`${getContactsRoute}/${currentUser._id}`);
            setContacts(data);
            setRefreshTrigger(prev => prev + 1);
        }
    };

    const handleLeave = () => {
        setCurrentChat(undefined);
        refreshContacts();
    };

    const addContact = (contact) => {
        const exists = contacts.find((c) => c._id === contact._id);
        if (!exists) {
            setContacts([...contacts, contact]);
        }
        setCurrentChat(contact);
    };

    return (
        <>
            <Container>
                <div className="container">
                    <Contacts
                        contacts={contacts}
                        changeChat={handleChatChange}
                        addContact={addContact}
                        socket={socket}
                        refreshTrigger={refreshTrigger}
                    />
                    {currentChat === undefined ? (
                        <Welcome />
                    ) : (
                        <ChatContainer
                            currentChat={currentChat}
                            socket={socket}
                            refreshContacts={refreshContacts}
                            onLeave={handleLeave}
                        />
                    )}
                </div>
            </Container>
        </>
    );
}

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #131324;
  .container {
    height: 100vh;
    width: 100vw;
    background-color: #00000076;
    display: grid;
    grid-template-columns: 23% 77%;
    @media screen and (min-width: 720px) and (max-width: 1080px) {
      grid-template-columns: 33% 67%;
    }
  }
`;
