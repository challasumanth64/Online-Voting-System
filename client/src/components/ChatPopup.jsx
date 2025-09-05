import React, { useState, useRef, useEffect } from 'react';
import { BsChatDots, BsSend } from 'react-icons/bs';
import { IoMdClose } from 'react-icons/io';
import 'bootstrap/dist/css/bootstrap.min.css';

const ChatPopup = ({ socket, user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socket.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off('chat-message');
    };
  }, [socket]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      const messageData = {
        sender: user.name,
        role: user.role,
        content: message.trim(),
        timestamp: new Date().toISOString()
      };
      socket.emit('chat-message', messageData);
      setMessage('');
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            backgroundColor: '#605BFF',
            border: 'none',
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1000,
          }}
        >
          <BsChatDots color="white" size={24} />
        </button>
      )}

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '320px',
            height: '480px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #E6E6E6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#1D1D1D'
            }}>
              Chat
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <IoMdClose size={20} color="#9A9AA0" />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  alignSelf: msg.sender === user.name ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                }}
              >
                <div
                  style={{
                    backgroundColor: msg.sender === user.name ? '#605BFF' : '#F8F8F9',
                    color: msg.sender === user.name ? '#FFFFFF' : '#1D1D1D',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    borderTopRightRadius: msg.sender === user.name ? '4px' : '12px',
                    borderTopLeftRadius: msg.sender === user.name ? '12px' : '4px',
                  }}
                >
                  {msg.sender !== user.name && (
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#605BFF',
                      marginBottom: '4px'
                    }}>
                      {msg.sender} ({msg.role})
                    </div>
                  )}
                  <div style={{ fontSize: '14px' }}>{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            style={{
              padding: '16px',
              borderTop: '1px solid #E6E6E6',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              style={{
                flex: 1,
                height: '40px',
                padding: '0 16px',
                border: '1px solid #E6E6E6',
                borderRadius: '20px',
                fontSize: '14px',
                fontFamily: 'Poppins, sans-serif',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#605BFF',
                border: 'none',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <BsSend color="white" size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatPopup;