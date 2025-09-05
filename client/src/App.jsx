import React, { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import ChatPopup from "./components/ChatPopup";
import './styles/design-system.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

        const useCountdown = (deadlineAt) => {
          const [now, setNow] = useState(Date.now());
          useEffect(() => {
            const t = setInterval(() => setNow(Date.now()), 200);
            return () => clearInterval(t);
          }, []);
          return Math.max(0, Math.floor((deadlineAt - now) / 1000));
        };

        function RoleGate({ onEnter }) {
          const [role, setRole] = useState("student");
          const [name, setName] = useState(localStorage.getItem("poll_name") || "");
          const [secret, setSecret] = useState("");

          const handleEnter = async () => {
            if (role === "teacher") {
              try {
                console.log("Making request to:", SERVER_URL + "/api/teacher/login");
                console.log("Secret:", secret);
                const res = await fetch(SERVER_URL + "/api/teacher/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ secret })
                });
                console.log("Response:", res);
                if (!res.ok) {
                  alert("Invalid teacher secret"); 
                  return;
                }
                onEnter({ role, name: "Teacher", secret });
              } catch (error) {
                console.error("Fetch error:", error);
                alert("Network error: " + error.message);
                return;
              }
            } else {
              if (!name.trim()) return alert("Enter your name");
              localStorage.setItem("poll_name", name.trim());
              onEnter({ role, name: name.trim() });
            }
          };

          return (
            <div style={{ 
              maxWidth: 800, 
              margin: "40px auto", 
              fontFamily: "Inter, system-ui",
              padding: "20px",
              textAlign: "center"
            }}>
              <h1 style={{ color: "#2c3e50", marginBottom: "30px" }}>Live Polling System</h1>
              <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                gap: "20px", 
                marginBottom: "30px" 
              }}>
                <div 
                  onClick={() => setRole("student")} 
                  style={{ 
                    padding: "20px",
                    border: role === "student" ? "2px solid #3498db" : "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: "pointer",
                    width: "200px",
                    backgroundColor: role === "student" ? "#ebf5fb" : "white"
                  }}
                >
                  <h3 style={{ margin: "0 0 10px 0", color: "#2c3e50" }}>Student</h3>
                  <p style={{ margin: 0, color: "#7f8c8d" }}>Join a poll session</p>
                </div>
                <div 
                  onClick={() => setRole("teacher")} 
                  style={{ 
                    padding: "20px",
                    border: role === "teacher" ? "2px solid #3498db" : "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: "pointer",
                    width: "200px",
                    backgroundColor: role === "teacher" ? "#ebf5fb" : "white"
                  }}
                >
                  <h3 style={{ margin: "0 0 10px 0", color: "#2c3e50" }}>Teacher</h3>
                  <p style={{ margin: 0, color: "#7f8c8d" }}>Create and manage polls</p>
                </div>
              </div>
              {role === "student" && (
                <div style={{ 
                  marginTop: "20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "15px"
                }}>
                  <input 
                    placeholder="Your name" 
                    value={name} 
                    onChange={(e)=>setName(e.target.value)}
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                      width: "300px",
                      fontSize: "16px"
                    }}
                  />
                </div>
              )}
              {role === "teacher" && (
                <div style={{ 
                  marginTop: "20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "15px"
                }}>
                  <input 
                    type="password" 
                    placeholder="Teacher secret" 
                    value={secret} 
                    onChange={(e)=>setSecret(e.target.value)}
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                      width: "300px",
                      fontSize: "16px"
                    }}
                  />
                </div>
              )}
              <div style={{ marginTop: "30px" }}>
                <button 
                  onClick={handleEnter}
                  style={{
                    padding: "12px 30px",
                    backgroundColor: "#3498db",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "16px",
                    cursor: "pointer"
                  }}
                >
                  Enter
                </button>
              </div>
            </div>
          );
        }