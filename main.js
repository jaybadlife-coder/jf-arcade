import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, runTransaction, onDisconnect, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

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

let myName = localStorage.getItem('petPlayerName');
const partnerName = myName === 'justine' ? 'francine' : 'justine';
const XP_GOAL = 5000;

// --- 1. IDENTITY & AUTH ---
window.checkAccess = () => {
    const key = document.getElementById('access-key').value.trim().toLowerCase();
    if (["justine", "francine", "j", "f"].includes(key)) {
        const finalName = (key === 'j' || key === 'justine') ? 'justine' : 'francine';
        document.getElementById('login-zone').style.display = 'none';
        document.getElementById('loading-bar-container').style.display = 'block';
        
        let prog = 0;
        const interval = setInterval(() => {
            prog += 5;
            document.getElementById('load-fill').style.width = prog + "%";
            if(prog >= 100) {
                clearInterval(interval);
                localStorage.setItem('petPlayerName', finalName);
                location.reload();
            }
        }, 30);
    } else {
        document.getElementById('error-msg').style.display = 'block';
    }
};

window.logout = () => { if(confirm("TERMINATE SESSION?")) { localStorage.clear(); location.reload(); } };

// --- 2. PET & DEX DATA ---
const PET_DATABASE = {
    common: ["🐱", "🐶", "🐰", "🦊", "🐸"],
    rare: ["🦁", "🐯", "🐼", "🐨"],
    ultra_rare: ["🐉", "🦄", "👾", "👑", "💎"]
};

window.openDex = async () => {
    const snap = await get(ref(db, 'gameData/unlockedPets'));
    const unlocked = snap.val() || {};
    const grid = document.getElementById('pet-grid');
    grid.innerHTML = "";
    let urCount = 0;
    PET_DATABASE.ultra_rare.forEach(pet => {
        const isUnlocked = unlocked[pet];
        if(isUnlocked) urCount++;
        grid.innerHTML += `<div class="pet-slot ${isUnlocked ? 'ultra-rare ultra-rare-glow' : 'locked'}">${isUnlocked ? pet : '❓'}</div>`;
    });
    document.getElementById('rare-count').innerText = urCount;
    document.getElementById('dex-overlay').style.display = 'flex';
};
window.closeDex = () => document.getElementById('dex-overlay').style.display = 'none';

// --- 3. DAILY GIFT SYSTEM ---
window.openGift = () => {
    runTransaction(ref(db, `gameData/players/${myName}`), p => {
        if (!p) return p;
        const now = Date.now();
        const lastGift = p.lastGiftTime || 0;
        if (now - lastGift > 86400000) { 
            p.cookies = (p.cookies || 0) + 50;
            p.lastGiftTime = now;
            showNotif("GIFT CLAIMED: +50 🍪");
        } else { showNotif("READY AGAIN IN 24H! ⏳"); }
        return p;
    });
};

// --- 4. THE 15-GAME ENGINE ---
const GameLibrary = {
    tap: (diff, reward) => {
        let c = 0, target = diff === "Hard" ? 60 : 25;
        document.getElementById('game-screen').innerHTML = `<h3>TAP ${target}x!</h3><h1 id="v" class="blink">0</h1><button class="arcade-btn feed-btn-style" id="g-btn">TAP!</button>`;
        document.getElementById('g-btn').onclick = () => { c++; document.getElementById('v').innerText = c; if(c>=target) window.win(reward); };
    },
    math: (diff, reward) => {
        let a = Math.floor(Math.random()*(diff==="Hard"?100:20)), b = Math.floor(Math.random()*(diff==="Hard"?100:20));
        document.getElementById('game-screen').innerHTML = `<h3>${a} + ${b} = ?</h3><input type="number" id="ans" class="game-input"><button class="util-btn" id="s">OK</button>`;
        document.getElementById('s').onclick = () => { if(document.getElementById('ans').value == a+b) window.win(reward); else showNotif("WRONG!"); };
    },
    match: (diff, reward) => {
        const colors = ["RED", "BLUE", "GREEN", "YELLOW"];
        const target = colors[Math.floor(Math.random()*colors.length)];
        document.getElementById('game-screen').innerHTML = `<h3>TAP ${target}</h3><div id="btns" style="display:grid; grid-template-columns:1fr 1fr; gap:5px;"></div>`;
        colors.forEach(col => {
            let b = document.createElement('button'); b.className="util-btn"; b.innerText=col;
            b.onclick = () => { if(col === target) window.win(reward); else showNotif("WRONG!"); };
            document.getElementById('btns').appendChild(b);
        });
    },
    lucky: (diff, reward) => {
        document.getElementById('game-screen').innerHTML = `<h3>PICK A CHEST</h3><button class="util-btn" onclick="Math.random()>0.5?window.win(${reward}):showNotif('EMPTY!')">📦</button> <button class="util-btn" onclick="Math.random()>0.5?window.win(${reward}):showNotif('EMPTY!')">📦</button>`;
    },
    reaction: (diff, reward) => {
        document.getElementById('game-screen').innerHTML = `<div id="box" style="width:100px; height:100px; background:red; margin:20px auto; display:flex; align-items:center; justify-content:center;">WAIT...</div>`;
        setTimeout(() => {
            const b = document.getElementById('box'); if(!b) return;
            b.style.background = "green"; b.innerText = "TAP NOW!";
            b.onclick = () => window.win(reward);
        }, Math.random()*3000 + 1500);
    },
    brick: (diff, reward) => {
        let hp = diff === "Hard" ? 15 : 7;
        document.getElementById('game-screen').innerHTML = `<h3>BREAK IT!</h3><h1 id="hp">${hp}</h1><button class="util-btn" id="hit">HIT! 🔨</button>`;
        document.getElementById('hit').onclick = () => { hp--; document.getElementById('hp').innerText = hp; if(hp<=0) window.win(reward); };
    },
    snake: (diff, reward) => {
        document.getElementById('game-screen').innerHTML = `<h3>CATCH 5!</h3><div id="dot" style="position:absolute; font-size:25px; cursor:pointer; transition:0.1s;">🍎</div>`;
        const d = document.getElementById('dot'); let hits = 0;
        d.onclick = () => { hits++; d.style.left = Math.random()*80+"%"; d.style.top = Math.random()*70+"%"; if(hits >= 5) window.win(reward); };
    },
    memory: (diff, reward) => {
        const code = Math.floor(1000 + Math.random()*8999);
        document.getElementById('game-screen').innerHTML = `<h3>REMEMBER:</h3><h1>${code}</h1>`;
        setTimeout(() => {
            document.getElementById('game-screen').innerHTML = `<h3>TYPE CODE:</h3><input type="number" id="ans" class="game-input"><button class="util-btn" id="s">OK</button>`;
            document.getElementById('s').onclick = () => { if(document.getElementById('ans').value == code) window.win(reward); else showNotif("WRONG!"); };
        }, 2500);
    },
    avoid: (diff, reward) => {
        document.getElementById('game-screen').innerHTML = `<h3>TAP DIAMOND 💎</h3><div style="font-size:40px;"><span onclick="window.win(${reward})">💎</span> <span onclick="showNotif('BOOM!')">💣</span></div>`;
    },
    hilo: (diff, reward) => {
        let n = Math.floor(Math.random()*100);
        document.getElementById('game-screen').innerHTML = `<h3>NEXT > ${n}?</h3><button class="util-btn" id="h">HIGHER</button> <button class="util-btn" id="l">LOWER</button>`;
        const check = (c) => { let next = Math.floor(Math.random()*100); if((c==='h'&&next>n)||(c==='l'&&next<n)) window.win(reward); else showNotif("LOSE!"); };
        document.getElementById('h').onclick = () => check('h'); document.getElementById('l').onclick = () => check('l');
    },
    type: (diff, reward) => {
        const words = ["COMPUTER", "ARCADE", "JUSTINE", "FRANCINE"];
        const target = words[Math.floor(Math.random()*words.length)];
        document.getElementById('game-screen').innerHTML = `<h3>TYPE: ${target}</h3><input id="ans" class="game-input"><button class="util-btn" id="s">OK</button>`;
        document.getElementById('s').onclick = () => { if(document.getElementById('ans').value.toUpperCase() === target) window.win(reward); };
    },
    emoji: (diff, reward) => {
        document.getElementById('game-screen').innerHTML = `<h3>FIND 🍦</h3><div style="font-size:35px;"><span onclick="showNotif('X')">🍧</span><span onclick="window.win(${reward})">🍦</span><span onclick="showNotif('X')">🍨</span></div>`;
    },
    coin: (diff, reward) => {
        document.getElementById('game-screen').innerHTML = `<h3>HEADS/TAILS?</h3><button class="util-btn" onclick="Math.random()>0.5?window.win(${reward}):showNotif('WRONG')">HEADS</button> <button class="util-btn" onclick="Math.random()>0.5?window.win(${reward}):showNotif('WRONG')">TAILS</button>`;
    },
    draw: (diff, reward) => {
        document.getElementById('game-screen').innerHTML = `<h3>TAP 10x</h3><div id="c" style="width:100px; height:100px; background:#444; margin:auto"></div>`;
        let t = 0; document.getElementById('c').onclick = () => { t++; if(t>=10) window.win(reward); };
    },
    word: (diff, reward) => {
        document.getElementById('game-screen').innerHTML = `<h3>E-D-O-C</h3><input id="ans" class="game-input"><button class="util-btn" id="s">OK</button>`;
        document.getElementById('s').onclick = () => { if(document.getElementById('ans').value.toUpperCase()==="CODE") window.win(reward); };
    }
};

// --- 5. CORE SYNC ---
if (myName) {
    document.getElementById('fs-overlay').style.display = 'none';
    document.getElementById('my-name-display').innerText = myName.toUpperCase();

    onValue(ref(db, 'gameData'), (snap) => {
        const data = snap.val(); if (!data) return;
        const pet = data.sharedPet || { xp: 0, currentPet: "🥚" };
        const me = data.players?.[myName] || { cookies: 0, score: 0 };
        const partner = data.players?.[partnerName] || { score: 0 };

        document.getElementById('cookie-count').innerText = me.cookies.toString().padStart(4, '0');
        document.getElementById('score-justine').innerText = (myName === 'justine' ? me.score : partner.score);
        document.getElementById('score-francine').innerText = (myName === 'francine' ? me.score : partner.score);
        document.getElementById('current-xp').innerText = pet.xp;
        document.getElementById('progress-fill').style.width = (pet.xp/XP_GOAL*100) + "%";
        document.getElementById('pet-display').innerText = pet.currentPet;

        const overlay = document.getElementById('game-overlay');
        if (data.activeGame) {
            overlay.style.display = 'flex';
            if (data.activeGame.status === "voting") renderVoting(data.activeGame.type);
            else if (data.activeGame.status === "playing") {
                const reward = data.activeGame.difficulty === "Hard" ? 15 : 2;
                if(GameLibrary[data.activeGame.type]) GameLibrary[data.activeGame.type](data.activeGame.difficulty, reward);
            }
        } else { overlay.style.display = 'none'; }
    });
}

// ACTIONS
document.getElementById('feed-btn').onclick = () => {
    runTransaction(ref(db, 'gameData'), (data) => {
        if (!data || !data.players?.[myName] || data.players[myName].cookies <= 0) { showNotif("NEED COOKIES!"); return data; }
        data.players[myName].cookies--;
        data.sharedPet.xp = Math.min((data.sharedPet.xp || 0) + 25, XP_GOAL);
        return data;
    });
};

window.requestGame = (type) => set(ref(db, 'gameData/activeGame'), { type, status: "voting", sender: myName });
window.castVote = (diff) => update(ref(db, 'gameData/activeGame'), { status: "playing", difficulty: diff });
window.win = (amt) => {
    runTransaction(ref(db, `gameData/players/${myName}`), p => {
        if (p) { p.cookies = (p.cookies || 0) + amt; p.score = (p.score || 0) + 1; }
        return p;
    });
    set(ref(db, 'gameData/activeGame'), null);
    showNotif(`WIN! +${amt} 🍪`);
};
window.requestCloseGame = () => set(ref(db, 'gameData/activeGame'), null);

function renderVoting(type) {
    document.getElementById('game-title').innerText = "VOTE DIFFICULTY";
    document.getElementById('game-screen').innerHTML = `<p>${type.toUpperCase()}</p>
        <button class="util-btn" onclick="window.castVote('Easy')">EASY (2🍪)</button>
        <button class="util-btn" onclick="window.castVote('Hard')">HARD (15🍪)</button>`;
}

function showNotif(m) {
    const b = document.getElementById('notif-banner'); b.innerText = m;
    b.classList.remove('hidden-notif'); setTimeout(() => b.classList.add('hidden-notif'), 2000);
}