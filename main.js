import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, runTransaction, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// --- FIREBASE CONFIG (STAY AS IS) ---
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

// --- 1. SHARED PET LIBRARY (7 STAGES) ---
const petLibrary = [
    { id: 0, name: "Baby Dragon", icons: ["🥚", "🐥", "🦅", "🐉", "🔥", "💎", "🔱"], type: "normal" },
    { id: 1, name: "Neon Phoenix", icons: ["🥚", "🐤", "🐦", "🔥", "☄️", "☀️", "👑"], type: "normal" },
    { id: 2, name: "Sea Serpent", icons: ["🥚", "🐠", "🐟", "🐬", "🐳", "🌊", "🔱"], type: "normal" },
    { id: 3, name: "Cyber Mecha", icons: ["🔋", "🤖", "⚙️", "🛰️", "🚀", "🛸", "🌌"], type: "normal" },
    { id: 99, name: "MYSTIC NEBULA", icons: ["✨", "☁️", "🌌", "🌠", "🔮", "👽", "🪐"], type: "rare" }
];

// --- 2. IDENTITY & CORE ---
let myName = localStorage.getItem('petPlayerName');

window.checkAccess = function() {
    const input = document.getElementById('access-key').value.trim().toLowerCase();
    const allowed = ["francine", "justine"];
    if (allowed.includes(input)) {
        localStorage.setItem('petPlayerName', input);
        document.getElementById('fs-overlay').style.display = 'none';
        initGame();
    } else { 
        const err = document.getElementById('error-msg');
        err.style.display = 'block';
        setTimeout(() => err.style.display = 'none', 2000);
    }
};

// --- 3. AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSfx(f, t) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(0.05, audioCtx.currentTime);
    o.start(); o.stop(audioCtx.currentTime + t);
}

// --- 4. THE SHARED ENGINE ---
function initGame() {
    if (!myName) return;
    document.getElementById('my-name-display').innerText = myName.toUpperCase();
    let partner = (myName === 'francine') ? "justine" : "francine";

    // 4A. SHARED PET SYNC (HARD MODE LOGIC)
    onValue(ref(db, 'gameData'), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const shared = data.sharedPet || { xp: 0, level: 1, currentPetId: 0 };
        const me = data.players[myName] || { cookies: 0 };
        const her = data.players[partner] || { lastFeed: "" };
        const today = new Date().toDateString();

        // UI: COOKIES & STREAK
        document.getElementById('cookie-count').innerText = (me.cookies || 0).toString().padStart(4, '0');
        document.getElementById('duo-streak-val').textContent = (data.streak || 0).toString().padStart(2, '0');

        // UI: HARD MODE XP BAR (500 XP CAP)
        const xpPercent = (shared.xp / 500) * 100;
        document.getElementById('progress-fill').style.width = xpPercent + "%";
        document.getElementById('xp-text-label').innerText = `XP: ${shared.xp} / 500 (STAGE ${shared.level})`;

        // PET RENDERING & NIGHT CHECK
        const currentPet = petLibrary.find(p => p.id === shared.currentPetId) || petLibrary[0];
        const display = document.getElementById('pet-display');
        const hour = new Date().getHours();
        const isNight = hour >= 21 || hour < 6;

        if (isNight) {
            display.innerText = "😴";
            document.body.classList.add('night-mode');
            document.getElementById('pet-name-label').innerText = "RESTING...";
        } else {
            display.innerText = currentPet.icons[shared.level - 1] || "🐉";
            document.body.classList.remove('night-mode');
            document.getElementById('pet-name-label').innerText = `OUR ${currentPet.name.toUpperCase()}`;
        }

        // EVOLVE BUTTON (LALABAS LANG PAG 1,000 TOTAL XP NA SA STAGE 7)
        const btn = document.getElementById('ascend-btn');
        if (shared.level >= 7 && !isNight) btn.classList.remove('hidden-btn');
        else btn.classList.add('hidden-btn');

        // PARTNER STATUS
        const pStat = document.getElementById('partner-status');
        if (her.lastFeed === today) {
            pStat.innerText = "PARTNER STATUS: FED ✅";
            pStat.style.color = "#0f0";
        } else {
            pStat.innerText = "PARTNER STATUS: WAITING ⏳";
            pStat.style.color = "#555";
        }
    });

    // 4B. NOTE SYNC
    onValue(ref(db, 'gameData/dailyNote'), (snap) => {
        if (snap.val()) {
            const input = document.getElementById('daily-note-input');
            if (snap.val().by !== myName) {
                input.value = ""; 
                input.placeholder = `MSG: ${snap.val().text}`;
                showNotif(`Message from Love! 💌`);
            } else {
                input.value = snap.val().text;
            }
        }
    });

    // 4C. HEART SYNC
    onValue(ref(db, `gameData/players/${myName}/poke`), (snap) => {
        if (snap.val() > 0) {
            spawnHeart();
            playSfx(880, 0.2);
            update(ref(db, `gameData/players/${myName}`), { poke: 0 });
        }
    });

    updateWeather();
    setInterval(updateWeather, 600000);
    spawnZZZ(); 
}

// --- 5. CORE ACTIONS (SHARED LOGIC) ---
document.getElementById('feed-btn').onclick = () => {
    const today = new Date().toDateString();
    
    // Step 1: Check Cookies ng User
    runTransaction(ref(db, `gameData/players/${myName}`), p => {
        if (p && p.cookies > 0) {
            if (p.lastFeed === today) { showNotif("Only 1 feed per day! 😋"); return p; }
            p.cookies--;
            p.lastFeed = today;
            
            // Step 2: Update Shared XP (5 XP per feed, 500 XP to evolve)
            runTransaction(ref(db, 'gameData/sharedPet'), s => {
                if (!s) s = { xp: 0, level: 1, currentPetId: 0 };
                s.xp += 5;
                if (s.xp >= 500 && s.level < 7) {
                    s.level++;
                    s.xp = 0;
                    playSfx(1000, 0.4);
                    showNotif("PET EVOLVED! ✨");
                }
                return s;
            });

            playSfx(400, 0.1);
            showNotif("Feeding Pet... 🍪");
        } else {
            showNotif("Need more cookies! 🍪");
        }
        return p;
    });
};

window.ascendPet = () => {
    runTransaction(ref(db, 'gameData'), data => {
        if (data && data.sharedPet.level >= 7) {
            // I-save sa global collection (o i-notif lang muna)
            data.sharedPet.currentPetId = Math.floor(Math.random() * 4); 
            data.sharedPet.level = 1; 
            data.sharedPet.xp = 0;
            showNotif("NEW SHARED EGG UNLOCKED! 🥚");
        }
        return data;
    });
};

// --- THE REST OF UTILS (STAY AS IS) ---
window.saveNote = () => {
    const text = document.getElementById('daily-note-input').value.trim();
    if (!text) return;
    set(ref(db, 'gameData/dailyNote'), { text: text, by: myName });
    showNotif("Note Sent! 💌");
    playSfx(600, 0.1);
};

window.openGame = (type) => {
    document.getElementById('game-overlay').style.display = 'flex';
    const s = document.getElementById('game-screen');
    const t = document.getElementById('game-title');
    if (type === 'tap') {
        t.innerText = "TAP HERO";
        s.innerHTML = `<button class="arcade-btn feed" style="margin:auto" onclick="win(1)">TAP!</button>`;
    } else if (type === 'math') {
        let a = Math.floor(Math.random()*30), b = Math.floor(Math.random()*30);
        t.innerText = `${a} + ${b} = ?`;
        s.innerHTML = `<input id="ans" type="number" class="game-input" style="background:#000; color:#0f0; border:1px solid #0f0; text-align:center;"><br><button class="start-btn" onclick="checkM(${a+b},3)" style="margin-top:10px;">SUBMIT</button>`;
    } else if (type === 'guess') {
        let targ = Math.ceil(Math.random()*3);
        t.innerText = "LUCKY 3";
        s.innerHTML = `<div style="display:flex; gap:10px; justify-content:center;"><button class="game-btn" onclick="checkG(1,${targ},5)">1</button><button class="game-btn" onclick="checkG(2,${targ},5)">2</button><button class="game-btn" onclick="checkG(3,${targ},5)">3</button></div>`;
    } else if (type === 'color') {
        t.innerText = "REACTION";
        s.innerHTML = `<div id="box" style="width:80px;height:80px;background:red;margin:auto;border-radius:10px;"></div>`;
        setTimeout(() => { 
            let b=document.getElementById('box'); 
            if(b){ b.style.background='#0f0'; b.innerText="TAP!"; b.style.lineHeight="80px"; b.onclick=()=>win(4); } 
        }, Math.random()*2000+1000);
    } else if (type === 'reflex') {
        t.innerText = "FAST!";
        s.innerHTML = `<div id="target" style="width:40px;height:40px;background:yellow;position:absolute;border-radius:50%;" onclick="win(8)"></div>`;
        const tar = document.getElementById('target');
        tar.style.left = Math.random()*80+"%"; tar.style.top = Math.random()*60+"%";
    }
};

window.win = (a) => {
    runTransaction(ref(db, `gameData/players/${myName}/cookies`), c => (c || 0) + a);
    closeGame();
    playSfx(900, 0.2);
    showNotif(`Win! +${a} 🍪`);
};

window.closeGame = () => document.getElementById('game-overlay').style.display = 'none';
window.checkM = (r, a) => { if(parseInt(document.getElementById('ans').value)===r) win(a); else fail(); };
window.checkG = (p, t, a) => { if(p===t) win(a); else fail(); };
function fail() { closeGame(); playSfx(100, 0.3); showNotif("Try again! ❌"); }

function showNotif(msg) {
    const b = document.getElementById('notif-banner');
    if(!b) return;
    b.innerText = msg;
    b.classList.remove('hidden-notif');
    setTimeout(() => b.classList.add('hidden-notif'), 3000);
}

function spawnHeart() {
    const h = document.createElement('div'); h.innerHTML = "💖";
    h.className = "heart-fx";
    h.style.left = Math.random() * 80 + 10 + "%";
    h.style.bottom = "20%";
    h.style.animation = "heart-up 1.5s forwards";
    document.getElementById('heart-container').appendChild(h);
    setTimeout(() => h.remove(), 1500);
}

document.getElementById('love-btn').onclick = () => {
    let partner = (myName === 'francine') ? "justine" : "francine";
    runTransaction(ref(db, `gameData/players/${partner}/poke`), p => (p || 0) + 1);
    spawnHeart();
    playSfx(660, 0.1);
};

window.toggleNightMode = () => {
    document.body.classList.toggle('night-mode');
    showNotif("Mode Switched! 🌓");
};

async function updateWeather() {
    try {
        const res = await fetch('https://wttr.in/?format=%c+%t');
        if (res.ok) {
            const data = await res.text();
            document.getElementById('weather-display').innerText = data.trim();
        }
    } catch (e) { document.getElementById('weather-display').innerText = "☁️ 28°C"; }
}

function spawnZZZ() {
    if (document.body.classList.contains('night-mode')) {
        const z = document.createElement('div');
        z.className = "sleep-zzz";
        z.innerText = "Z";
        z.style.left = (Math.random() * 20 + 50) + "%";
        z.style.top = (Math.random() * 10 + 30) + "%";
        document.getElementById('pet-area').appendChild(z);
        setTimeout(() => z.remove(), 3000);
    }
    setTimeout(spawnZZZ, 2000);
}

if (myName) initGame();