import express from "express";
        import http from "http";
        import { Server } from "socket.io";
        import cors from "cors";
        import dotenv from "dotenv";

        dotenv.config();

        const app = express();
        app.use(express.json());
        app.use(cors({ origin: process.env.ORIGIN?.split(",") || "*"}));

        const server = http.createServer(app);
        const io = new Server(server, {
          cors: { origin: process.env.ORIGIN?.split(",") || "*" }
        });

        const PORT = process.env.PORT || 4000;
        const TEACHER_SECRET = process.env.TEACHER_SECRET || "changeme";

        // --- In-memory state (for demo) ---
        // A single "room" called "main" for simplicity. Could be extended to multiple rooms.
        const roomId = "main";

        const state = {
          sessions: {
            [roomId]: {
              teacherSocketId: null,
              students: new Map(), // socketId -> { name }
              currentQuestion: null, // { text, options, deadlineAt, answers: Map<socketId, index>, timer }
              history: [], // past results: { question, options, counts, askedAt, endedAt }
              messages: [] // chat messages
            }
          }
        };

        // REST endpoint to health-check / and simple teacher auth test
        app.get("/", (req, res) => res.json({ ok: true, roomId }));

        app.post("/api/teacher/login", (req, res) => {
          const { secret } = req.body;
          if (secret === TEACHER_SECRET) return res.json({ ok: true });
          return res.status(401).json({ ok: false, error: "Invalid secret" });
        });

        // --- Socket.IO events ---
        io.on("connection", (socket) => {
          const session = state.sessions[roomId];

          // Helper: emit state snapshots
          const broadcastProgress = () => {
            if (!session.currentQuestion) return;
            const counts = Array(session.currentQuestion.options.length).fill(0);
            for (const [, idx] of session.currentQuestion.answers.entries()) {
              counts[idx]++;
            }
            const total = session.students.size;
            io.to(roomId).emit("results-progress", {
              counts, total, answered: session.currentQuestion.answers.size
            });
          };

          const endQuestion = (reason = "timeout") => {
            const cq = session.currentQuestion;
            if (!cq) return;
            clearTimeout(cq.timer);
            const counts = Array(cq.options.length).fill(0);
            const studentAnswers = {};
            for (const [socketId, idx] of cq.answers.entries()) {
              counts[idx]++;
              const student = session.students.get(socketId);
              if (student) {
                studentAnswers[socketId] = {
                  name: student.name,
                  answer: idx,
                  isCorrect: cq.correctAnswer !== null ? idx === cq.correctAnswer : null
                };
              }
            }
            const payload = {
              question: cq.text,
              options: cq.options,
              counts,
              endedAt: Date.now(),
              reason,
              correctAnswer: cq.correctAnswer,
              studentAnswers
            };
            session.history.push({
              ...payload,
              askedAt: cq.askedAt
            });
            session.currentQuestion = null;
            io.to(roomId).emit("results", payload);
          };

          socket.on("join", ({ role, name, secret }) => {
            socket.join(roomId);
            const sess = state.sessions[roomId];
            if (role === "teacher") {
              // Simple auth
              if (secret !== TEACHER_SECRET) {
                socket.emit("error-message", "Invalid teacher secret");
                return socket.disconnect(true);
              }
              sess.teacherSocketId = socket.id;
              socket.emit("joined", { role, roomId });
              // Send current state
              if (sess.currentQuestion) {
                socket.emit("question", {
                  text: sess.currentQuestion.text,
                  options: sess.currentQuestion.options,
                  deadlineAt: sess.currentQuestion.deadlineAt
                });
                broadcastProgress();
              } else {
                socket.emit("idle", { history: sess.history });
              }
            } else {
              // Student
              const uniqueName = name?.trim();
              if (!uniqueName) {
                socket.emit("error-message", "Name is required");
                return socket.disconnect(true);
              }
              // Associate socket with student
              sess.students.set(socket.id, { name: uniqueName });
              socket.emit("joined", { role: "student", roomId, name: uniqueName });

              // If a question is active, send it
              if (sess.currentQuestion) {
                socket.emit("question", {
                  text: sess.currentQuestion.text,
                  options: sess.currentQuestion.options,
                  deadlineAt: sess.currentQuestion.deadlineAt
                });
                broadcastProgress();
              } else {
                socket.emit("waiting");
              }
              io.to(roomId).emit("student-list", Array.from(sess.students.values()));
            }
          });

          socket.on("ask-question", ({ text, options, timeoutSec = 60, correctAnswer }) => {
            const sess = state.sessions[roomId];
            if (socket.id !== sess.teacherSocketId) return;
            if (sess.currentQuestion) {
              socket.emit("error-message", "A question is already active");
              return;
            }
            const sanitized = {
              text: String(text || "").trim(),
              options: Array.isArray(options) ? options.filter(Boolean).map(String) : [],
              correctAnswer: Number.isInteger(correctAnswer) && correctAnswer >= 0 ? correctAnswer : null
            };
            if (!sanitized.text || sanitized.options.length < 2) {
              socket.emit("error-message", "Provide a question and at least 2 options");
              return;
            }
            const askedAt = Date.now();
            const deadlineAt = askedAt + Math.max(5, Math.min(timeoutSec, 300)) * 1000;
            const answers = new Map();
            const timer = setTimeout(() => endQuestion("timeout"), deadlineAt - Date.now());
            sess.currentQuestion = { ...sanitized, deadlineAt, askedAt, answers, timer };
            io.to(roomId).emit("question", { 
              text: sanitized.text, 
              options: sanitized.options, 
              deadlineAt,
              correctAnswer: socket.id === sess.teacherSocketId ? sanitized.correctAnswer : undefined
            });
            broadcastProgress();
          });

          socket.on("answer", ({ optionIndex }) => {
            const sess = state.sessions[roomId];
            const cq = sess.currentQuestion;
            if (!cq) return;
            if (!sess.students.has(socket.id)) return; // only students
            const idx = Number(optionIndex);
            if (Number.isNaN(idx) || idx < 0 || idx >= cq.options.length) return;
            cq.answers.set(socket.id, idx);
            
            // Send immediate feedback to the student
            socket.emit("answer-feedback", {
              submitted: true,
              answer: idx,
              isCorrect: cq.correctAnswer !== null ? idx === cq.correctAnswer : null
            });
            
            broadcastProgress();
            // End early if all students answered
            if (cq.answers.size >= sess.students.size && sess.students.size > 0) {
              endQuestion("all-answered");
            }
          });

          socket.on("end-question", () => {
            const sess = state.sessions[roomId];
            if (socket.id !== sess.teacherSocketId) return;
            endQuestion("teacher-ended");
          });

          socket.on("remove-student", ({ socketId }) => {
            const sess = state.sessions[roomId];
            if (socket.id !== sess.teacherSocketId) return;
            if (sess.students.has(socketId)) {
              sess.students.delete(socketId);
              io.to(roomId).emit("student-list", Array.from(sess.students.values()));
              const targetSocket = io.sockets.sockets.get(socketId);
              if (targetSocket) {
                targetSocket.disconnect(true);
              }
            }
          });

          socket.on("get-history", () => {
            const sess = state.sessions[roomId];
            if (socket.id !== sess.teacherSocketId) return;
            socket.emit("history", sess.history);
          });

          socket.on("chat-message", (message) => {
            const sess = state.sessions[roomId];
            if (!sess.students.has(socket.id) && socket.id !== sess.teacherSocketId) return;
            
            const messageWithTime = {
              ...message,
              timestamp: new Date().toISOString()
            };
            
            sess.messages.push(messageWithTime);
            // Keep only last 100 messages
            if (sess.messages.length > 100) {
              sess.messages.shift();
            }
            
            io.to(roomId).emit("chat-message", messageWithTime);
          });

          socket.on("get-chat-history", () => {
            const sess = state.sessions[roomId];
            if (!sess.students.has(socket.id) && socket.id !== sess.teacherSocketId) return;
            socket.emit("chat-history", sess.messages);
          });

          socket.on("disconnect", () => {
            const sess = state.sessions[roomId];
            if (sess.students.has(socket.id)) {
              sess.students.delete(socket.id);
              io.to(roomId).emit("student-list", Array.from(sess.students.values()));
              // If everyone left and a question was active, end it to show results to teacher
              if (sess.currentQuestion && sess.students.size === 0) {
                const cq = sess.currentQuestion;
                // If no answers at all, still end gracefully
                const counts = Array(cq.options.length).fill(0);
                for (const [, idx] of cq.answers.entries()) counts[idx]++;
                io.to(roomId).emit("results-progress", { counts, total: 0, answered: 0 });
              }
            } else if (socket.id === sess.teacherSocketId) {
              sess.teacherSocketId = null;
            }
          });
        });

        server.listen(PORT, () => console.log(`Server listening on :${PORT}`));