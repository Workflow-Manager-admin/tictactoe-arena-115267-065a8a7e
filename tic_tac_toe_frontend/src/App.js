import React, { useState, useEffect } from "react";
import "./App.css";

// --- Utility function for backend API URL base
const BACKEND_BASE_URL = "http://localhost:3001"; // TODO: Adjust for deployment if needed

// Helper: Fetch wrapper for API with error handling and credentials
async function apiRequest(path, method = "GET", data = null, token = null) {
  let opts = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };
  if (token) {
    opts.headers["Authorization"] = `Bearer ${token}`;
  }
  if (data) {
    opts.body = JSON.stringify(data);
  }
  const res = await fetch(`${BACKEND_BASE_URL}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Error");
  }
  return await res.json();
}

// PUBLIC_INTERFACE
function App() {
  // --- THEME STATE ---
  const [theme, setTheme] = useState("light");

  // --- USER STATE & AUTH ---
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginView, setLoginView] = useState("login"); // or "register"
  const [authError, setAuthError] = useState("");

  // --- GAME STATE ---
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState(null); // full game from backend
  const [moveError, setMoveError] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);

  // --- LOBBY/HISTORY/LEADERBOARD STATE ---
  const [showHistory, setShowHistory] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(true); // Always-visible sidebar
  const [leaderboard, setLeaderboard] = useState([]);

  // --- UI STATE ---
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState("");
  const [appError, setAppError] = useState("");
  const [loading, setLoading] = useState(false);

  // ---- THEME EFFECT ----
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // --- ON LOAD: Try loading token/user from storage
  useEffect(() => {
    const tok = localStorage.getItem("ttt_token");
    const user = localStorage.getItem("ttt_user");
    if (tok && user) {
      setToken(tok);
      setCurrentUser(JSON.parse(user));
    }
  }, []);

  // --- Fetch leaderboard on initial load and after game ends
  useEffect(() => {
    fetchLeaderboard();
  }, [gameId]);

  // --- FUNC: Theme toggle
  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // --- FUNC: Register/Login
  // PUBLIC_INTERFACE
  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    const form = e.target;
    const username = form.username.value.trim();
    const password = form.password.value.trim();
    if (!username || !password) {
      setAuthError("Both fields are required.");
      setLoading(false);
      return;
    }
    try {
      const path =
        loginView === "login" ? "/api/login" : "/api/register";
      const out = await apiRequest(
        path,
        "POST",
        { username, password }
      );
      setToken(out.token);
      setCurrentUser({ username: out.username, user_id: out.user_id });
      localStorage.setItem("ttt_token", out.token);
      localStorage.setItem("ttt_user", JSON.stringify({ username: out.username, user_id: out.user_id }));
      setLoginView("login");
    } catch (err) {
      setAuthError(err.message || "Auth error");
    }
    setLoading(false);
  }

  // --- FUNC: Logout
  // PUBLIC_INTERFACE
  function handleLogout() {
    setToken(null);
    setCurrentUser(null);
    setGameId(null);
    setGameState(null);
    localStorage.removeItem("ttt_token");
    localStorage.removeItem("ttt_user");
  }

  // --- FUNC: Start new game
  // PUBLIC_INTERFACE
  async function handleStartGame(opponent = null) {
    setLoading(true);
    setGameState(null);
    setAppError("");
    try {
      const data = {};
      if (opponent) data.opponent = opponent;
      const out = await apiRequest("/api/game/new", "POST", data, token);
      setGameId(out.game_id);
      setGameState(out);
    } catch (err) {
      setAppError("Could not start game: " + (err.message || ""));
    }
    setLoading(false);
  }

  // --- FUNC: Load existing/ongoing game
  // PUBLIC_INTERFACE
  async function handleResumeGame(game_id) {
    setLoading(true);
    setAppError("");
    try {
      const out = await apiRequest(`/api/game/${game_id}/state`, "GET", null, token);
      setGameId(game_id);
      setGameState(out);
    } catch (err) {
      setAppError("Could not load game: " + (err.message || ""));
    }
    setLoading(false);
  }

  // --- FUNC: Handle gameplay move
  // PUBLIC_INTERFACE
  async function handleMakeMove(pos) {
    if (!gameId || !gameState || moveLoading) return;
    setMoveLoading(true);
    setMoveError("");
    try {
      const out = await apiRequest(
        `/api/game/${gameId}/move`,
        "POST",
        { row: pos.row, col: pos.col },
        token
      );
      setGameState(out);
    } catch (err) {
      setMoveError(err.message || "Move error");
    }
    setMoveLoading(false);
  }

  // --- FUNC: Fetch game history
  // PUBLIC_INTERFACE
  async function fetchHistory() {
    setLoading(true);
    setShowHistory(true);
    try {
      const out = await apiRequest(`/api/history`, "GET", null, token);
      setGameHistory(out.history || []);
    } catch (err) {
      setAppError("Unable to fetch history: " + (err.message || ""));
      setGameHistory([]);
    }
    setLoading(false);
  }

  // --- FUNC: Fetch Leaderboard
  // PUBLIC_INTERFACE
  async function fetchLeaderboard() {
    try {
      const out = await apiRequest("/api/leaderboard", "GET", null, token);
      setLeaderboard(out.leaderboard || []);
    } catch (err) {
      setLeaderboard([]);
    }
  }

  // ---- RENDER HELPERS ----

  // Render the interactive 3x3 tic-tac-toe board
  function Board({ game, onMove, currentUser, disabled }) {
    if (!game) return null;
    // Find grid
    const grid = game.board || [["", "", ""], ["", "", ""], ["", "", ""]];
    const winner = game.winner || null;
    const isDraw = game.status === "draw";
    const nextPlayer = game.next_player;
    // Find your mark (X/O)
    let yourMark = "?";
    if (currentUser && game.players) {
      if (game.players[0].username === currentUser.username) yourMark = "X";
      else if (game.players[1] && game.players[1].username === currentUser.username) yourMark = "O";
    }
    return (
      <div className="ttt-board">
        {grid.map((row, i) =>
          <div key={i} className="ttt-board-row">
            {row.map((cell, j) => {
              let clickable = !disabled && !grid[i][j] && !winner && !isDraw && game.players.length === 2 && nextPlayer === yourMark;
              return (
                <button
                  key={j}
                  className={`ttt-cell${clickable ? " ttt-cell-active" : ""}`}
                  onClick={() => clickable ? onMove({ row: i, col: j }) : null}
                  disabled={!clickable}
                  aria-label={`Row ${i+1} Col ${j+1}`}
                >
                  {cell || ""}
                </button>
              );
            })}
          </div>
        )}
        {(winner || isDraw) &&
          <div className="ttt-status">
            {isDraw ? "It's a draw!" :
              winner === yourMark ? "You win!" :
                winner ? `Winner: ${winner}` : ""
            }
          </div>
        }
      </div>
    );
  }

  // Renders the leaderboard sidebar
  function Leaderboard({ list }) {
    return (
      <aside className="ttt-leaderboard">
        <h2>Leaderboard</h2>
        <ol>
          {list.map((item, idx) => (
            <li key={item.username || idx}>
              <span className="rank">{idx + 1}.</span>
              <span className="username">{item.username}</span>
              <span className="score">{item.wins}W-{item.losses}L</span>
            </li>
          ))}
        </ol>
      </aside>
    );
  }

  // Renders a modal containing content
  function Modal({ visible, onClose, children }) {
    if (!visible) return null;
    return (
      <div className="ttt-modal-backdrop" onClick={onClose}>
        <div className="ttt-modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
          {children}
        </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div className="App">
      {/* HEADER/NAVBAR */}
      <header className="App-header" style={{flexDirection: "row", minHeight: 0, alignItems: "center", justifyContent: "space-between"}}>
        <div style={{display: 'flex', alignItems: "center", gap: 16}}>
          <span className="ttt-logo" style={{fontWeight: 900, color: "var(--text-secondary)", fontSize: "2rem", userSelect: "none"}}>TicTacToe</span>
          <span className="ttt-nav-links">
            {token && currentUser &&
              <>
                <button className="txt-btn" onClick={() => setGameId(null)}>Lobby</button>
                <button className="txt-btn" onClick={() => fetchHistory()}>History</button>
              </>
            }
          </span>
        </div>
        <div style={{display: 'flex', alignItems: "center", gap: 8}}>
          {token && currentUser && (
            <span style={{fontSize:14, marginRight: 10}}>Hi, <b>{currentUser.username}</b>!</span>
          )}
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          {token && <button onClick={handleLogout} className="txt-btn logout">Logout</button>}
        </div>
      </header>

      {/* LAYOUT: Sidebar + Main + (Modals) */}
      <div className="ttt-main-layout">
        {/* Sidebar - leaderboard */}
        {showLeaderboard &&
          <Leaderboard list={leaderboard} />
        }

        {/* Main content area */}
        <main className="ttt-main">
          {/* 1. If NOT logged in, show auth form */}
          {!token || !currentUser ? (
            <section className="ttt-auth-container">
              <div className="ttt-auth-box">
                <h2>{loginView === "login" ? "Login" : "Register"}</h2>
                <form onSubmit={handleAuth}>
                  <input name="username" type="text" placeholder="Username" minLength={3} required />
                  <input name="password" type="password" placeholder="Password" minLength={4} required />
                  <button type="submit" className="btn" disabled={loading}>{loginView === "login" ? "Login" : "Register"}</button>
                </form>
                {authError && <div className="auth-err">{authError}</div>}
                <div style={{marginTop: 16}}>
                  {loginView === "login" ?
                    <span>Don't have an account? <button type="button" className="link-btn" onClick={() => setLoginView("register")}>Register</button></span>
                    :
                    <span>Already have an account? <button type="button" className="link-btn" onClick={() => setLoginView("login")}>Login</button></span>
                  }
                </div>
              </div>
            </section>
          ) : (
            // 2. If game is NOT ongoing, show lobby/new game controls
            !gameId || !gameState ? (
              <section className="ttt-lobby">
                <h2>Lobby</h2>
                <button className="btn primary" onClick={() => handleStartGame()} disabled={loading}>Start New Game</button>
                <button className="btn secondary" onClick={fetchHistory}>View Game History</button>
                <div style={{marginTop: 30}}>
                  <h3>Recent Games</h3>
                  {gameHistory && gameHistory.length > 0 ?
                    <ul className="ttt-history-list">
                      {gameHistory.slice(0,3).map((g, i) =>
                        <li key={g.game_id || i}>
                          <span>{g.status}</span>
                          <span>{g.end_time ? (new Date(g.end_time)).toLocaleString() : ""}</span>
                          <button onClick={() => handleResumeGame(g.game_id)}>View</button>
                        </li>
                      )}
                    </ul>
                  : <span>No recent games</span>}
                </div>
              </section>
            ) : (
              // 3. GAME IN PROGRESS or viewing
              <section className="ttt-game-area">
                <h2>
                  Tic Tac Toe
                  <span style={{marginLeft: 18, fontSize:16, color:"var(--text-secondary)"}}>
                    {gameState.winner
                      ? (gameState.winner === currentUser.username ? "You won!" : `Winner: ${gameState.winner}`)
                      : (gameState.next_player && `Next: ${gameState.next_player}`)}
                  </span>
                </h2>
                <Board
                  game={gameState}
                  onMove={handleMakeMove}
                  currentUser={currentUser}
                  disabled={moveLoading || !!gameState.winner || gameState.status === "draw"}
                />
                <div className="ttt-game-meta">
                  <div>Players: {gameState.players?.map(p=>p.username).join(" vs ")}</div>
                  {moveError && <div className="err-msg" style={{color:"#E87A41"}}>{moveError}</div>}
                  {(!!gameState.winner || gameState.status === "draw") &&
                    <button className="btn" onClick={() => setGameId(null)}>Back to Lobby</button>
                  }
                </div>
              </section>
            )
          )}

          {/* General app error display */}
          {appError && <div className="err-msg">{appError}</div>}
        </main>
      </div>

      {/* MODAL: Game History */}
      <Modal visible={showHistory} onClose={()=>setShowHistory(false)}>
        <h2>Game History</h2>
        {gameHistory.length === 0 ? (
          <div>No games found.</div>
        ) : (
          <ul className="ttt-history-list">
            {gameHistory.map((g, i) =>
              <li key={g.game_id || i}>
                <span>{g.status}</span>
                <span>{g.end_time ? (new Date(g.end_time)).toLocaleString() : ""}</span>
                <span>{g.players?.map(p => p.username).join(" vs ")}</span>
                <button onClick={() => {setShowHistory(false); handleResumeGame(g.game_id);}}>View</button>
              </li>
            )}
          </ul>
        )}
      </Modal>
      {/* Add more modals if needed */}
    </div>
  );
}

export default App;

/*
========= STYLING ===========
Extend App.css with:
.ttt-main-layout { display: flex; align-items: flex-start; }
.ttt-leaderboard { min-width: 220px; background: var(--bg-secondary); padding: 18px 10px; border-right: 1.5px solid var(--border-color); min-height: 500px; }
.ttt-main { flex: 1; padding: 34px 24px 40px 24px; }
.ttt-board { display: inline-block; margin: 1.5rem 0; }
.ttt-board-row { display: flex; }
.ttt-cell { width:72px; height:72px; font-size:2.3rem; border:1.5px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); border-radius:7px; margin:2px;}
.ttt-cell-active { background: var(--accent, #F9A825); cursor:pointer; }
.ttt-status { margin-top:1.7rem; font-size: 1.5rem; font-weight:600;}
.ttt-modal-backdrop {position: fixed;top:0;left:0;right:0;bottom:0;background:rgba(30,30,30,0.45);display:flex;align-items:center;justify-content:center;z-index:100;}
.ttt-modal {background:var(--bg-primary);padding:32px 36px; border-radius:15px; box-shadow: 0 3px 12px rgba(0,0,0,.09);}
.modal-close {position:absolute;top:10px;right:12px;font-size:2rem;border:none;background:none;}
.ttt-auth-container {margin:auto;width:100vw;height:80vh;display:flex;align-items:center;justify-content:center;}
.ttt-auth-box {padding:44px 48px; background:var(--bg-secondary); border-radius:12px;}
.err-msg, .auth-err { margin-top:10px; color:#E87A41;}
.btn {background: var(--button-bg,#1E88E5); color: var(--button-text); font-weight:600; padding:10px 18px; border-radius:7px;border:none;margin:3px 0;font-size:1.06rem; cursor:pointer;}
.btn.primary { background:var(--button-bg, #1E88E5);}
.btn.secondary { background:var(--accent,#F9A825); color:var(--text-primary);}
.txt-btn, .link-btn { border:none;background:none;color:var(--text-secondary);cursor:pointer;padding:0 3px;font-size:1rem;margin:0 5px;}
.logout { background:var(--accent,#F9A825);color:var(--text-primary); }
*/

