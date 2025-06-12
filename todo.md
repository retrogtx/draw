# ✏️ Excalidraw Clone To-Do — Multi-User First 

---

## 🔐 User Identity (Core to Multi-User)
- [ ] Generate random user IDs (or allow username input)
- [ ] Store user ID in localStorage
- [ ] Send user ID on every WebSocket message
- [ ] Display other users’ cursors with usernames/colors
- [ ] (Optional) Add user color mapping

---

## 🔌 Backend (backend)
- [x] Set up Express server
- [ ] Drawing session endpoints:
  - [ ] `POST /sessions` → create new room/session
  - [ ] `GET /sessions/:id` → get session metadata (participants, last updated)
- [ ] Temp store for session data (Redis)
- Add CORS

---

## 📡 WebSocket Server (ws)
- [x] Set up WebSocket server using `ws` 
- [ ] Handle:
  - [ ] Client join (add to session room)
  - [ ] User leave (broadcast disconnect)
  - [ ] Broadcast drawing actions (with user ID)
  - [ ] Broadcast cursor movement
- [ ] Track session state in memory: users per room, their actions
- [ ] Rate-limit drawing actions per client
- [ ] Handle sync for late joiners (send full current drawing)

---

## 🌐 Web Client (frontend)
- [ ] Create whiteboard layout using `<canvas>` or SVG
- [ ] Build minimal drawing tool (pencil first)
- [ ] Add WebSocket client connection:
  - [ ] On connect: send session ID and user ID
  - [ ] On draw: send strokes with user ID
  - [ ] On cursor move: send cursor position
- [ ] Render:
  - [ ] Live strokes from others
  - [ ] Cursors of other users (with color + name)
- [ ] UI to show online users in a room

---

## 🎯 MVP Goals
- [ ] Multi-user drawing in real time
- [ ] Cursors for all connected users
- [ ] Joinable session rooms via URL
- [ ] Stable WebSocket handling
