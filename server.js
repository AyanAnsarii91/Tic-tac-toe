// Modern Tic-Tac-Toe Game - Server-side Node.js with Express and Socket.io

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Initialize Express app, HTTP server and Socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Data structures to store game state
const rooms = new Map();
const socketToRoom = new Map();

// Winning combinations for Tic-Tac-Toe
const winningCombinations = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // Rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // Columns
  [0, 4, 8],
  [2, 4, 6], // Diagonals
];

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Create a new game room
  socket.on("createRoom", ({ playerName }) => {
    const roomId = generateRoomId();

    // Create room data structure
    rooms.set(roomId, {
      id: roomId,
      players: {
        X: playerName,
        O: null,
      },
      playerSockets: {
        X: socket.id,
        O: null,
      },
      board: Array(9).fill(""),
      currentTurn: "X",
      gameActive: false,
      scores: { X: 0, O: 0 },
    });

    // Associate socket with room
    socketToRoom.set(socket.id, roomId);

    // Join socket to room
    socket.join(roomId);

    // Notify client
    socket.emit("roomCreated", {
      roomId,
      symbol: "X",
    });

    console.log(`Room created: ${roomId} by ${playerName}`);
  });

  // Join an existing room
  socket.on("joinRoom", ({ playerName, roomId }) => {
    // Check if room exists
    if (!rooms.has(roomId)) {
      socket.emit("error", {
        message: "Room not found",
        redirect: true,
      });
      return;
    }

    const room = rooms.get(roomId);

    // Check if room is full
    if (room.players.O !== null) {
      socket.emit("error", {
        message: "Room is full",
        redirect: true,
      });
      return;
    }

    // Add player to room
    room.players.O = playerName;
    room.playerSockets.O = socket.id;
    room.gameActive = true;
    rooms.set(roomId, room);

    // Associate socket with room
    socketToRoom.set(socket.id, roomId);

    // Join socket to room
    socket.join(roomId);

    // Notify both players
    socket.emit("joinedRoom", {
      roomId,
      symbol: "O",
      players: room.players,
      currentTurn: room.currentTurn,
    });

    socket.to(roomId).emit("opponentJoined", {
      players: room.players,
      currentTurn: room.currentTurn,
    });

    console.log(`Player ${playerName} joined room ${roomId}`);
  });

  // Handle player move
  socket.on("makeMove", ({ roomId, cellIndex, playerSymbol }) => {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Validate move
    if (
      !room.gameActive ||
      room.currentTurn !== playerSymbol ||
      room.board[cellIndex] !== "" ||
      cellIndex < 0 ||
      cellIndex > 8
    ) {
      return;
    }

    // Update board
    room.board[cellIndex] = playerSymbol;

    // Check for win or draw
    const result = checkGameResult(room.board);

    if (result.gameOver) {
      room.gameActive = false;

      // Update scores
      if (result.winner !== "draw") {
        room.scores[result.winner]++;
      }

      // Notify players
      io.to(roomId).emit("moveResult", {
        board: room.board,
        currentTurn: room.currentTurn,
        players: room.players,
        gameOver: true,
        scores: room.scores,
        result: result,
      });
    } else {
      // Switch turns
      room.currentTurn = room.currentTurn === "X" ? "O" : "X";

      // Notify players
      io.to(roomId).emit("moveResult", {
        board: room.board,
        currentTurn: room.currentTurn,
        players: room.players,
        gameOver: false,
      });
    }

    // Save updated room state
    rooms.set(roomId, room);
  });

  // Handle request for new game
  socket.on("requestNewGame", ({ roomId }) => {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Reset game state
    room.board = Array(9).fill("");
    room.currentTurn = "X";
    room.gameActive = true;
    rooms.set(roomId, room);

    // Notify players
    io.to(roomId).emit("gameRestarted", {
      board: room.board,
      currentTurn: room.currentTurn,
      players: room.players,
    });

    console.log(`New game started in room ${roomId}`);
  });

  // Handle chat messages
  socket.on("sendMessage", ({ roomId, message, sender }) => {
    if (!rooms.has(roomId)) return;

    // Send message to opponent
    socket.to(roomId).emit("chatMessage", {
      message,
      sender,
    });
  });

  // Handle room cancellation
  socket.on("cancelRoom", ({ roomId }) => {
    if (rooms.has(roomId)) {
      cleanupRoom(roomId);
      console.log(`Room ${roomId} cancelled`);
    }
  });

  // Handle leaving game
  socket.on("leaveGame", ({ roomId }) => {
    handlePlayerDisconnect(socket.id);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
    handlePlayerDisconnect(socket.id);
  });
});

// Check game result (win, draw, or continue)
function checkGameResult(board) {
  // Check for win
  for (const combo of winningCombinations) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        gameOver: true,
        winner: board[a],
        winningCells: combo,
      };
    }
  }

  // Check for draw
  if (!board.includes("")) {
    return {
      gameOver: true,
      winner: "draw",
      winningCells: [],
    };
  }

  // Game continues
  return {
    gameOver: false,
    winner: null,
    winningCells: [],
  };
}

// Handle player disconnection
function handlePlayerDisconnect(socketId) {
  // Check if player is in a room
  if (socketToRoom.has(socketId)) {
    const roomId = socketToRoom.get(socketId);

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);

      // Determine which player left
      let opponentSymbol = null;

      if (room.playerSockets.X === socketId) {
        opponentSymbol = "O";
      } else if (room.playerSockets.O === socketId) {
        opponentSymbol = "X";
      }

      // If game was active, notify opponent
      if (room.gameActive && opponentSymbol) {
        const opponentSocketId = room.playerSockets[opponentSymbol];
        const socket = io.sockets.sockets.get(opponentSocketId);

        if (socket) {
          socket.emit("opponentLeft");
        }
      }

      // If player was 'O', wait for new player
      if (room.playerSockets.O === socketId) {
        room.players.O = null;
        room.playerSockets.O = null;
        room.gameActive = false;
        room.board = Array(9).fill("");
        room.currentTurn = "X";

        rooms.set(roomId, room);
        socketToRoom.delete(socketId);

        console.log(`Player O left room ${roomId}, waiting for new player`);
      }
      // If player was 'X', clean up the room
      else if (room.playerSockets.X === socketId) {
        cleanupRoom(roomId);
        console.log(`Player X left room ${roomId}, room deleted`);
      }
    }
  }
}

// Clean up a room and associated data
function cleanupRoom(roomId) {
  if (!rooms.has(roomId)) return;

  const room = rooms.get(roomId);

  // Remove socket to room mappings
  if (room.playerSockets.X) {
    socketToRoom.delete(room.playerSockets.X);
  }
  if (room.playerSockets.O) {
    socketToRoom.delete(room.playerSockets.O);
  }

  // Delete room
  rooms.delete(roomId);
}

// Generate a simple room ID
function generateRoomId() {
  return uuidv4().substring(0, 6).toUpperCase();
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
