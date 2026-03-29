import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, runTransaction, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyABafUmZw3g-ykOGwCmPBwWok4wIJbHdNc",
    authDomain: "ourapp-8fa00.firebaseapp.com",
    projectId: "ourapp-8fa00",
    databaseURL: "https://ourapp-8fa00-default-rtdb.asia-southeast1.firebasedatabase.app/",
    storageBucket: "ourapp-8fa00.firebasestorage.app",
    messagingSenderId: "904805276158",
    appId: "1:904805276158:web:440df38ad7efc56bbf08af"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 1. CORE VARIABLES ---
let myName = localStorage.getItem('petPlayerName');
let myVote = null;
let voteTimerInterval = null;
const XP_GOAL = 5000;

// --- 2. IDENTITY CHECK ---
window.checkAccess = function() {
    const input = document.getElementById('access-key').value.trim().toLowerCase();
    const allowed = ["francine", "justine"];
    if (allowed.includes(input)) {
        localStorage.setItem('petPlayerName', input);
        document.getElementById('fs-overlay').style.display = 'none';
        location.reload(); 
    } else { 
        const err = document.getElementById('error-msg');
        err.style.display = 'block';
        setTimeout(() => err.style.display = 'none', 2000);
    }
};

// --- 3. THE REAL-TIME SYNC ENGINE ---
function initGame() {
    if (!myName) return;
    document.getElementById('my-name-display').innerText = myName.toUpperCase();
    const partner = (myName === 'francine') ? "justine" : "francine";

    // A. PET & PLAYER SYNC
    onValue(ref(db, 'gameData'), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const shared = data.sharedPet || { xp: 0, level: 1 };
        const me = (data.players && data.players[myName]) ? data.players[myName] : { cookies: 0 };

        // UI Updates
        document.getElementById('cookie-count').innerText = (me.cookies || 0).toString().padStart(4, '0');
        document.getElementById('current-xp').innerText = shared.xp;
        const xpPercent = Math.min((shared.xp / XP_GOAL) * 100, 100);
        document.getElementById('progress-fill').style.width = xpPercent + "%";

        // Pet Icon Logic (Simplified)
        const petIcons = ["🥚", "🐣", "🐥", "🦅", "🐉"];
        const stage = Math.floor(shared.xp / 1000); 
        document.getElementById('pet-display').innerText = petIcons[stage] || "🐉";
    });

    // B. GAME SYNC & VOTING (Ang "Haharutan" Logic)
    onValue(ref(db, 'gameData/activeGame'), (snapshot) => {
        const gameData = snapshot.val();
        const overlay = document.getElementById('game-overlay');
        
        if (gameData && gameData.status === "voting") {
            overlay.style.display = 'flex';
            startVotingUI(gameData.type);
        } else if (gameData && gameData.status === "playing") {
            overlay.style.display = 'flex';
            loadGame(gameData.type, gameData.difficulty);
        } else {
            overlay.style.display = 'none';
            clearInterval(voteTimerInterval);
        }
    });

    // C. POKE SYNC (Hearts)
    onValue(ref(db, `gameData/players/${myName}/poke`), (snap) => {
        if (snap.val() > 0) {
            spawnHeart();
            update(ref(db, `gameData/players/${myName}`), { poke: 0 });
        }
    });
}

// --- 4. GAME & VOTING LOGIC ---
window.requestGame = function(gameType) {
    set(ref(db, 'gameData/activeGame'), {
        type: gameType,
        status: "voting",
        timestamp: Date.now()
    });
};

function startVotingUI(gameType) {
    const screen = document.getElementById('game-screen');
    document.getElementById('game-title').innerText = "VOTE DIFFICULTY";
    myVote = null;

    screen.innerHTML = `
        <div id="vote-box">
            <p style="font-size:10px">GAME: ${gameType.toUpperCase()}</p>
            <div class="vote-btns">
                <button onclick="castVote('Easy')">EASY (1x 🍪)</button>
                <button onclick="castVote('Medium')">MEDIUM (3x 🍪)</button>
                <button onclick="castVote('Hard')">HARD (10x 🍪)</button>
            </div>
            <h1 id="v-timer">5</h1>
        </div>
    `;

    let timeLeft = 5;
    clearInterval(voteTimerInterval);
    voteTimerInterval = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById('v-timer');
        if(timerEl) timerEl.innerText = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(voteTimerInterval);
            if (myName === "justine") finalizeVotes(gameType); // Justine handles the logic
        }
    }, 1000);
}

window.castVote = function(level) {
    myVote = level;
    update(ref(db, `gameData/votes/${myName}`), { choice: level });
    showNotif(`Voted: ${level}`);
};

async function finalizeVotes(gameType) {
    const snap = await get(ref(db, 'gameData/votes'));
    const votes = snap.val() || {};
    const v1 = votes.justine ? votes.justine.choice : null;
    const v2 = votes.francine ? votes.francine.choice : null;

    let finalDiff;
    if (v1 && v2 && v1 === v2) {
        finalDiff = v1; // Parehas pinili
    } else {
        const options = ["Easy", "Medium", "Hard"];
        finalDiff = options[Math.floor(Math.random() * 3)]; // Random
    }

    update(ref(db, 'gameData/activeGame'), { status: "playing", difficulty: finalDiff });
    set(ref(db, 'gameData/votes'), null); // Reset votes
}

// --- 5. THE 15 GAMES SYSTEM ---
function loadGame(type, diff) {
    const screen = document.getElementById('game-screen');
    document.getElementById('game-title').innerText = `${type.toUpperCase()} (${diff})`;
    
    // Cookie Reward based on Difficulty
    const reward = diff === "Hard" ? 10 : (diff === "Medium" ? 3 : 1);

    // Simple Game Templates (Sample for Tap Hero)
    if (type === 'tap') {
        let count = 0;
        let target = diff === "Hard" ? 30 : (diff === "Medium" ? 15 : 10);
        screen.innerHTML = `
            <p>TAP ${target} TIMES!</p>
            <button class="arcade-btn feed" style="margin:auto" id="tap-target">TAP!</button>
            <h2 id="tap-count">0</h2>
        `;
        document.getElementById('tap-target').onclick = () => {
            count++;
            document.getElementById('tap-count').innerText = count;
            if (count >= target) win(reward);
        };
    } else {
        // Placeholder for other 14 games
        screen.innerHTML = `<p>Coming Soon!</p><button class="start-btn" onclick="win(${reward})">FREE WIN</button>`;
    }
}

// --- 6. UNLIMITED FEEDING ---
document.getElementById('feed-btn').onclick = () => {
    runTransaction(ref(db, `gameData`), (data) => {
        if (!data) return data;
        const player = data.players[myName];
        if (player.cookies > 0) {
            player.cookies--;
            data.sharedPet.xp += 10; // +10 XP per feed
            if (data.sharedPet.xp > XP_GOAL) data.sharedPet.xp = XP_GOAL;
            showNotif("YUM! +10 XP");
        } else {
            showNotif("NO COOKIES! 🍪");
        }
        return data;
    });
};

// --- UTILS ---
window.requestCloseGame = () => set(ref(db, 'gameData/activeGame'), null);

window.win = (amt) => {
    runTransaction(ref(db, `gameData/players/${myName}/cookies`), c => (c || 0) + amt);
    showNotif(`WIN! +${amt} 🍪`);
    requestCloseGame();
};

function showNotif(msg) {
    const b = document.getElementById('notif-banner');
    b.innerText = msg;
    b.classList.remove('hidden-notif');
    setTimeout(() => b.classList.add('hidden-notif'), 2500);
}

function spawnHeart() {
    const h = document.createElement('div'); h.innerHTML = "💖";
    h.className = "heart-fx";
    h.style.left = Math.random() * 80 + 10 + "%";
    h.style.bottom = "20%";
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1500);
}

document.getElementById('love-btn').onclick = () => {
    const partner = (myName === 'francine') ? "justine" : "francine";
    runTransaction(ref(db, `gameData/players/${partner}/poke`), p => (p || 0) + 1);
    spawnHeart();
};

if (myName) initGame();