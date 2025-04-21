// Modern Tic-Tac-Toe Game - Client-side JavaScript

// Socket.io connection setup
const socket = io();

// Game state variables
let playerName = "";
let roomId = "";
let playerSymbol = "";
let currentTurn = "";
let gameActive = false;
let board = ["", "", "", "", "", "", "", "", ""];
let scores = { X: 0, O: 0 };

// DOM Elements
const screens = {
  landing: document.getElementById("landing-screen"),
  waiting: document.getElementById("waiting-screen"),
  game: document.getElementById("game-screen"),
};

const elements = {
  // Landing screen
  playerNameInput: document.getElementById("player-name"),
  createRoomBtn: document.getElementById("create-room-btn"),
  roomIdInput: document.getElementById("room-id-input"),
  joinRoomBtn: document.getElementById("join-room-btn"),

  // Waiting screen
  roomIdDisplay: document.getElementById("room-id-display"),
  copyRoomIdBtn: document.getElementById("copy-room-id"),
  cancelRoomBtn: document.getElementById("cancel-room"),

  // Game screen
  cells: document.querySelectorAll(".cell"),
  turnIndicator: document.getElementById("turn-indicator"),
  currentPlayerDisplay: document.getElementById("current-player"),
  playerXScore: document.querySelector("#player-x-score .score"),
  playerOScore: document.querySelector("#player-o-score .score"),
  playerXName: document.querySelector("#player-x-score .player-name"),
  playerOName: document.querySelector("#player-o-score .player-name"),
  newGameBtn: document.getElementById("new-game-btn"),
  leaveGameBtn: document.getElementById("leave-game-btn"),

  // Chat
  chatMessages: document.getElementById("chat-messages"),
  chatInput: document.getElementById("chat-input"),
  sendMessageBtn: document.getElementById("send-message"),

  // Modal
  resultModal: document.getElementById("result-modal"),
  resultMessage: document.getElementById("result-message"),
  playAgainBtn: document.getElementById("play-again-btn"),
  exitGameBtn: document.getElementById("exit-game-btn"),

  // Notification
  notification: document.getElementById("notification"),
};

// Event listeners - Initial setup
document.addEventListener("DOMContentLoaded", () => {
  // Landing screen events
  elements.createRoomBtn.addEventListener("click", createRoom);
  elements.joinRoomBtn.addEventListener("click", joinRoom);

  // Waiting screen events
  elements.copyRoomIdBtn.addEventListener("click", copyRoomId);
  elements.cancelRoomBtn.addEventListener("click", cancelRoom);

  // Game screen events
  elements.cells.forEach((cell) => {
    cell.addEventListener("click", () => cellClicked(cell));
  });
  elements.newGameBtn.addEventListener("click", requestNewGame);
  elements.leaveGameBtn.addEventListener("click", leaveGame);

  // Chat events
  elements.sendMessageBtn.addEventListener("click", sendMessage);
  elements.chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Modal events
  elements.playAgainBtn.addEventListener("click", handlePlayAgain);
  elements.exitGameBtn.addEventListener("click", handleExitGame);

  // Enter key for inputs
  elements.playerNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") createRoom();
  });
  elements.roomIdInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") joinRoom();
  });
});

// Screen management
function showScreen(screenName) {
  Object.keys(screens).forEach((key) => {
    screens[key].classList.remove("active");
  });
  screens[screenName].classList.add("active");
}

// Create a new room
function createRoom() {
  playerName =
    elements.playerNameInput.value.trim() ||
    `Player${Math.floor(Math.random() * 1000)}`;

  if (playerName) {
    socket.emit("createRoom", { playerName });
    showScreen("waiting");
  } else {
    showNotification("Please enter your name", "error");
  }
}

// Join an existing room
function joinRoom() {
  playerName =
    elements.playerNameInput.value.trim() ||
    `Player${Math.floor(Math.random() * 1000)}`;
  const roomToJoin = elements.roomIdInput.value.trim();

  if (!playerName) {
    showNotification("Please enter your name", "error");
    return;
  }

  if (!roomToJoin) {
    showNotification("Please enter a room ID", "error");
    return;
  }

  socket.emit("joinRoom", { playerName, roomId: roomToJoin });
}

// Copy room ID to clipboard
function copyRoomId() {
  navigator.clipboard
    .writeText(roomId)
    .then(() => {
      showNotification("Room ID copied to clipboard!", "success");
    })
    .catch((err) => {
      console.error("Could not copy room ID: ", err);
      showNotification("Failed to copy room ID", "error");
    });
}

// Cancel room creation
function cancelRoom() {
  socket.emit("cancelRoom", { roomId });
  showScreen("landing");
  resetGame();
}

// Cell click handler
function cellClicked(cell) {
  if (
    !gameActive ||
    currentTurn !== playerSymbol ||
    cell.classList.contains("x") ||
    cell.classList.contains("o")
  ) {
    return;
  }

  const cellIndex = cell.getAttribute("data-index");
  socket.emit("makeMove", { roomId, cellIndex, playerSymbol });
}

// Request a new game
function requestNewGame() {
  socket.emit("requestNewGame", { roomId });
}

// Leave the current game
function leaveGame() {
  socket.emit("leaveGame", { roomId });
  showScreen("landing");
  resetGame();
}

// Send a chat message
function sendMessage() {
  const messageText = elements.chatInput.value.trim();
  if (messageText) {
    socket.emit("sendMessage", {
      roomId,
      message: messageText,
      sender: playerName,
    });

    // Add message to chat (optimistic UI)
    addMessageToChat(messageText, "outgoing");
    elements.chatInput.value = "";
  }
}

// Add a message to the chat window
function addMessageToChat(message, type, sender = null) {
  const messageElement = document.createElement("div");

  if (type === "system") {
    messageElement.classList.add("system-message");
    messageElement.textContent = message;
  } else {
    messageElement.classList.add("message", type);

    if (type === "incoming") {
      messageElement.textContent = `${sender}: ${message}`;
    } else {
      messageElement.textContent = message;
    }
  }

  elements.chatMessages.appendChild(messageElement);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Handle play again from result modal
function handlePlayAgain() {
  elements.resultModal.classList.remove("active");
  requestNewGame();
}

// Handle exit game from result modal
function handleExitGame() {
  elements.resultModal.classList.remove("active");
  leaveGame();
}

// Reset game state
function resetGame() {
  board = ["", "", "", "", "", "", "", "", ""];
  gameActive = false;
  playerSymbol = "";
  currentTurn = "";
  scores = { X: 0, O: 0 };

  elements.cells.forEach((cell) => {
    cell.classList.remove("x", "o", "win");
  });

  elements.playerXScore.textContent = "0";
  elements.playerOScore.textContent = "0";
  elements.playerXName.textContent = "Player X";
  elements.playerOName.textContent = "Player O";

  // Clear chat
  elements.chatMessages.innerHTML = "";
  addMessageToChat("Game started. Good luck!", "system");

  // Reset form inputs
  elements.playerNameInput.value = "";
  elements.roomIdInput.value = "";
  elements.chatInput.value = "";
}

// Update the game board UI
function updateBoard(gameBoard) {
  board = gameBoard;
  elements.cells.forEach((cell, index) => {
    cell.classList.remove("x", "o");

    if (board[index] === "X") {
      cell.classList.add("x");
    } else if (board[index] === "O") {
      cell.classList.add("o");
    }
  });
}

// Update turn indicator
function updateTurnIndicator(turn, players) {
  currentTurn = turn;
  const playerName = turn === "X" ? players.X : players.O;

  elements.currentPlayerDisplay.textContent = playerName || turn;

  // Highlight active player score
  if (turn === "X") {
    document.getElementById("player-x-score").classList.add("active");
    document.getElementById("player-o-score").classList.remove("active");
  } else {
    document.getElementById("player-x-score").classList.remove("active");
    document.getElementById("player-o-score").classList.add("active");
  }
}

// Update player scores
function updateScores(newScores) {
  scores = newScores;
  elements.playerXScore.textContent = scores.X;
  elements.playerOScore.textContent = scores.O;
}

// Show game result modal
function showGameResult(result) {
  const { winner, winningCells } = result;

  // Highlight winning cells
  if (winningCells && winningCells.length) {
    winningCells.forEach((index) => {
      elements.cells[index].classList.add("win");
    });
  }

  // Update result message and show modal
  if (winner === "draw") {
    elements.resultMessage.textContent = "It's a draw!";
  } else {
    const winnerName =
      winner === playerSymbol
        ? "You"
        : winner === "X"
        ? elements.playerXName.textContent
        : elements.playerOName.textContent;
    elements.resultMessage.textContent = `${winnerName} won!`;
  }

  setTimeout(() => {
    elements.resultModal.classList.add("active");
  }, 1000);
}

// Show a notification
function showNotification(message, type = "info") {
  elements.notification.textContent = message;
  elements.notification.className = "notification";
  elements.notification.classList.add(type, "show");

  setTimeout(() => {
    elements.notification.classList.remove("show");
  }, 3000);
}

// Socket.io event listeners
socket.on("roomCreated", (data) => {
  roomId = data.roomId;
  playerSymbol = data.symbol;
  elements.roomIdDisplay.textContent = roomId;
  showNotification("Room created successfully", "success");
});

socket.on("joinedRoom", (data) => {
  roomId = data.roomId;
  playerSymbol = data.symbol;
  gameActive = true;

  // Set player names
  elements.playerXName.textContent = data.players.X;
  elements.playerOName.textContent = data.players.O;

  // Update turn indicator
  updateTurnIndicator(data.currentTurn, data.players);

  showScreen("game");
  showNotification("Joined room successfully", "success");
  addMessageToChat(`${data.players.X} vs ${data.players.O}`, "system");
});

socket.on("opponentJoined", (data) => {
  gameActive = true;

  // Set player names
  elements.playerXName.textContent = data.players.X;
  elements.playerOName.textContent = data.players.O;

  // Update turn indicator
  updateTurnIndicator(data.currentTurn, data.players);

  showScreen("game");
  showNotification("Opponent joined the game", "success");
  addMessageToChat(`${data.players.X} vs ${data.players.O}`, "system");
});

socket.on("gameUpdate", (data) => {
  updateBoard(data.board);
  updateTurnIndicator(data.currentTurn, data.players);
});

socket.on("moveResult", (data) => {
  updateBoard(data.board);
  updateTurnIndicator(data.currentTurn, data.players);

  if (data.gameOver) {
    gameActive = false;
    updateScores(data.scores);
    showGameResult(data.result);
  }
});

socket.on("gameRestarted", (data) => {
  elements.cells.forEach((cell) => {
    cell.classList.remove("x", "o", "win");
  });

  updateBoard(data.board);
  updateTurnIndicator(data.currentTurn, data.players);
  gameActive = true;

  addMessageToChat("New game started", "system");
});

socket.on("opponentLeft", () => {
  gameActive = false;
  showNotification("Opponent left the game", "error");
  addMessageToChat(
    "Opponent left the game. Waiting for new player...",
    "system"
  );
  showScreen("waiting");
});

socket.on("chatMessage", (data) => {
  addMessageToChat(data.message, "incoming", data.sender);
});

socket.on("error", (data) => {
  showNotification(data.message, "error");

  if (data.redirect) {
    showScreen("landing");
  }
});
