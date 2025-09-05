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
              const res = await fetch(SERVER_URL + "/api/teacher/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret })
              });
              if (!res.ok) {
                alert("Invalid teacher secret"); 
                return;
              }
              onEnter({ role, name: "Teacher", secret });
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

        function TeacherView({ socket }) {
          const [question, setQuestion] = useState("");
          const [options, setOptions] = useState(["Yes", "No"]);
          const [timeoutSec, setTimeoutSec] = useState(60);
          const [correctAnswer, setCorrectAnswer] = useState(null);
          const [students, setStudents] = useState([]);
          const [current, setCurrent] = useState(null); // { text, options, deadlineAt }
          const [progress, setProgress] = useState({ counts: [], total: 0, answered: 0 });
          const [lastResult, setLastResult] = useState(null);
          const [history, setHistory] = useState([]);

          useEffect(() => {
            const handlers = {
              joined: () => {},
              idle: ({ history }) => setHistory(history || []),
              question: (q) => { setCurrent(q); setLastResult(null); },
              "results-progress": (p) => setProgress(p),
              results: (r) => { setCurrent(null); setLastResult(r); },
              "student-list": (list) => setStudents(list)
            };
            for (const [evt, fn] of Object.entries(handlers)) socket.on(evt, fn);
            socket.emit("get-history");
            return () => { for (const evt of Object.keys(handlers)) socket.off(evt); }
          }, [socket]);

          const deadlineSec = useMemo(() => current ? Math.floor((current.deadlineAt - Date.now())/1000) : 0, [current]);

          const ask = () => {
            const ops = options.filter(o => o.trim());
            socket.emit("ask-question", { text: question.trim(), options: ops, timeoutSec: Number(timeoutSec) || 60 });
          };
          const end = () => socket.emit("end-question");

          return (
            <div style={{ maxWidth: 1100, margin: "20px auto", fontFamily: "Inter, system-ui", padding: "20px" }}>
              <h2 style={{ color: "#2c3e50", textAlign: "center", marginBottom: "30px" }}>Teacher Dashboard</h2>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
                <div>
                  {!current ? (
                    <div style={{ 
                      border: "1px solid #e1e8ed", 
                      padding: "20px", 
                      borderRadius: 12,
                      backgroundColor: "white",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}>
                      <h3 style={{ color: "#2c3e50", marginBottom: "20px" }}>Create New Poll</h3>
                      <input 
                        placeholder="Enter your question" 
                        value={question} 
                        onChange={(e)=>setQuestion(e.target.value)} 
                        style={{ 
                          width: "100%", 
                          marginBottom: 16,
                          padding: "12px",
                          borderRadius: "6px",
                          border: "1px solid #ddd",
                          fontSize: "16px"
                        }}
                      />
                      {options.map((opt, i) => (
                        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                          <input 
                            value={opt} 
                            onChange={(e)=>{
                              const copy=[...options]; copy[i]=e.target.value; setOptions(copy);
                            }} 
                            placeholder={`Option ${i+1}`} 
                            style={{ 
                              flex: 1,
                              padding: "10px",
                              borderRadius: "4px",
                              border: "1px solid #ddd",
                              fontSize: "14px"
                            }}
                          />
                          <button 
                            onClick={()=>setOptions(options.filter((_,idx)=>idx!==i))}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: "#e74c3c",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer"
                            }}
                          >Remove</button>
                        </div>
                      ))}
                      <button 
                        onClick={()=>setOptions([...options, ""])}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#2ecc71",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          marginBottom: "16px",
                          cursor: "pointer"
                        }}
                      >Add Option</button>
                      <div style={{ marginTop: 16 }}>
                        <label style={{ display: "block", marginBottom: "8px" }}>Correct Answer: </label>
                        <select 
                          value={correctAnswer === null ? "" : correctAnswer} 
                          onChange={(e) => setCorrectAnswer(e.target.value === "" ? null : Number(e.target.value))}
                          style={{
                            padding: "8px",
                            borderRadius: "4px",
                            border: "1px solid #ddd",
                            width: "100%",
                            marginBottom: "16px"
                          }}
                        >
                          <option value="">No correct answer set</option>
                          {options.map((opt, idx) => (
                            <option key={idx} value={idx}>
                              Option {idx + 1}: {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <label style={{ display: "block", marginBottom: "8px" }}>Time limit (seconds): </label>
                        <input 
                          type="number" 
                          min="5" 
                          max="300" 
                          value={timeoutSec} 
                          onChange={(e)=>setTimeoutSec(e.target.value)}
                          style={{
                            padding: "8px",
                            borderRadius: "4px",
                            border: "1px solid #ddd",
                            width: "100px"
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 20 }}>
                        <button 
                          onClick={() => {
                            const ops = options.filter(o => o.trim());
                            socket.emit("ask-question", { 
                              text: question.trim(), 
                              options: ops, 
                              timeoutSec: Number(timeoutSec) || 60,
                              correctAnswer
                            });
                            setCorrectAnswer(null); // Reset for next question
                          }}
                          style={{
                            padding: "12px 30px",
                            backgroundColor: "#3498db",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "16px",
                            cursor: "pointer"
                          }}
                        >Start Poll</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      border: "1px solid #e1e8ed", 
                      padding: "20px", 
                      borderRadius: 12,
                      backgroundColor: "white",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}>
                      <h3 style={{ color: "#2c3e50" }}>Active Poll</h3>
                      <p style={{ fontSize: "18px", fontWeight: "500", marginTop: "16px" }}>{current.text}</p>
                      <p style={{ 
                        color: "#e74c3c", 
                        fontWeight: "500", 
                        fontSize: "16px" 
                      }}>Time left: {deadlineSec}s</p>
                      <ul style={{ 
                        listStyle: "none", 
                        padding: 0, 
                        margin: "20px 0" 
                      }}>
                        {current.options.map((o,i)=>(
                          <li key={i} style={{ 
                            padding: "12px",
                            marginBottom: "8px",
                            backgroundColor: "#f8f9fa",
                            borderRadius: "4px",
                            display: "flex",
                            justifyContent: "space-between"
                          }}>
                            <span>{o}</span>
                            <span style={{ fontWeight: "500" }}>{progress.counts[i] ?? 0}</span>
                          </li>
                        ))}
                      </ul>
                      <p style={{ fontSize: "16px", color: "#2c3e50" }}>
                        Responses: {progress.answered}/{progress.total}
                      </p>
                      <button 
                        onClick={end}
                        style={{
                          padding: "10px 24px",
                          backgroundColor: "#e74c3c",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                      >End Poll</button>
                    </div>
                  )}

                  {lastResult && (
                    <div style={{ 
                      border: "1px solid #e1e8ed", 
                      padding: "20px", 
                      borderRadius: 12,
                      marginTop: 24,
                      backgroundColor: "white",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}>
                      <h3 style={{ color: "#2c3e50" }}>Last Poll Results</h3>
                      <p style={{ fontSize: "18px", fontWeight: "500", marginTop: "16px" }}>{lastResult.question}</p>
                      <ul style={{ 
                        listStyle: "none", 
                        padding: 0,
                        margin: "20px 0"
                      }}>
                        {lastResult.options.map((o,i)=>(
                          <li key={i} style={{ 
                            padding: "12px",
                            marginBottom: "8px",
                            backgroundColor: "#f8f9fa",
                            borderRadius: "4px",
                            display: "flex",
                            justifyContent: "space-between"
                          }}>
                            <span>{o}</span>
                            <span style={{ fontWeight: "500" }}>{lastResult.counts[i]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {history?.length ? (
                    <div style={{ 
                      border: "1px solid #e1e8ed", 
                      padding: "20px", 
                      borderRadius: 12,
                      marginTop: 24,
                      backgroundColor: "white",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}>
                      <h3 style={{ color: "#2c3e50" }}>Past Polls</h3>
                      <ol style={{ paddingLeft: "20px" }}>
                        {history.map((h,i)=>(
                          <li key={i} style={{ marginBottom: "12px" }}>
                            <p style={{ margin: "8px 0" }}><b>{h.question}</b></p>
                            <p style={{ margin: 0, color: "#666" }}>
                              {h.options.map((o,idx)=>`${o}: ${h.counts[idx]}`).join(", ")}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>

                <div style={{ 
                  border: "1px solid #e1e8ed", 
                  padding: "20px", 
                  borderRadius: 12,
                  backgroundColor: "white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                }}>
                  <h3 style={{ color: "#2c3e50" }}>Students ({students.length})</h3>
                  <ul style={{ 
                    listStyle: "none", 
                    padding: 0,
                    margin: "16px 0" 
                  }}>
                    {students.map((s,idx)=>(
                      <li key={idx} style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        padding: "10px",
                        marginBottom: "8px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px"
                      }}>
                        <span>{s.name}</span>
                        <button 
                          onClick={()=>socket.emit("remove-student", { socketId: s.socketId })}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#e74c3c",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}
                        >Remove</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <ChatPopup socket={socket} user={{ name: "Teacher", role: "teacher" }} />
            </div>
          );
        }

        function StudentView({ socket, name }) {
          const [current, setCurrent] = useState(null);
          const [deadlineAt, setDeadlineAt] = useState(0);
          const [selected, setSelected] = useState(null);
          const [results, setResults] = useState(null);
          const [answerFeedback, setAnswerFeedback] = useState(null);
          const [phase, setPhase] = useState("waiting"); // waiting | answering | results

          const secondsLeft = useCountdown(deadlineAt);

          useEffect(() => {
            const handlers = {
              waiting: () => { 
                setPhase("waiting"); 
                setResults(null); 
                setCurrent(null); 
                setAnswerFeedback(null); 
              },
              question: (q) => { 
                setCurrent(q); 
                setPhase("answering"); 
                setDeadlineAt(q.deadlineAt); 
                setSelected(null); 
                setResults(null);
                setAnswerFeedback(null);
              },
              results: (r) => { 
                setResults(r); 
                setPhase("results"); 
                setCurrent(null); 
              },
              "answer-feedback": (feedback) => {
                setAnswerFeedback(feedback);
              }
            };
            for (const [evt, fn] of Object.entries(handlers)) socket.on(evt, fn);
            return () => { for (const evt of Object.keys(handlers)) socket.off(evt); }
          }, [socket]);

          const submit = () => {
            if (selected == null) {
              setAnswerFeedback({ submitted: false });
              return;
            }
            socket.emit("answer", { optionIndex: selected });
            setAnswerFeedback({ submitted: true });
          };

          return (
            <div style={{ 
              maxWidth: 800, 
              margin: "40px auto", 
              fontFamily: "Inter, system-ui",
              padding: "20px",
              textAlign: "center"
            }}>
              <h2 style={{ 
                color: "#2c3e50",
                marginBottom: "30px",
                fontSize: "28px"
              }}>Welcome, {name}!</h2>
              
              {phase === "waiting" && (
                <div style={{
                  padding: "40px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "12px",
                  textAlign: "center"
                }}>
                  <div style={{ marginBottom: "20px" }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3498db" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <p style={{
                    fontSize: "18px",
                    color: "#2c3e50",
                    margin: 0
                  }}>Waiting for the teacher to start a poll...</p>
                </div>
              )}

              {phase === "answering" && current && (
                <div style={{ 
                  border: "1px solid #e1e8ed",
                  padding: "30px",
                  borderRadius: "12px",
                  backgroundColor: "white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  maxWidth: "600px",
                  margin: "0 auto"
                }}>
                  <h3 style={{
                    color: "#2c3e50",
                    fontSize: "22px",
                    marginBottom: "24px",
                    textAlign: "left"
                  }}>{current.text}</h3>

                  {answerFeedback && (
                    <div 
                      className={`alert ${
                        answerFeedback.submitted ? 'alert-info' : 'alert-danger'
                      } mb-4`}
                    >
                      {answerFeedback.submitted 
                        ? "Your answer has been submitted! Wait for results..." 
                        : "Please select an answer"}
                    </div>
                  )}
                  
                  <div style={{
                    backgroundColor: "#f8f9fa",
                    padding: "10px 20px",
                    borderRadius: "6px",
                    marginBottom: "24px",
                    display: "inline-block"
                  }}>
                    <p style={{
                      margin: 0,
                      color: secondsLeft <= 10 ? "#e74c3c" : "#2c3e50",
                      fontWeight: "500"
                    }}>Time remaining: {secondsLeft}s</p>
                  </div>
                  
                  <div style={{ 
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    marginBottom: "30px"
                  }}>
                    {current.options.map((o,i)=>(
                      <div
                        key={i}
                        onClick={() => setSelected(i)}
                        style={{ 
                          padding: "16px 20px",
                          border: selected === i ? "2px solid #3498db" : "1px solid #ddd",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor: selected === i ? "#ebf5fb" : "white",
                          textAlign: "left"
                        }}
                      >
                        <label style={{ 
                          display: "flex", 
                          alignItems: "center",
                          gap: "12px",
                          cursor: "pointer"
                        }}>
                          <input 
                            type="radio" 
                            name="opt" 
                            checked={selected===i} 
                            onChange={()=>setSelected(i)}
                            style={{ cursor: "pointer" }}
                          />
                          <span style={{ fontSize: "16px" }}>{o}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={submit}
                    style={{
                      padding: "12px 40px",
                      backgroundColor: "#3498db",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "16px",
                      cursor: "pointer",
                      transition: "background-color 0.2s"
                    }}
                  >
                    Submit Answer
                  </button>
                </div>
              )}

              {phase === "results" && results && (
                <div style={{ 
                  border: "1px solid #e1e8ed",
                  padding: "30px",
                  borderRadius: "12px",
                  backgroundColor: "white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  maxWidth: "600px",
                  margin: "0 auto"
                }}>
                  <h3 style={{
                    color: "#2c3e50",
                    fontSize: "22px",
                    marginBottom: "24px"
                  }}>Poll Results</h3>
                  
                  <p style={{
                    fontSize: "18px",
                    fontWeight: "500",
                    color: "#2c3e50",
                    marginBottom: "24px",
                    textAlign: "left"
                  }}>{results.question}</p>

                  {results.correctAnswer !== undefined && (
                    <div className={`alert ${
                      results.studentAnswers?.[socket.id]?.isCorrect ? 'alert-success' : 'alert-danger'
                    } mb-4`}>
                      {results.studentAnswers?.[socket.id]?.isCorrect 
                        ? "✓ Your answer was correct!" 
                        : "✗ Your answer was incorrect"}
                    </div>
                  )}
                  
                  <div style={{ 
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    marginBottom: "20px"
                  }}>
                    {results.options.map((o,i)=>(
                      <div key={i} style={{ 
                        padding: "16px 20px",
                        backgroundColor: results.correctAnswer === i ? '#5BBF74' : '#f8f9fa',
                        color: results.correctAnswer === i ? 'white' : '#1D1D1D',
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderLeft: results.studentAnswers?.[socket.id]?.answer === i 
                          ? '4px solid #3498db' 
                          : 'none'
                      }}>
                        <div>
                          <span>{o}</span>
                          {results.correctAnswer === i && (
                            <span style={{ marginLeft: '8px' }}>✓ Correct Answer</span>
                          )}
                          {results.studentAnswers?.[socket.id]?.answer === i && (
                            <span style={{ marginLeft: '8px' }}>
                              (Your Answer)
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ 
                            fontWeight: "500",
                            color: results.correctAnswer === i ? 'white' : '#2c3e50'
                          }}>{results.counts[i]} votes</span>
                          <div 
                            style={{ 
                              backgroundColor: results.correctAnswer === i ? 'white' : '#3498db',
                              color: results.correctAnswer === i ? '#5BBF74' : 'white',
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                          >
                            {Math.round((results.counts[i] / results.counts.reduce((a,b) => a+b, 0)) * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <ChatPopup socket={socket} user={{ name, role: "student" }} />
            </div>
          );
        }

        export default function App() {
          const [user, setUser] = useState(null);

          useEffect(() => {
            if (!user) return;
            socket.connect();
            socket.emit("join", user);
            return () => socket.disconnect();
          }, [user]);

          if (!user) return <RoleGate onEnter={setUser} />;
          if (user.role === "teacher") return <TeacherView socket={socket} />;
          return <StudentView socket={socket} name={user.name} />;
        }