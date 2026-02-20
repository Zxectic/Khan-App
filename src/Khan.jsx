import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RANKS = [
  { name:"WOOD",          icon:"🪵", badge:"🪵", threshold:0,      tier:1,  color:"#8B6914",  desc:"Just starting out" },
  { name:"ROCK",          icon:"🪨", badge:"🪨", threshold:500,    tier:2,  color:"#9e9e9e",  desc:"Building foundations" },
  { name:"IRON",          icon:"⚙️",  badge:"⚙️",  threshold:1500,   tier:3,  color:"#b0bec5",  desc:"Forged by discipline" },
  { name:"BRONZE",        icon:"🥉", badge:"🛡️", threshold:3000,   tier:4,  color:"#cd7f32",  desc:"Consistency unlocked" },
  { name:"SILVER",        icon:"🥈", badge:"⚔️", threshold:6000,   tier:5,  color:"#c0c0c0",  desc:"Rising performer" },
  { name:"GOLD",          icon:"🥇", badge:"🏅", threshold:10000,  tier:6,  color:"#ffd700",  desc:"Elite mindset" },
  { name:"PLATINUM",      icon:"💠", badge:"💠", threshold:16000,  tier:7,  color:"#00bcd4",  desc:"Rare dedication" },
  { name:"DIAMOND",       icon:"💎", badge:"💎", threshold:25000,  tier:8,  color:"#69d2e7",  desc:"Unbreakable" },
  { name:"CHAMPION",      icon:"🏆", badge:"🏆", threshold:40000,  tier:9,  color:"#ff9500",  desc:"Born to win" },
  { name:"GRAND CHAMPION",icon:"👑", badge:"👑", threshold:60000,  tier:10, color:"#ffd700",  desc:"Legendary status" },
  { name:"TITAN",         icon:"⚡", badge:"🌟", threshold:100000, tier:11, color:"#e040fb",  desc:"Transcendent" },
];

const DAILY_QUESTS = [
  { id:"nutrition",  label:"Log nutrition",              xp:30,  icon:"🍎", penalty:25 },
  { id:"water8",     label:"Drink 8 glasses of water",   xp:50,  icon:"💧", penalty:20 },
  { id:"sleep",      label:"Log last night's sleep",     xp:40,  icon:"😴", penalty:30 },
  { id:"backtest",   label:"Complete 1+ backtest",       xp:50,  icon:"🔬", penalty:40 },
  { id:"study30",    label:"Study 30+ minutes",          xp:60,  icon:"📚", penalty:35 },
  { id:"meditation", label:"Meditate (any duration)",    xp:30,  icon:"🧘", penalty:20 },
  { id:"journal",    label:"Write daily journal",        xp:25,  icon:"📔", penalty:15 },
  { id:"rnd",        label:"Complete R&D session",       xp:60,  icon:"🔬", penalty:40 },
  { id:"trade",      label:"Log a trade",                xp:20,  icon:"📈", penalty:15 },
  { id:"workout",    label:"Log a workout",              xp:50,  icon:"💪", penalty:35 },
];

const TABS = ["DASHBOARD","PHYSICAL","NUTRITION","TRADING","STUDY & R&D","MIND","GOALS","LEADERBOARD"];
const TAB_ICONS = ["⬡","💪","🍎","📈","📚","🧘","🎯","🏆"];

const CAT_ICONS  = { trading:"📈", finance:"💰", health:"💪", asset:"🏦", mindset:"🧘", education:"📚", lifestyle:"✨" };
const CAT_COLORS = { trading:"#00e5a0", finance:"#ffd700", health:"#fc5c7d", asset:"#ff7b00", mindset:"#7c5cfc", education:"#00b4ff", lifestyle:"#fc5c7d" };

const todayStr = () => new Date().toISOString().slice(0,10);
const dayOfWeek = () => (new Date().getDay() + 6) % 7; // Mon=0

const DEFAULT_STATE = {
  xp: 0,
  streak: 0,
  lastActiveDate: null,
  dailyXp: 0,
  decayLog: [],          // log of past XP deductions
  weeklyData: [0,0,0,0,0,0,0],
  lastWeekReset: null,
  dailyTasks: {},        // { questId: true }
  dailyTaskDate: null,   // date string when tasks were last reset

  nutrition: { calories:0, calorieGoal:2000, protein:0, carbs:0, fat:0, logged:false },
  water: { count:0 },
  sleep: { hours:7, quality:0, logged:false },

  trading: { backtests:0, backtestHours:0, trades:[] },
  study: { totalMinutes:0 },
  rnd: { sessions:0, notes:[] },
  meditation: { totalMinutes:0, logged:false },
  journal: { mood:0, logged:false },
  goals: [],
  wellbeing: { energy:0, stress:0, prod:0 },
  physical: { workouts:[], totalVolume:0 },
  decayStreak: 0, // consecutive missed days for exponential decay
};

// ─── HELPER: rank from xp ─────────────────────────────────────────────────────
function rankFor(xp) {
  let r = RANKS[0];
  for (const rank of RANKS) { if (xp >= rank.threshold) r = rank; }
  return r;
}
function nextRank(xp) {
  for (const rank of RANKS) { if (xp < rank.threshold) return rank; }
  return null;
}
function rankPct(xp) {
  const cur = rankFor(xp); const nxt = nextRank(xp);
  if (!nxt) return 1;
  return (xp - cur.threshold) / (nxt.threshold - cur.threshold);
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@300;400;600&family=Syne:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0a0a0f;color:#e8e8f0;font-family:'JetBrains Mono',monospace;}
  ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#0a0a0f;} ::-webkit-scrollbar-thumb{background:#7c5cfc44;border-radius:2px;}
  input[type=range]{-webkit-appearance:none;width:100%;height:4px;background:#1a1a24;border-radius:2px;outline:none;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#7c5cfc,#fc5c7d);cursor:pointer;box-shadow:0 0 8px #7c5cfc88;}
  @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
  @keyframes xpFloat{0%{opacity:1;transform:translateY(0) scale(.5);}20%{transform:translateY(-10px) scale(1.2);}100%{opacity:0;transform:translateY(-80px) scale(1);}}
  @keyframes rankPop{from{transform:scale(.5);opacity:0;}to{transform:scale(1);opacity:1;}}
  @keyframes fireFlicker{from{transform:scale(1) rotate(-3deg);}to{transform:scale(1.1) rotate(3deg);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes decayShake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);}}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 #fc5c7d44;}50%{box-shadow:0 0 0 8px transparent;}}
`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Khan() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [xpPopups, setXpPopups] = useState([]);
  const [rankUpModal, setRankUpModal] = useState(null);
  const [decayModal, setDecayModal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Nutrition form state
  const [calSlider, setCalSlider] = useState(0);
  const [calGoal, setCalGoal] = useState(2000);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // Sleep
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQ, setSleepQ] = useState(0);

  // Trading
  const [btCount, setBtCount] = useState(0);
  const [btHours, setBtHours] = useState(1);
  const [btStrategy, setBtStrategy] = useState('');
  const [btWr, setBtWr] = useState(50);
  const [btNotes, setBtNotes] = useState('');
  const [tradeResult, setTradeResult] = useState('');
  const [tradePnl, setTradePnl] = useState('');
  const [tradeInstrument, setTradeInstrument] = useState('');
  const [tradeEmotion, setTradeEmotion] = useState('');
  const [tradeDate, setTradeDate] = useState(todayStr());

  // Study
  const [studySubject, setStudySubject] = useState('');
  const [studyMins, setStudyMins] = useState(30);
  const [studyFocus, setStudyFocus] = useState(0);

  // RnD
  const [rndNote, setRndNote] = useState('');
  const [rndChecked, setRndChecked] = useState(new Set());

  // Mind
  const [medMins, setMedMins] = useState(10);
  const [medType, setMedType] = useState('');
  const [journalMood, setJournalMood] = useState(0);
  const [gratitude, setGratitude] = useState('');
  const [reflection, setReflection] = useState('');
  const [wellEnergy, setWellEnergy] = useState(0);
  const [wellStress, setWellStress] = useState(0);
  const [wellProd, setWellProd] = useState(0);

  // Goals
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCat, setGoalCat] = useState('trading');
  const [goalDate, setGoalDate] = useState('');
  const [goalXp, setGoalXp] = useState(500);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginInput, setLoginInput] = useState('');
  const [loginScreen, setLoginScreen] = useState(true);

  const popupId = useRef(0);

  // ── LOAD from storage ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const userKey = `khan:state:${currentUser}`;
        const res = await window.storage.get(userKey);
        if (res && res.value) {
          const loaded = JSON.parse(res.value);
          const merged = { ...DEFAULT_STATE, ...loaded };
          const processed = processDayChange(merged);
          setState(processed);
          // If day changed, persist the updated state (decay, resets, etc.)
          if (processed !== merged) {
            await window.storage.set(`khan:state:${currentUser}`, JSON.stringify(processed));
            await window.storage.set(`khan:profile:${currentUser}`, JSON.stringify({ username: currentUser, xp: processed.xp, rank: rankFor(processed.xp).name, streak: processed.streak }), true);
          }
        } else {
          const fresh = { ...DEFAULT_STATE, dailyTaskDate: todayStr() };
          setState(fresh);
          await window.storage.set(`khan:state:${currentUser}`, JSON.stringify(fresh));
        }
      } catch {
        setState({ ...DEFAULT_STATE, dailyTaskDate: todayStr() });
      }
      setLoading(false);
    })();
  }, [currentUser]);

  // ── SAVE to storage ────────────────────────────────────────────────────────
  const save = useCallback(async (newState) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await window.storage.set(`khan:state:${currentUser}`, JSON.stringify(newState));
      // Also save public profile for leaderboard
      await window.storage.set(`khan:profile:${currentUser}`, JSON.stringify({ username: currentUser, xp: newState.xp, rank: rankFor(newState.xp).name, streak: newState.streak }), true);
    } catch(e) { console.error('Save failed', e); }
    setSaving(false);
  }, [currentUser]);

  // ── DAY CHANGE PROCESSING (XP Decay + quest reset) ──────────────────────────
  function processDayChange(s) {
    const today = todayStr();
    if (s.dailyTaskDate === today) return s;

    let newS = { ...s };

    // How many days have passed since last active?
    let daysMissed = 1;
    if (s.dailyTaskDate) {
      const last = new Date(s.dailyTaskDate);
      const now = new Date(today);
      const diff = Math.round((now - last) / (1000 * 60 * 60 * 24));
      daysMissed = Math.max(1, diff);
    }

    if (s.dailyTaskDate) {
      const missedQuests = DAILY_QUESTS.filter(q => !s.dailyTasks[q.id]);
      const basePenalty = missedQuests.reduce((sum, q) => sum + q.penalty, 0);

      if (basePenalty > 0 || daysMissed > 1) {
        // Exponential decay: base * 2^(decayStreak) for each missed day
        // decayStreak tracks consecutive missed days
        let currentDecayStreak = s.decayStreak || 0;
        let totalPenalty = 0;
        const decayEntries = [];

        for (let d = 0; d < daysMissed; d++) {
          // Each missed day the multiplier doubles
          const multiplier = Math.pow(2, currentDecayStreak);
          const dayPenalty = Math.min(basePenalty * multiplier, newS.xp); // can't go below 0
          totalPenalty += dayPenalty;
          const missedDate = new Date(s.dailyTaskDate);
          missedDate.setDate(missedDate.getDate() + d);
          decayEntries.push({
            date: missedDate.toISOString().slice(0, 10),
            penalty: Math.round(dayPenalty),
            missed: missedQuests.map(q => q.label),
            multiplier: `×${multiplier}`
          });
          currentDecayStreak++;
        }

        newS.xp = Math.max(0, newS.xp - Math.round(totalPenalty));
        newS.decayStreak = currentDecayStreak;
        newS.decayLog = [
          ...decayEntries,
          ...(newS.decayLog || [])
        ].slice(0, 30);

        newS._pendingDecayModal = {
          penalty: Math.round(totalPenalty),
          missed: missedQuests,
          daysMissed,
          decayStreak: currentDecayStreak
        };
      } else {
        // They completed quests yesterday — reset decay streak
        newS.decayStreak = 0;
      }

      // Streak logic
      const completedYesterday = Object.keys(s.dailyTasks).length;
      if (completedYesterday >= Math.ceil(DAILY_QUESTS.length / 2) && daysMissed === 1) {
        newS.streak = (s.streak || 0) + 1;
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
        const yd = (yesterday.getDay() + 6) % 7;
        const wd = [...(newS.weeklyData || [0,0,0,0,0,0,0])];
        wd[yd] = 1;
        newS.weeklyData = wd;
      } else {
        newS.streak = 0;
      }

      const todayDow = (new Date().getDay() + 6) % 7;
      if (todayDow === 0) newS.weeklyData = [0,0,0,0,0,0,0];
    }

    // Reset daily
    newS.dailyTasks = {};
    newS.dailyXp = 0;
    newS.dailyTaskDate = today;
    newS.nutrition = { ...DEFAULT_STATE.nutrition };
    newS.water = { count: 0 };
    newS.sleep = { ...DEFAULT_STATE.sleep };
    newS.meditation = { ...DEFAULT_STATE.meditation };
    newS.journal = { ...DEFAULT_STATE.journal };
    newS.study = { totalMinutes: 0 };

    return newS;
  }

  // Handle pending decay modal after render
  useEffect(() => {
    if (state && state._pendingDecayModal) {
      setDecayModal(state._pendingDecayModal);
      const s = { ...state };
      delete s._pendingDecayModal;
      setState(s);
      save(s);
    }
  }, [state, save]);

  // ── XP MANAGEMENT ──────────────────────────────────────────────────────────
  function spawnPopup(amount, negative = false) {
    const id = ++popupId.current;
    const x = Math.random() * 300 + 100;
    setXpPopups(p => [...p, { id, amount, negative, x }]);
    setTimeout(() => setXpPopups(p => p.filter(pp => pp.id !== id)), 1600);
  }

  function addXp(amount, questId) {
    setState(prev => {
      if (!prev) return prev;
      const prevRank = rankFor(prev.xp);
      const newXp = prev.xp + amount;
      const newRank = rankFor(newXp);
      const newState = {
        ...prev,
        xp: newXp,
        dailyXp: (prev.dailyXp || 0) + amount,
        dailyTasks: questId ? { ...prev.dailyTasks, [questId]: true } : prev.dailyTasks,
      };
      save(newState);
      if (prevRank.name !== newRank.name) {
        setTimeout(() => setRankUpModal(newRank), 600);
      }
      return newState;
    });
    spawnPopup(amount, false);
  }

  function updateState(updater, extraQuestId) {
    setState(prev => {
      const newState = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (extraQuestId) newState.dailyTasks = { ...newState.dailyTasks, [extraQuestId]: true };
      save(newState);
      return newState;
    });
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  function handleLogin() {
    const name = loginInput.trim();
    if (!name) return;
    setCurrentUser(name);
    setLoginScreen(false);
    setLoading(true);
  }

  if (loginScreen) return (
    <div style={{ background:'#0a0a0f', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'JetBrains Mono',monospace" }}>
      <style>{css}</style>
      <div style={{ textAlign:'center', maxWidth:'360px', width:'90%' }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'4rem', letterSpacing:'12px', background:'linear-gradient(135deg,#7c5cfc,#fc5c7d)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'8px', animation:'float 3s ease-in-out infinite' }}>KHAN</div>
        <div style={{ fontSize:'0.65rem', color:'#5a5a70', letterSpacing:'4px', marginBottom:'40px' }}>// LIFE MAXXING</div>
        <div style={{ background:'#111118', border:'1px solid #ffffff0f', borderRadius:'20px', padding:'32px' }}>
          <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'3px', marginBottom:'10px' }}>ENTER YOUR USERNAME</div>
          <input value={loginInput} onChange={e=>setLoginInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="e.g. YourName" style={{ background:'#1a1a24', border:'1px solid #7c5cfc44', borderRadius:'10px', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.9rem', padding:'12px 16px', width:'100%', outline:'none', textAlign:'center', marginBottom:'14px', letterSpacing:'2px' }} autoFocus />
          <button onClick={handleLogin} style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'none', cursor:'pointer', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.75rem', letterSpacing:'2px', background:'linear-gradient(135deg,#7c5cfc,#fc5c7d)', color:'#fff', boxShadow:'0 4px 20px #7c5cfc44' }}>⚡ START MAXXING</button>
          <div style={{ fontSize:'0.58rem', color:'#5a5a70', letterSpacing:'1px', marginTop:'14px' }}>Your username is your save key. Use the same name to load your progress.</div>
        </div>
      </div>
    </div>
  );
  if (loading) return (
    <div style={{ background:'#0a0a0f', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'JetBrains Mono', color:'#7c5cfc', letterSpacing:'4px', fontSize:'0.8rem' }}>
      <style>{css}</style>
      <div>
        <div style={{ fontSize:'3rem', textAlign:'center', marginBottom:'16px', animation:'float 1.5s ease-in-out infinite' }}>⚡</div>
        <div>LOADING KHAN...</div>
      </div>
    </div>
  );

  if (!state) return null;

  const s = state;
  const rank = rankFor(s.xp);
  const next = nextRank(s.xp);
  const pct = rankPct(s.xp);
  const completedToday = Object.keys(s.dailyTasks).length;

  return (
    <div style={{ background:'#0a0a0f', minHeight:'100vh', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", overflow:'hidden auto' }}>
      <style>{css}</style>

      {/* XP Popups */}
      <div style={{ position:'fixed', bottom:'80px', right:'40px', zIndex:9999, pointerEvents:'none' }}>
        {xpPopups.map(p => (
          <div key={p.id} style={{ position:'absolute', bottom:0, right:p.x % 60, fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', color: p.negative ? '#fc5c7d' : '#ffd700', textShadow:`0 0 20px ${p.negative ? '#fc5c7d' : '#ffd700'}`, animation:'xpFloat 1.5s ease-out forwards', whiteSpace:'nowrap' }}>
            {p.negative ? '−' : '+'}{Math.abs(p.amount)} XP
          </div>
        ))}
      </div>

      {/* Rank Up Modal */}
      {rankUpModal && (
        <div style={{ position:'fixed', inset:0, background:'#0a0a0f99', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', animation:'fadeIn 0.3s ease' }}>
          <div style={{ background:'#111118', border:'1px solid #ffd70055', borderRadius:'24px', padding:'48px', textAlign:'center', boxShadow:'0 0 80px #ffd70022', animation:'rankPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ fontSize:'5rem', marginBottom:'16px' }}>{rankUpModal.icon}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'3rem', letterSpacing:'8px', color:'#ffd700', textShadow:'0 0 40px #ffd700' }}>RANK UP!</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'4px', color:'#ffd700', margin:'8px 0' }}>{rankUpModal.name}</div>
            <div style={{ fontSize:'0.7rem', color:'#5a5a70', letterSpacing:'3px', marginBottom:'24px' }}>TIER {rankUpModal.tier} ACHIEVED</div>
            <Btn primary onClick={() => setRankUpModal(null)}>✦ CLAIM RANK</Btn>
          </div>
        </div>
      )}

      {/* XP Decay Modal */}
      {decayModal && (
        <div style={{ position:'fixed', inset:0, background:'#0a0a0f99', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', animation:'fadeIn 0.3s ease' }}>
          <div style={{ background:'#111118', border:'1px solid #fc5c7d55', borderRadius:'24px', padding:'40px', textAlign:'center', maxWidth:'420px', width:'90%', animation:'rankPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ fontSize:'3rem', marginBottom:'12px' }}>💀</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'2rem', letterSpacing:'4px', color:'#fc5c7d', textShadow:'0 0 20px #fc5c7d' }}>XP DECAY</div>
            <div style={{ fontSize:'0.7rem', color:'#5a5a70', letterSpacing:'2px', margin:'8px 0 4px' }}>
              {decayModal.daysMissed > 1 ? `YOU MISSED ${decayModal.daysMissed} DAYS` : 'YOU MISSED QUESTS YESTERDAY'}
            </div>
            {decayModal.daysMissed > 1 && (
              <div style={{ fontSize:'0.65rem', color:'#ff9500', letterSpacing:'1px', marginBottom:'8px' }}>
                ⚠ EXPONENTIAL DECAY ACTIVE · DAY {decayModal.decayStreak}
              </div>
            )}
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'2.5rem', color:'#fc5c7d', marginBottom:'12px' }}>−{decayModal.penalty} XP</div>
            <div style={{ textAlign:'left', marginBottom:'16px', maxHeight:'160px', overflowY:'auto' }}>
              {decayModal.missed.map((m,i) => (
                <div key={i} style={{ fontSize:'0.65rem', color:'#5a5a70', padding:'4px 0', borderBottom:'1px solid #ffffff0f', letterSpacing:'1px' }}>✗ {m}</div>
              ))}
            </div>
            <div style={{ background:'#fc5c7d11', borderRadius:'8px', padding:'10px', marginBottom:'16px', fontSize:'0.62rem', color:'#fc5c7d', letterSpacing:'1px' }}>
              Miss again tomorrow and lose <strong style={{color:'#ff4444'}}>{decayModal.penalty * 2} XP</strong> · Stay consistent to reset the multiplier.
            </div>
            <Btn primary onClick={() => setDecayModal(null)} style={{ background:'linear-gradient(135deg,#fc5c7d,#7c5cfc)', width:'100%', justifyContent:'center' }}>I'LL DO BETTER TODAY</Btn>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 28px', borderBottom:'1px solid #ffffff0f', background:'linear-gradient(180deg,#12121e,transparent)', position:'sticky', top:0, zIndex:100, backdropFilter:'blur(12px)', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'6px', background:'linear-gradient(135deg,#7c5cfc,#fc5c7d)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>KHAN</div>
          <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'3px' }}>// LIFE MAXXING {saving && '· SAVING...'}</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.2rem', letterSpacing:'4px', color:'#ffd700', textShadow:'0 0 20px #ffd70066' }}>{rank.icon} {rank.name}</div>
          <div style={{ width:'180px', height:'5px', background:'#1a1a24', borderRadius:'3px', margin:'5px auto', overflow:'hidden' }}>
            <div style={{ width:`${pct*100}%`, height:'100%', background:'linear-gradient(90deg,#7c5cfc,#fc5c7d)', borderRadius:'3px', transition:'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }} />
          </div>
          <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'1px' }}>{s.xp.toLocaleString()} {next ? `/ ${next.threshold.toLocaleString()} XP` : 'XP · MAX RANK'}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1rem', color:'#ff7b00', letterSpacing:'2px' }}>
            <span style={{ animation:'fireFlicker 0.5s ease-in-out infinite alternate', display:'inline-block' }}>🔥</span> {s.streak} DAY STREAK
          </div>
          <div style={{ fontSize:'0.65rem', color:'#5a5a70', letterSpacing:'2px' }}>{new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase()}</div>
          <div style={{ fontSize:'0.65rem', color:'#7c5cfc', letterSpacing:'1px' }}>{s.dailyXp} XP TODAY</div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'4px', justifyContent:'flex-end' }}>
            <span style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'1px' }}>👤 {currentUser}</span>
            <button onClick={() => { setCurrentUser(null); setLoginScreen(true); setState(null); setLoading(false); }} style={{ background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'6px', color:'#5a5a70', fontFamily:"'JetBrains Mono'", fontSize:'0.55rem', padding:'3px 8px', cursor:'pointer', letterSpacing:'1px' }}>LOGOUT</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'24px 20px', display:'grid', gridTemplateColumns:'260px 1fr', gap:'20px', alignItems:'start' }}>

        {/* SIDEBAR */}
        <aside style={{ display:'flex', flexDirection:'column', gap:'14px', position:'sticky', top:'90px' }}>
          {/* Rank Card */}
          <Card style={{ textAlign:'center', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:'-40px', left:'50%', transform:'translateX(-50%)', width:'120px', height:'120px', background:'radial-gradient(circle,#7c5cfc33,transparent 70%)', pointerEvents:'none' }} />
            <div style={{ fontSize:'3rem', marginBottom:'8px', animation:'float 3s ease-in-out infinite', filter:'drop-shadow(0 0 12px #ffd700)' }}>{rank.icon}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.5rem', letterSpacing:'4px', color:'#ffd700', textShadow:'0 0 20px #ffd70055' }}>{rank.name}</div>
            <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'3px' }}>TIER {rank.tier}</div>
            <div style={{ margin:'14px 0', paddingTop:'14px', borderTop:'1px solid #ffffff0f' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'2rem', color:'#7c5cfc', letterSpacing:'2px' }}>{s.xp.toLocaleString()}</div>
              <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'3px' }}>TOTAL XP</div>
            </div>
            {next && <div style={{ fontSize:'0.65rem', color:'#5a5a70', letterSpacing:'1px' }}>{(next.threshold - s.xp).toLocaleString()} XP to {next.name}</div>}
          </Card>

          {/* Glance */}
          <Card>
            <div style={{ fontSize:'0.6rem', letterSpacing:'3px', color:'#5a5a70', marginBottom:'12px' }}>// TODAY AT A GLANCE</div>
            {[
              ['🍎 CALORIES', `${s.nutrition.calories} kcal`],
              ['💧 WATER', `${s.water.count} / 8`],
              ['📚 STUDY', `${s.study.totalMinutes} min`],
              ['🔬 BACKTESTS', `${s.trading.backtests}`],
              ['🧘 MEDITATION', s.meditation.logged ? `${s.meditation.totalMinutes} min ✓` : '—'],
              ['😴 SLEEP', s.sleep.logged ? `${s.sleep.hours}h` : '—'],
              ['✅ QUESTS', `${completedToday} / ${DAILY_QUESTS.length}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #ffffff0f', fontSize:'0.65rem' }}>
                <span style={{ color:'#5a5a70' }}>{label}</span>
                <span style={{ color:'#e8e8f0' }}>{val}</span>
              </div>
            ))}
          </Card>

          {/* Rank Ladder */}
          <Card>
            <div style={{ fontSize:'0.6rem', letterSpacing:'3px', color:'#5a5a70', marginBottom:'12px' }}>// RANK LADDER</div>
            {RANKS.map(r => (
              <div key={r.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', borderRadius:'8px', marginBottom:'3px', background: r.name === rank.name ? `${r.color}11` : 'transparent', border: r.name === rank.name ? `1px solid ${r.color}55` : '1px solid transparent', transition:'all 0.2s' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'1.1rem', filter: s.xp >= r.threshold ? 'none' : 'grayscale(1) opacity(0.3)' }}>{r.badge}</span>
                  <div>
                    <div style={{ fontSize:'0.65rem', color: r.name === rank.name ? '#e8e8f0' : s.xp >= r.threshold ? r.color : '#5a5a70', fontWeight: r.name === rank.name ? 700 : 400 }}>{r.name}</div>
                    {r.name === rank.name && <div style={{ fontSize:'0.52rem', color: r.color, letterSpacing:'1px' }}>{r.desc}</div>}
                  </div>
                </div>
                <span style={{ fontSize:'0.58rem', color: s.xp >= r.threshold ? '#00e5a0' : '#5a5a70' }}>{s.xp >= r.threshold ? '✓' : r.threshold.toLocaleString()}</span>
              </div>
            ))}
          </Card>

          {/* Decay Log */}
          {s.decayLog && s.decayLog.length > 0 && (
            <Card>
              <div style={{ fontSize:'0.6rem', letterSpacing:'3px', color:'#fc5c7d', marginBottom:'12px' }}>// DECAY HISTORY</div>
              {s.decayLog.slice(0,5).map((d,i) => (
                <div key={i} style={{ padding:'6px 0', borderBottom:'1px solid #ffffff0f', fontSize:'0.62rem' }}>
                  <div style={{ color:'#5a5a70' }}>{d.date}</div>
                  <div style={{ color:'#fc5c7d' }}>−{d.penalty} XP · {d.missed.length} missed</div>
                </div>
              ))}
            </Card>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:'3px', background:'#111118', border:'1px solid #ffffff0f', borderRadius:'12px', padding:'5px', marginBottom:'18px', flexWrap:'wrap' }}>
            {TABS.map((t,i) => (
              <button key={t} onClick={() => setTab(i)} style={{ flex:1, padding:'8px 10px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'0.6rem', letterSpacing:'1.5px', fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap', background: tab===i ? 'linear-gradient(135deg,#7c5cfc22,#fc5c7d11)' : 'transparent', color: tab===i ? '#e8e8f0' : '#5a5a70', borderColor: tab===i ? '#7c5cfc55' : 'transparent', outline: tab===i ? '1px solid #7c5cfc44' : 'none', transition:'all 0.2s' }}>
                {TAB_ICONS[i]} {t}
              </button>
            ))}
          </div>

          {/* ── DASHBOARD ── */}
          {tab===0 && <Dashboard s={s} addXp={addXp} updateState={updateState} />}
          {/* ── PHYSICAL ── */}
          {tab===1 && <PhysicalPanel s={s} addXp={addXp} updateState={updateState} />}
          {/* ── NUTRITION ── */}
          {tab===2 && <NutritionPanel s={s} addXp={addXp} updateState={updateState}
            calSlider={calSlider} setCalSlider={setCalSlider} calGoal={calGoal} setCalGoal={setCalGoal}
            protein={protein} setProtein={setProtein} carbs={carbs} setCarbs={setCarbs} fat={fat} setFat={setFat}
            sleepHours={sleepHours} setSleepHours={setSleepHours} sleepQ={sleepQ} setSleepQ={setSleepQ} />}
          {/* ── TRADING ── */}
          {tab===3 && <TradingPanel s={s} addXp={addXp} updateState={updateState}
            btCount={btCount} setBtCount={setBtCount} btHours={btHours} setBtHours={setBtHours} btStrategy={btStrategy} setBtStrategy={setBtStrategy}
            btWr={btWr} setBtWr={setBtWr} btNotes={btNotes} setBtNotes={setBtNotes}
            tradeResult={tradeResult} setTradeResult={setTradeResult} tradePnl={tradePnl} setTradePnl={setTradePnl}
            tradeInstrument={tradeInstrument} setTradeInstrument={setTradeInstrument}
            tradeEmotion={tradeEmotion} setTradeEmotion={setTradeEmotion}
            tradeDate={tradeDate} setTradeDate={setTradeDate} />}
          {/* ── STUDY ── */}
          {tab===4 && <StudyPanel s={s} addXp={addXp} updateState={updateState}
            studySubject={studySubject} setStudySubject={setStudySubject} studyMins={studyMins} setStudyMins={setStudyMins}
            studyFocus={studyFocus} setStudyFocus={setStudyFocus} rndNote={rndNote} setRndNote={setRndNote}
            rndChecked={rndChecked} setRndChecked={setRndChecked} />}
          {/* ── MIND ── */}
          {tab===5 && <MindPanel s={s} addXp={addXp} updateState={updateState}
            medMins={medMins} setMedMins={setMedMins} medType={medType} setMedType={setMedType}
            journalMood={journalMood} setJournalMood={setJournalMood} gratitude={gratitude} setGratitude={setGratitude}
            reflection={reflection} setReflection={setReflection}
            wellEnergy={wellEnergy} setWellEnergy={setWellEnergy}
            wellStress={wellStress} setWellStress={setWellStress}
            wellProd={wellProd} setWellProd={setWellProd} />}
          {/* ── GOALS ── */}
          {tab===6 && <GoalsPanel s={s} addXp={addXp} updateState={updateState}
            showForm={showGoalForm} setShowForm={setShowGoalForm}
            goalTitle={goalTitle} setGoalTitle={setGoalTitle}
            goalCat={goalCat} setGoalCat={setGoalCat}
            goalDate={goalDate} setGoalDate={setGoalDate}
            goalXp={goalXp} setGoalXp={setGoalXp} />}
          {/* ── LEADERBOARD ── */}
          {tab===7 && <LeaderboardPanel currentUser={currentUser} currentXp={s.xp} currentStreak={s.streak} />}
        </div>
      </div>
    </div>
  );
}

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
function Card({ children, style={}, full=false }) {
  return (
    <div style={{ background:'#111118', border:'1px solid #ffffff0f', borderRadius:'16px', padding:'22px', position:'relative', overflow:'hidden', gridColumn: full ? '1 / -1' : undefined, ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, primary, danger, ghost, small, style={}, disabled }) {
  const base = { padding: small ? '6px 14px' : '10px 20px', borderRadius:'10px', border:'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily:"'JetBrains Mono',monospace", fontSize: small ? '0.6rem' : '0.68rem', letterSpacing:'1.5px', display:'inline-flex', alignItems:'center', gap:'5px', transition:'all 0.2s', opacity: disabled ? 0.5 : 1 };
  let themed = primary ? { background:'linear-gradient(135deg,#7c5cfc,#fc5c7d)', color:'#fff', boxShadow:'0 4px 20px #7c5cfc44' }
    : danger ? { background:'#fc5c7d22', color:'#fc5c7d', border:'1px solid #fc5c7d44' }
    : { background:'#1a1a24', color:'#5a5a70', border:'1px solid #ffffff0f' };
  return <button style={{ ...base, ...themed, ...style }} onClick={disabled ? undefined : onClick}>{children}</button>;
}

function AccentLine({ color='linear-gradient(90deg,#7c5cfc,#fc5c7d)' }) {
  return <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:color }} />;
}

function CardHeader({ icon, title, badge }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontSize:'1.3rem' }}>{icon}</span>
        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.9rem', letterSpacing:'1px' }}>{title}</span>
      </div>
      {badge && <span style={{ fontSize:'0.58rem', padding:'3px 10px', borderRadius:'20px', background:'#7c5cfc22', color:'#7c5cfc', border:'1px solid #7c5cfc44', letterSpacing:'1px' }}>{badge}</span>}
    </div>
  );
}

function RangeLabel({ label, val }) {
  return <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px', textTransform:'uppercase' }}><span>{label}</span><span style={{ color:'#e8e8f0' }}>{val}</span></div>;
}

function MoodRow({ icons, selected, onSelect }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${icons.length},1fr)`, gap:'6px', marginTop:'6px' }}>
      {icons.map((icon, i) => (
        <button key={i} onClick={() => onSelect(i+1)} style={{ aspectRatio:'1', borderRadius:'10px', border:`2px solid ${selected === i+1 ? '#7c5cfc' : '#ffffff0f'}`, background: selected === i+1 ? '#7c5cfc22' : '#1a1a24', fontSize:'1.3rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transform: selected === i+1 ? 'scale(1.1)' : 'scale(1)', boxShadow: selected === i+1 ? '0 0 12px #7c5cfc44' : 'none', transition:'all 0.2s' }}>
          {icon}
        </button>
      ))}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, multiline }) {
  const style = { background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'8px', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.75rem', padding:'8px 12px', width:'100%', outline:'none' };
  if (multiline) return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ ...style, resize:'vertical', minHeight:'70px' }} />;
  return <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={style} />;
}

function NInput({ value, onChange, placeholder, type='number' }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'8px', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.75rem', padding:'8px 12px', width:'100%', outline:'none' }} />;
}

function Ring({ label, pct, color }) {
  const r=30, circ=2*Math.PI*r, offset=circ-(pct/100)*circ;
  return (
    <div style={{ textAlign:'center' }}>
      <svg width="80" height="80" style={{ transform:'rotate(-90deg)' }} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1a1a24" strokeWidth="6"/>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ filter:`drop-shadow(0 0 6px ${color}88)`, transition:'stroke-dashoffset 1s ease' }}/>
        <text x="40" y="40" fill={color} dominantBaseline="middle" textAnchor="middle" fontSize="12" fontFamily="'Bebas Neue'" style={{ transform:'rotate(90deg)', transformOrigin:'40px 40px' }}>{Math.round(pct)}%</text>
      </svg>
      <div style={{ fontSize:'0.55rem', color:'#5a5a70', letterSpacing:'2px', marginTop:'4px' }}>{label}</div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ s, addXp, updateState }) {
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const completedToday = Object.keys(s.dailyTasks).length;
  const weekPct = Math.round((s.weeklyData.filter(Boolean).length/7)*100);

  const rings = [
    { label:'NUTRITION', pct: s.nutrition.logged ? 100 : Math.min(100,(s.nutrition.calories/(s.nutrition.calorieGoal||2000))*100), color:'#ff6b6b' },
    { label:'HYDRATION', pct: Math.min(100,(s.water.count/8)*100), color:'#00b4ff' },
    { label:'STUDY',     pct: Math.min(100,(s.study.totalMinutes/60)*100), color:'#a8c8ff' },
    { label:'TRADING',   pct: s.trading.backtests > 0 ? 100 : 0, color:'#00e5a0' },
    { label:'MIND',      pct: s.meditation.logged ? 100 : 0, color:'#c8a8ff' },
    { label:'SLEEP',     pct: s.sleep.logged ? Math.min(100,(s.sleep.hours/8)*100) : 0, color:'#ffd700' },
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'16px' }}>
      {/* Daily Quests */}
      <Card>
        <AccentLine />
        <CardHeader icon="⚡" title="DAILY QUESTS" badge={`${completedToday} / ${DAILY_QUESTS.length} COMPLETE`} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0 20px' }}>
          {DAILY_QUESTS.map(q => (
            <div key={q.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid #ffffff0f' }}>
              <div style={{ width:'20px', height:'20px', borderRadius:'6px', border:`2px solid ${s.dailyTasks[q.id] ? '#00e5a0' : '#5a5a70'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: s.dailyTasks[q.id] ? 'linear-gradient(135deg,#00e5a0,#00b47a)' : 'transparent', boxShadow: s.dailyTasks[q.id] ? '0 0 12px #00e5a055' : 'none', fontSize:'0.7rem', color:'#000', fontWeight:'bold', transition:'all 0.3s' }}>
                {s.dailyTasks[q.id] ? '✓' : ''}
              </div>
              <span style={{ flex:1, fontSize:'0.68rem', color: s.dailyTasks[q.id] ? '#5a5a70' : '#e8e8f0', textDecoration: s.dailyTasks[q.id] ? 'line-through' : 'none' }}>{q.icon} {q.label}</span>
              <span style={{ fontSize:'0.58rem', color:'#fc5c7d', letterSpacing:'1px', whiteSpace:'nowrap' }}>+{q.xp} XP</span>
            </div>
          ))}
        </div>

        {/* Penalty warning */}
        <div style={{ marginTop:'16px', padding:'12px', background:'#fc5c7d11', border:'1px solid #fc5c7d22', borderRadius:'10px', fontSize:'0.62rem', color:'#fc5c7d', letterSpacing:'1px' }}>
          ⚠️ MISSING QUESTS COSTS XP TOMORROW · {DAILY_QUESTS.filter(q => !s.dailyTasks[q.id]).reduce((s,q) => s+q.penalty, 0)} XP AT RISK
        </div>
      </Card>

      {/* Weekly + Life Rings */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
        <Card>
          <AccentLine color="linear-gradient(90deg,#00e5a0,#00b4ff)" />
          <CardHeader icon="📅" title="WEEKLY" badge={`${weekPct}% THIS WEEK`} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
            {days.map((d,i) => (
              <div key={d} style={{ textAlign:'center' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: s.weeklyData[i] ? '#00e5a022' : '#1a1a24', border:`1px solid ${s.weeklyData[i] ? '#00e5a055' : '#ffffff0f'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', color: s.weeklyData[i] ? '#00e5a0' : '#5a5a70', margin:'0 auto 4px', boxShadow: s.weeklyData[i] ? '0 0 8px #00e5a033' : 'none' }}>
                  {s.weeklyData[i] ? '✓' : ''}
                </div>
                <div style={{ fontSize:'0.5rem', color:'#5a5a70', letterSpacing:'1px' }}>{d}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <AccentLine color="linear-gradient(90deg,#ffd700,#ff7b00)" />
          <CardHeader icon="🔄" title="LIFE RINGS" />
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', justifyContent:'center' }}>
            {rings.map(r => <Ring key={r.label} {...r} />)}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── NUTRITION ────────────────────────────────────────────────────────────────
function NutritionPanel({ s, addXp, updateState, calSlider, setCalSlider, calGoal, setCalGoal, protein, setProtein, carbs, setCarbs, fat, setFat, sleepHours, setSleepHours, sleepQ, setSleepQ }) {
  function logNutrition() {
    if (s.nutrition.logged) return;
    updateState(prev => ({ ...prev, nutrition: { ...prev.nutrition, calories: calSlider, calorieGoal: calGoal, protein: parseInt(protein)||0, carbs: parseInt(carbs)||0, fat: parseInt(fat)||0, logged: true } }));
    addXp(30, 'nutrition');
  }

  function addWater() {
    if (s.water.count >= 8) return;
    const newCount = s.water.count + 1;
    updateState(prev => ({ ...prev, water: { count: newCount } }), newCount >= 8 ? 'water8' : null);
    addXp(10);
  }

  function resetWater() {
    // Only allow reset if already at 8 (otherwise it just removes earned xp)
    updateState(prev => ({...prev, water:{count:0}, dailyTasks: {...prev.dailyTasks, water8: undefined}}));
  }

  function logSleep() {
    if (s.sleep.logged) return;
    updateState(prev => ({ ...prev, sleep: { hours: sleepHours, quality: sleepQ, logged: true } }));
    addXp(sleepHours >= 7 ? 40 : 20, 'sleep');
  }

  const calPct = Math.min(100, (calSlider / calGoal) * 100);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
      {/* Calories */}
      <Card>
        <AccentLine color="linear-gradient(90deg,#ff6b6b,#ffd700)" />
        <CardHeader icon="🔥" title="CALORIES" badge="+30 XP" />
        <RangeLabel label="Calories Consumed" val={calSlider} />
        <input type="range" min="0" max="4000" value={calSlider} onChange={e => setCalSlider(+e.target.value)} />
        <RangeLabel label="Calorie Goal" val={calGoal} />
        <input type="range" min="1200" max="4000" value={calGoal} onChange={e => setCalGoal(+e.target.value)} />
        <div style={{ height:'8px', background:'#1a1a24', borderRadius:'4px', overflow:'hidden', margin:'8px 0 14px' }}>
          <div style={{ height:'100%', background:`linear-gradient(90deg,#ff6b6b,${calPct>100?'#fc5c7d':'#ffd700'})`, width:`${calPct}%`, borderRadius:'4px', transition:'width 0.5s' }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', marginBottom:'12px' }}>
          {[['PROTEIN','#00b4ff',protein,setProtein],['CARBS','#ff7b00',carbs,setCarbs],['FATS','#fc5c7d',fat,setFat]].map(([lbl,col,val,set]) => (
            <div key={lbl} style={{ background:'#1a1a24', borderRadius:'10px', padding:'10px', textAlign:'center', border:'1px solid #ffffff0f' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.3rem', color:col }}>{val||0}g</div>
              <div style={{ fontSize:'0.55rem', color:'#5a5a70', letterSpacing:'2px' }}>{lbl}</div>
              <input type="number" value={val} onChange={e=>set(e.target.value)} placeholder="0" style={{ background:'transparent', border:'none', color:col, fontFamily:"'JetBrains Mono'", fontSize:'0.65rem', width:'100%', textAlign:'center', outline:'none', marginTop:'4px' }} />
            </div>
          ))}
        </div>
        <Btn primary onClick={logNutrition} disabled={s.nutrition.logged} style={{ width:'100%', justifyContent:'center' }}>
          {s.nutrition.logged ? '✓ LOGGED' : '⚡ LOG NUTRITION (+30 XP)'}
        </Btn>
      </Card>

      {/* Water */}
      <Card>
        <AccentLine color="linear-gradient(90deg,#00b4ff,#00e5a0)" />
        <CardHeader icon="💧" title="HYDRATION" badge="+10 XP / glass" />
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', justifyContent:'center', padding:'12px 0' }}>
          {Array.from({length:8},(_,i) => (
            <button key={i} onClick={addWater} style={{ width:'44px', height:'54px', background: i < s.water.count ? '#00b4ff22' : '#1a1a24', border:`2px solid ${i < s.water.count ? '#00b4ff' : '#ffffff0f'}`, borderRadius:'8px', fontSize:'1.3rem', cursor:'pointer', boxShadow: i < s.water.count ? '0 0 10px #00b4ff44' : 'none', transition:'all 0.3s' }}>
              {i < s.water.count ? '💧' : '○'}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px' }}>
          <span style={{ fontSize:'0.65rem', color:'#5a5a70' }}>DAILY TARGET: 8 GLASSES</span>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:'#00b4ff' }}>{s.water.count} / 8</span>
        </div>
        <Btn ghost onClick={resetWater} style={{ width:'100%', justifyContent:'center', marginTop:'12px' }}>↺ RESET</Btn>
      </Card>

      {/* Sleep */}
      <Card style={{ gridColumn:'1/-1' }}>
        <AccentLine color="linear-gradient(90deg,#a8e6cf,#ffd700)" />
        <CardHeader icon="😴" title="SLEEP" badge="+40 XP" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
          <div>
            <RangeLabel label="Hours Slept" val={`${sleepHours}h`} />
            <input type="range" min="0" max="12" step="0.5" value={sleepHours} onChange={e => setSleepHours(+e.target.value)} />
            <div style={{ marginTop:'12px', fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>SLEEP QUALITY</div>
            <MoodRow icons={['😫','😞','😐','😊','🌟']} selected={sleepQ} onSelect={setSleepQ} />
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'4rem', color: sleepHours >= 7 ? '#00e5a0' : '#fc5c7d', textShadow:`0 0 30px ${sleepHours >= 7 ? '#00e5a0' : '#fc5c7d'}` }}>{sleepHours}h</div>
              <div style={{ fontSize:'0.65rem', color:'#5a5a70', letterSpacing:'2px' }}>{sleepHours >= 7 ? '✓ OPTIMAL' : '⚠ INSUFFICIENT'}</div>
              <div style={{ fontSize:'0.6rem', color:'#7c5cfc', marginTop:'8px' }}>{sleepHours >= 7 ? '+40 XP' : '+20 XP'}</div>
              <Btn primary onClick={logSleep} disabled={s.sleep.logged} style={{ marginTop:'12px' }}>
                {s.sleep.logged ? '✓ LOGGED' : '⚡ LOG SLEEP'}
              </Btn>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── TRADING ─────────────────────────────────────────────────────────────────
function TradingPanel({ s, addXp, updateState, btCount, setBtCount, btHours, setBtHours, btStrategy, setBtStrategy, btWr, setBtWr, btNotes, setBtNotes, tradeResult, setTradeResult, tradePnl, setTradePnl, tradeInstrument, setTradeInstrument, tradeEmotion, setTradeEmotion, tradeDate, setTradeDate }) {
  function logBacktest() {
    if (btCount === 0) return;
    updateState(prev => ({ ...prev, trading: { ...prev.trading, backtests: prev.trading.backtests + btCount, backtestHours: (prev.trading.backtestHours||0) + (btHours * btCount) } }), 'backtest');
    addXp(btCount * 50);
    setBtCount(0); setBtStrategy(''); setBtNotes(''); setBtHours(1);
  }

  function logTrade() {
    const entry = { result: tradeResult || 'break', pnl: parseFloat(tradePnl)||0, instrument: tradeInstrument||'—', emotion: tradeEmotion, time: new Date().toLocaleTimeString(), date: tradeDate || todayStr() };
    updateState(prev => ({ ...prev, trading: { ...prev.trading, trades: [entry, ...prev.trading.trades].slice(0,200) } }), 'trade');
    addXp(20);
    setTradePnl(''); setTradeInstrument(''); setTradeResult(''); setTradeEmotion(''); setTradeDate(todayStr());
  }

  const totalPnl = s.trading.trades.reduce((sum,t) => sum + t.pnl, 0);
  const wins = s.trading.trades.filter(t => t.result === 'win').length;
  const wr = s.trading.trades.length ? Math.round((wins/s.trading.trades.length)*100) : 0;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
      {/* Backtest */}
      <Card>
        <AccentLine color="linear-gradient(90deg,#00e5a0,#7c5cfc)" />
        <CardHeader icon="🔬" title="BACKTESTING" badge="+50 XP/session" />
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px', justifyContent:'center' }}>
          <Btn ghost onClick={() => setBtCount(Math.max(0,btCount-1))} style={{ padding:'8px 18px', fontSize:'1rem' }}>−</Btn>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'3rem', color:'#00e5a0', textShadow:'0 0 20px #00e5a066', minWidth:'60px', textAlign:'center' }}>{btCount}</div>
          <Btn primary onClick={() => setBtCount(btCount+1)} style={{ padding:'8px 18px', fontSize:'1rem' }}>+</Btn>
        </div>
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>HOURS PER SESSION</div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
          <Btn ghost onClick={() => setBtHours(Math.max(0.5,btHours-0.5))} style={{ padding:'6px 14px' }}>−</Btn>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.6rem', color:'#7c5cfc', minWidth:'60px', textAlign:'center' }}>{btHours}h</div>
          <Btn primary onClick={() => setBtHours(btHours+0.5)} style={{ padding:'6px 14px' }}>+</Btn>
        </div>
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>STRATEGY</div>
        <TextInput value={btStrategy} onChange={setBtStrategy} placeholder="e.g. sweep model" />
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px', marginTop:'10px' }}>WIN RATE: {btWr}%</div>
        <input type="range" min="0" max="100" value={btWr} onChange={e=>setBtWr(+e.target.value)} />
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px', marginTop:'10px' }}>NOTES</div>
        <TextInput value={btNotes} onChange={setBtNotes} placeholder="Key observations..." multiline />
        <Btn primary onClick={logBacktest} disabled={btCount===0} style={{ width:'100%', justifyContent:'center', marginTop:'12px' }}>⚡ LOG BACKTESTING (+{btCount*50} XP)</Btn>
      </Card>

      {/* Trade Journal */}
      <Card>
        <AccentLine color="linear-gradient(90deg,#ffd700,#ff9500)" />
        <CardHeader icon="📊" title="TRADE JOURNAL" badge="+20 XP" />
        <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
          {[['win','✅ WIN','#00e5a0'],['loss','❌ LOSS','#fc5c7d'],['break','→ B/E','#5a5a70']].map(([r,lbl,col]) => (
            <button key={r} onClick={() => setTradeResult(r)} style={{ flex:1, padding:'8px', borderRadius:'8px', border:`1px solid ${tradeResult===r ? col : '#ffffff0f'}`, background: tradeResult===r ? col+'22' : '#1a1a24', color: tradeResult===r ? col : '#5a5a70', cursor:'pointer', fontSize:'0.65rem', fontFamily:"'JetBrains Mono'", letterSpacing:'1px', boxShadow: tradeResult===r ? `0 0 12px ${col}44` : 'none', transition:'all 0.2s' }}>{lbl}</button>
          ))}
        </div>
        <div style={{ marginBottom:'10px' }}>
          <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>DATE</div>
          <NInput value={tradeDate} onChange={setTradeDate} placeholder="" type="date" />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px' }}>
          <div>
            <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>P&L ($)</div>
            <NInput value={tradePnl} onChange={setTradePnl} placeholder="e.g. 240" />
          </div>
          <div>
            <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>ASSET</div>
            <NInput value={tradeInstrument} onChange={setTradeInstrument} placeholder="e.g. NQ, BTC" type="text" />
          </div>
        </div>
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>EMOTIONAL STATE</div>
        <MoodRow icons={['😰','😤','😐','😊','🧠']} selected={['😰','😤','😐','😊','🧠'].indexOf(tradeEmotion)+1} onSelect={i => setTradeEmotion(['😰','😤','😐','😊','🧠'][i-1])} />
        <Btn primary onClick={logTrade} style={{ width:'100%', justifyContent:'center', marginTop:'14px' }}>⚡ LOG TRADE (+20 XP)</Btn>
      </Card>

      {/* Stats Summary */}
      <Card style={{ gridColumn:'1/-1' }}>
        <AccentLine color="linear-gradient(90deg,#7c5cfc,#00b4ff)" />
        <CardHeader icon="📋" title="TRADING STATS & LOG" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'20px' }}>
          {[['BT SESSIONS', s.trading.backtests, '#00e5a0'], ['BT HOURS', `${(s.trading.backtestHours||0).toFixed(1)}h`, '#7c5cfc'], ['TOTAL TRADES', s.trading.trades.length, '#00b4ff'], ['WIN RATE', `${wr}%`, wr >= 50 ? '#00e5a0' : '#fc5c7d'], ['TOTAL P&L', `$${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}`, totalPnl >= 0 ? '#00e5a0' : '#fc5c7d']].map(([lbl,val,col]) => (
            <div key={lbl} style={{ background:'#1a1a24', borderRadius:'10px', padding:'14px', textAlign:'center', border:'1px solid #ffffff0f' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.6rem', color:col }}>{val}</div>
              <div style={{ fontSize:'0.55rem', color:'#5a5a70', letterSpacing:'2px' }}>{lbl}</div>
            </div>
          ))}
        </div>
        {s.trading.trades.length === 0
          ? <div style={{ color:'#5a5a70', fontSize:'0.65rem', letterSpacing:'2px', padding:'20px 0', textAlign:'center' }}>// NO TRADES LOGGED YET</div>
          : s.trading.trades.slice(0,10).map((t,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid #ffffff0f', fontSize:'0.68rem' }}>
                <span style={{ padding:'2px 8px', borderRadius:'4px', fontSize:'0.6rem', fontWeight:600, background: t.result==='win' ? '#00e5a022' : t.result==='loss' ? '#fc5c7d22' : '#5a5a7022', color: t.result==='win' ? '#00e5a0' : t.result==='loss' ? '#fc5c7d' : '#5a5a70', border:`1px solid ${t.result==='win' ? '#00e5a044' : t.result==='loss' ? '#fc5c7d44' : '#5a5a7044'}` }}>{t.result.toUpperCase()}</span>
                <span style={{ color:'#5a5a70', fontSize:'0.6rem' }}>{t.date || t.time}</span>
                <span style={{ flex:1 }}>{t.instrument}</span>
                <span style={{ color: t.pnl >= 0 ? '#00e5a0' : '#fc5c7d' }}>{t.pnl >= 0 ? '+' : ''}${t.pnl}</span>
                <span style={{ fontSize:'0.7rem' }}>{t.emotion || '—'}</span>
              </div>
            ))
        }
      </Card>

      {/* Trading Calendar */}
      <TradeCalendar trades={s.trading.trades} />
    </div>
  );
}

function TradeCalendar({ trades }) {
  const [calDate, setCalDate] = useState(new Date());

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const monthName = calDate.toLocaleString('default', { month: 'long' });

  // Build a map of date -> {pnl, wins, losses, be}
  const dayMap = {};
  trades.forEach(t => {
    // trades store time not full date - we use a workaround:
    // If trade has a `date` field use it, otherwise try to infer from today
    const dateKey = t.date || todayStr();
    if (!dayMap[dateKey]) dayMap[dateKey] = { pnl: 0, wins: 0, losses: 0, be: 0 };
    dayMap[dateKey].pnl += t.pnl || 0;
    if (t.result === 'win') dayMap[dateKey].wins++;
    else if (t.result === 'loss') dayMap[dateKey].losses++;
    else dayMap[dateKey].be++;
  });

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // startDow: Mon=0
  let startDow = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  // Build weeks
  const weeks = [];
  let currentWeek = Array(startDow).fill(null);
  for (let d = 1; d <= totalDays; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  while (currentWeek.length > 0 && currentWeek.length < 7) currentWeek.push(null);
  if (currentWeek.length) weeks.push(currentWeek);

  function weekPnl(week) {
    return week.reduce((sum, d) => {
      if (!d) return sum;
      const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      return sum + (dayMap[key]?.pnl || 0);
    }, 0);
  }

  const monthlyPnl = Object.entries(dayMap).filter(([k]) => k.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).reduce((sum,[,v]) => sum + v.pnl, 0);

  const DOW = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

  return (
    <Card style={{ gridColumn:'1/-1' }}>
      <AccentLine color="linear-gradient(90deg,#ffd700,#00e5a0)" />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'1.3rem' }}>📅</span>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.9rem', letterSpacing:'1px' }}>TRADING CALENDAR</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Btn ghost small onClick={() => setCalDate(new Date(year, month-1, 1))}>‹ PREV</Btn>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.1rem', letterSpacing:'3px', color:'#ffd700', minWidth:'140px', textAlign:'center' }}>{monthName.toUpperCase()} {year}</span>
          <Btn ghost small onClick={() => setCalDate(new Date(year, month+1, 1))}>NEXT ›</Btn>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px' }}>MONTHLY P&L</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color: monthlyPnl >= 0 ? '#00e5a0' : '#fc5c7d' }}>{monthlyPnl >= 0 ? '+' : ''}${monthlyPnl.toFixed(0)}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr) 80px', gap:'3px', marginBottom:'4px' }}>
        {DOW.map(d => <div key={d} style={{ fontSize:'0.55rem', color:'#5a5a70', letterSpacing:'2px', textAlign:'center', padding:'4px 0' }}>{d}</div>)}
        <div style={{ fontSize:'0.55rem', color:'#5a5a70', letterSpacing:'2px', textAlign:'center', padding:'4px 0' }}>WK P&L</div>
      </div>

      {weeks.map((week, wi) => {
        const wPnl = weekPnl(week);
        return (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr) 80px', gap:'3px', marginBottom:'3px' }}>
            {week.map((d, di) => {
              if (!d) return <div key={di} style={{ height:'52px', background:'#0d0d14', borderRadius:'6px', border:'1px solid #ffffff05' }} />;
              const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const data = dayMap[key];
              const isToday = key === todayStr();
              return (
                <div key={di} style={{ height:'52px', background: data ? (data.pnl > 0 ? '#00e5a011' : data.pnl < 0 ? '#fc5c7d11' : '#5a5a7011') : '#111118', border:`1px solid ${isToday ? '#7c5cfc' : data ? (data.pnl > 0 ? '#00e5a033' : data.pnl < 0 ? '#fc5c7d33' : '#5a5a7033') : '#ffffff0f'}`, borderRadius:'6px', padding:'5px 6px', position:'relative' }}>
                  <div style={{ fontSize:'0.6rem', color: isToday ? '#7c5cfc' : '#5a5a70', fontWeight: isToday ? 700 : 400 }}>{d}</div>
                  {data && (
                    <>
                      <div style={{ fontSize:'0.6rem', fontFamily:"'Bebas Neue',sans-serif", color: data.pnl >= 0 ? '#00e5a0' : '#fc5c7d', marginTop:'2px' }}>{data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(0)}</div>
                      <div style={{ fontSize:'0.5rem', color:'#5a5a70', marginTop:'1px' }}>
                        {data.wins > 0 && <span style={{ color:'#00e5a0' }}>{data.wins}W </span>}
                        {data.losses > 0 && <span style={{ color:'#fc5c7d' }}>{data.losses}L </span>}
                        {data.be > 0 && <span style={{ color:'#5a5a70' }}>{data.be}BE</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            <div style={{ height:'52px', background:'#1a1a24', borderRadius:'6px', border:'1px solid #ffffff0f', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
              <div style={{ fontSize:'0.55rem', color:'#5a5a70', letterSpacing:'1px' }}>WK</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'0.9rem', color: wPnl > 0 ? '#00e5a0' : wPnl < 0 ? '#fc5c7d' : '#5a5a70' }}>{wPnl !== 0 ? (wPnl > 0 ? '+' : '') + '$' + Math.abs(wPnl).toFixed(0) : '—'}</div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
function StudyPanel({ s, addXp, updateState, studySubject, setStudySubject, studyMins, setStudyMins, studyFocus, setStudyFocus, rndNote, setRndNote, rndChecked, setRndChecked }) {
  const [rndTaskInput, setRndTaskInput] = useState('');
  const [rndTasks, setRndTasks] = useState([]);

  function addRndTask() {
    if (!rndTaskInput.trim()) return;
    const updated = [...rndTasks, rndTaskInput.trim()];
    setRndTasks(updated);
    setRndTaskInput('');
  }

  function removeRndTask(i) {
    const updated = rndTasks.filter((_,idx) => idx !== i);
    setRndTasks(updated);
    setRndChecked(prev => { const s = new Set(prev); s.delete(i); return s; });
  }
  function logStudy() {
    updateState(prev => ({ ...prev, study: { totalMinutes: prev.study.totalMinutes + studyMins } }), studyMins >= 30 ? 'study30' : null);
    addXp(studyMins * 2);
    setStudySubject('');
  }

  function logRnD() {
    updateState(prev => ({
      ...prev,
      rnd: { sessions: prev.rnd.sessions+1, notes: rndNote.trim() ? [{ note: rndNote, date: new Date().toLocaleDateString() }, ...prev.rnd.notes].slice(0,50) : prev.rnd.notes }
    }), 'rnd');
    addXp(60);
    setRndNote(''); setRndChecked(new Set());
  }

  function toggleRnd(i) {
    setRndChecked(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
      <Card>
        <AccentLine color="linear-gradient(90deg,#00b4ff,#7c5cfc)" />
        <CardHeader icon="📚" title="STUDY SESSION" badge="+2 XP/min" />
        <div style={{ marginBottom:'10px' }}>
          <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>SUBJECT</div>
          <TextInput value={studySubject} onChange={setStudySubject} placeholder="e.g. Options Theory, Calculus..." />
        </div>
        <RangeLabel label="Duration" val={`${studyMins} min → +${studyMins*2} XP`} />
        <input type="range" min="5" max="240" step="5" value={studyMins} onChange={e=>setStudyMins(+e.target.value)} />
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', margin:'12px 0 6px' }}>FOCUS QUALITY</div>
        <MoodRow icons={['😵','😕','😐','💪','🔥']} selected={studyFocus} onSelect={setStudyFocus} />
        <div style={{ background:'#1a1a24', borderRadius:'10px', padding:'12px', marginTop:'14px', fontSize:'0.65rem', color:'#5a5a70', letterSpacing:'1px' }}>
          📚 Total Studied Today: <span style={{ color:'#00b4ff' }}>{s.study.totalMinutes} min</span>
        </div>
        <Btn primary onClick={logStudy} style={{ width:'100%', justifyContent:'center', marginTop:'12px' }}>⚡ LOG STUDY (+{studyMins*2} XP)</Btn>
      </Card>

      <Card>
        <AccentLine color="linear-gradient(90deg,#ff9500,#ffd700)" />
        <CardHeader icon="🔬" title="R&D SESSION" badge="+60 XP" />
        {/* Add custom task */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
          <input value={rndTaskInput} onChange={e => setRndTaskInput(e.target.value)} onKeyDown={e => e.key==='Enter' && addRndTask()} placeholder="Add research task..." style={{ flex:1, background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'8px', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.72rem', padding:'8px 12px', outline:'none' }} />
          <Btn primary small onClick={addRndTask}>+ ADD</Btn>
        </div>
        {rndTasks.length === 0 && <div style={{ color:'#5a5a70', fontSize:'0.62rem', letterSpacing:'2px', padding:'8px 0 12px', textAlign:'center' }}>// ADD TASKS ABOVE TO BEGIN YOUR R&D SESSION</div>}
        {rndTasks.map((t,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid #ffffff0f' }}>
            <div onClick={() => toggleRnd(i)} style={{ width:'18px', height:'18px', borderRadius:'5px', border:`2px solid ${rndChecked.has(i) ? '#ff9500' : '#5a5a70'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', color:'#000', fontWeight:'bold', background: rndChecked.has(i) ? 'linear-gradient(135deg,#ff9500,#ffd700)' : 'transparent', boxShadow: rndChecked.has(i) ? '0 0 8px #ff950055' : 'none', transition:'all 0.2s', flexShrink:0, cursor:'pointer' }}>
              {rndChecked.has(i) ? '✓' : ''}
            </div>
            <span onClick={() => toggleRnd(i)} style={{ flex:1, fontSize:'0.66rem', color: rndChecked.has(i) ? '#5a5a70' : '#e8e8f0', textDecoration: rndChecked.has(i) ? 'line-through' : 'none', cursor:'pointer' }}>{t}</span>
            <button onClick={() => removeRndTask(i)} style={{ background:'none', border:'none', color:'#5a5a70', cursor:'pointer', fontSize:'0.8rem', padding:'0 4px' }}>✕</button>
          </div>
        ))}
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', margin:'12px 0 6px' }}>KEY INSIGHT / NOTES</div>
        <TextInput value={rndNote} onChange={setRndNote} placeholder="What did you research or develop today?" multiline />
        <Btn primary onClick={logRnD} style={{ width:'100%', justifyContent:'center', marginTop:'12px' }}>⚡ LOG R&D (+60 XP)</Btn>
      </Card>

      <Card style={{ gridColumn:'1/-1' }}>
        <AccentLine color="linear-gradient(90deg,#00e5a0,#00b4ff)" />
        <CardHeader icon="🧠" title="KNOWLEDGE BASE" />
        {s.rnd.notes.length === 0
          ? <div style={{ color:'#5a5a70', fontSize:'0.65rem', letterSpacing:'2px', padding:'20px 0', textAlign:'center' }}>// INSIGHTS APPEAR HERE AS YOU LOG R&D SESSIONS</div>
          : s.rnd.notes.map((n,i) => (
              <div key={i} style={{ padding:'12px', borderBottom:'1px solid #ffffff0f' }}>
                <div style={{ color:'#5a5a70', fontSize:'0.58rem', letterSpacing:'2px', marginBottom:'4px' }}>{n.date}</div>
                <div style={{ fontSize:'0.72rem' }}>💡 {n.note}</div>
              </div>
            ))
        }
      </Card>
    </div>
  );
}

// ─── MIND ─────────────────────────────────────────────────────────────────────
function MindPanel({ s, addXp, updateState, medMins, setMedMins, medType, setMedType, journalMood, setJournalMood, gratitude, setGratitude, reflection, setReflection, wellEnergy, setWellEnergy, wellStress, setWellStress, wellProd, setWellProd }) {
  function logMed() {
    updateState(prev => ({ ...prev, meditation: { totalMinutes: prev.meditation.totalMinutes + medMins, logged: true } }), 'meditation');
    addXp(medMins * 5);
  }

  function logJournal() {
    if (s.journal.logged) return;
    updateState(prev => ({ ...prev, journal: { mood: journalMood, logged: true }, wellbeing: { energy: wellEnergy, stress: wellStress, prod: wellProd } }), 'journal');
    addXp(25);
  }

  const MED_TYPES = ['Breathwork','Mindfulness','Body Scan','Visualization','Cold Plunge','Journaling'];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
      <Card>
        <AccentLine color="linear-gradient(90deg,#a8c8ff,#c8a8ff)" />
        <CardHeader icon="🧘" title="MEDITATION" badge="+5 XP/min" />
        <RangeLabel label="Duration" val={`${medMins} min → +${medMins*5} XP`} />
        <input type="range" min="1" max="60" value={medMins} onChange={e=>setMedMins(+e.target.value)} />
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', margin:'12px 0 6px' }}>SESSION TYPE</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {MED_TYPES.map(t => (
            <button key={t} onClick={() => setMedType(t)} style={{ padding:'6px 12px', borderRadius:'8px', border:`1px solid ${medType===t ? '#7c5cfc' : '#ffffff0f'}`, background: medType===t ? '#7c5cfc22' : '#1a1a24', color: medType===t ? '#e8e8f0' : '#5a5a70', fontSize:'0.6rem', fontFamily:"'JetBrains Mono'", cursor:'pointer', transition:'all 0.2s' }}>{t}</button>
          ))}
        </div>
        {s.meditation.logged && <div style={{ fontSize:'0.65rem', color:'#00e5a0', marginTop:'10px', letterSpacing:'1px' }}>✓ {s.meditation.totalMinutes} min logged today</div>}
        <Btn primary onClick={logMed} style={{ width:'100%', justifyContent:'center', marginTop:'14px' }}>⚡ LOG MEDITATION (+{medMins*5} XP)</Btn>
      </Card>

      <Card>
        <AccentLine color="linear-gradient(90deg,#ffb6c1,#ffd700)" />
        <CardHeader icon="📔" title="DAILY JOURNAL" badge={s.journal.logged ? 'LOGGED ✓' : '+25 XP'} />
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>TODAY'S MOOD</div>
        <MoodRow icons={['😭','😞','😐','😊','🔥']} selected={journalMood} onSelect={setJournalMood} />
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', margin:'12px 0 6px' }}>GRATITUDE (3 things)</div>
        <TextInput value={gratitude} onChange={setGratitude} placeholder={"1.\n2.\n3."} multiline />
        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', margin:'10px 0 6px' }}>REFLECTION</div>
        <TextInput value={reflection} onChange={setReflection} placeholder="What went well? What to improve?" multiline />
        <Btn primary onClick={logJournal} disabled={s.journal.logged} style={{ width:'100%', justifyContent:'center', marginTop:'12px' }}>
          {s.journal.logged ? '✓ LOGGED' : '⚡ LOG JOURNAL (+25 XP)'}
        </Btn>
      </Card>

      <Card style={{ gridColumn:'1/-1' }}>
        <AccentLine color="linear-gradient(90deg,#fc5c7d,#7c5cfc)" />
        <CardHeader icon="📈" title="MENTAL WELLBEING" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'20px' }}>
          {[
            ['ENERGY LEVEL', ['🔋','⚡','💥','🚀','☀️'], wellEnergy, setWellEnergy],
            ['STRESS LEVEL', ['😌','🙂','😬','😰','🤯'], wellStress, setWellStress],
            ['PRODUCTIVITY', ['🐢','🚶','🏃','🚀','⚡'], wellProd, setWellProd],
          ].map(([lbl, icons, val, set]) => (
            <div key={lbl}>
              <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'8px' }}>{lbl}</div>
              <MoodRow icons={icons} selected={val} onSelect={set} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── PHYSICAL ────────────────────────────────────────────────────────────────
const WORKOUT_TYPES = ['Push','Pull','Legs','Upper','Lower','Full Body','Cardio','HIIT','Sport','Mobility'];
const MUSCLE_GROUPS = ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Core','Calves'];

function PhysicalPanel({ s, addXp, updateState }) {
  const [workoutType, setWorkoutType] = useState('');
  const [workoutDuration, setWorkoutDuration] = useState(45);
  const [workoutIntensity, setWorkoutIntensity] = useState(0);
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [musclesHit, setMusclesHit] = useState(new Set());
  const [exercises, setExercises] = useState([{ name:'', sets:'', reps:'', weight:'' }]);

  function toggleMuscle(m) {
    setMusclesHit(prev => { const s = new Set(prev); s.has(m) ? s.delete(m) : s.add(m); return s; });
  }

  function addExercise() {
    setExercises(prev => [...prev, { name:'', sets:'', reps:'', weight:'' }]);
  }

  function updateExercise(i, field, val) {
    setExercises(prev => prev.map((ex, idx) => idx === i ? { ...ex, [field]: val } : ex));
  }

  function removeExercise(i) {
    setExercises(prev => prev.filter((_,idx) => idx !== i));
  }

  function logWorkout() {
    if (!workoutType) return;
    const volume = exercises.reduce((sum, ex) => {
      const sets = parseInt(ex.sets)||0;
      const reps = parseInt(ex.reps)||0;
      const weight = parseFloat(ex.weight)||0;
      return sum + (sets * reps * weight);
    }, 0);

    const entry = {
      id: Date.now(),
      type: workoutType,
      duration: workoutDuration,
      intensity: workoutIntensity,
      muscles: [...musclesHit],
      exercises: exercises.filter(ex => ex.name.trim()),
      volume: Math.round(volume),
      notes: workoutNotes,
      date: todayStr(),
    };

    const xpEarned = workoutDuration * 2 + (workoutIntensity * 10);
    updateState(prev => ({
      ...prev,
      physical: {
        workouts: [entry, ...(prev.physical?.workouts || [])].slice(0, 100),
        totalVolume: (prev.physical?.totalVolume || 0) + volume,
      }
    }), 'workout');
    addXp(xpEarned);

    setWorkoutType(''); setWorkoutNotes(''); setMusclesHit(new Set());
    setExercises([{ name:'', sets:'', reps:'', weight:'' }]);
    setWorkoutIntensity(0);
  }

  const workouts = s.physical?.workouts || [];
  const totalWorkouts = workouts.length;
  const thisWeek = workouts.filter(w => {
    const d = new Date(w.date); const now = new Date();
    const diff = (now - d) / (1000*60*60*24);
    return diff <= 7;
  }).length;

  const INTENSITY_ICONS = ['😴','😐','💪','🔥','💀'];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
      {/* Log Workout */}
      <Card>
        <AccentLine color="linear-gradient(90deg,#fc5c7d,#ff9500)" />
        <CardHeader icon="💪" title="LOG WORKOUT" badge="+2 XP/min" />

        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>WORKOUT TYPE</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'14px' }}>
          {WORKOUT_TYPES.map(t => (
            <button key={t} onClick={() => setWorkoutType(t)} style={{ padding:'5px 11px', borderRadius:'8px', border:`1px solid ${workoutType===t ? '#fc5c7d' : '#ffffff0f'}`, background: workoutType===t ? '#fc5c7d22' : '#1a1a24', color: workoutType===t ? '#fc5c7d' : '#5a5a70', fontSize:'0.6rem', fontFamily:"'JetBrains Mono'", cursor:'pointer', transition:'all 0.2s' }}>{t}</button>
          ))}
        </div>

        <RangeLabel label="Duration" val={`${workoutDuration} min → +${workoutDuration*2} XP`} />
        <input type="range" min="10" max="180" step="5" value={workoutDuration} onChange={e=>setWorkoutDuration(+e.target.value)} style={{ marginBottom:'14px' }} />

        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>INTENSITY</div>
        <MoodRow icons={INTENSITY_ICONS} selected={workoutIntensity} onSelect={setWorkoutIntensity} />

        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', margin:'14px 0 6px' }}>MUSCLES WORKED</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'14px' }}>
          {MUSCLE_GROUPS.map(m => (
            <button key={m} onClick={() => toggleMuscle(m)} style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${musclesHit.has(m) ? '#ff9500' : '#ffffff0f'}`, background: musclesHit.has(m) ? '#ff950022' : '#1a1a24', color: musclesHit.has(m) ? '#ff9500' : '#5a5a70', fontSize:'0.58rem', fontFamily:"'JetBrains Mono'", cursor:'pointer', transition:'all 0.2s' }}>{m}</button>
          ))}
        </div>

        <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'6px' }}>NOTES</div>
        <TextInput value={workoutNotes} onChange={setWorkoutNotes} placeholder="How did it feel? PRs? Notes..." multiline />

        <Btn primary onClick={logWorkout} disabled={!workoutType} style={{ width:'100%', justifyContent:'center', marginTop:'14px' }}>
          ⚡ LOG WORKOUT (+{workoutDuration*2 + (workoutIntensity*10)} XP)
        </Btn>
      </Card>

      {/* Exercise Tracker */}
      <Card>
        <AccentLine color="linear-gradient(90deg,#ff9500,#ffd700)" />
        <CardHeader icon="🏋️" title="EXERCISE LOG" />

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1.2fr auto', gap:'5px', marginBottom:'6px' }}>
          {['EXERCISE','SETS','REPS','KG/LBS',''].map(h => (
            <div key={h} style={{ fontSize:'0.52rem', color:'#5a5a70', letterSpacing:'2px' }}>{h}</div>
          ))}
        </div>

        {exercises.map((ex, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1.2fr auto', gap:'5px', marginBottom:'6px', alignItems:'center' }}>
            <input value={ex.name} onChange={e=>updateExercise(i,'name',e.target.value)} placeholder="Bench Press" style={{ background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'6px', color:'#e8e8f0', fontFamily:"'JetBrains Mono'", fontSize:'0.65rem', padding:'6px 8px', outline:'none', width:'100%' }} />
            <input value={ex.sets} onChange={e=>updateExercise(i,'sets',e.target.value)} placeholder="4" type="number" style={{ background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'6px', color:'#e8e8f0', fontFamily:"'JetBrains Mono'", fontSize:'0.65rem', padding:'6px 8px', outline:'none', width:'100%' }} />
            <input value={ex.reps} onChange={e=>updateExercise(i,'reps',e.target.value)} placeholder="10" type="number" style={{ background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'6px', color:'#e8e8f0', fontFamily:"'JetBrains Mono'", fontSize:'0.65rem', padding:'6px 8px', outline:'none', width:'100%' }} />
            <input value={ex.weight} onChange={e=>updateExercise(i,'weight',e.target.value)} placeholder="80" type="number" style={{ background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'6px', color:'#e8e8f0', fontFamily:"'JetBrains Mono'", fontSize:'0.65rem', padding:'6px 8px', outline:'none', width:'100%' }} />
            <button onClick={() => removeExercise(i)} style={{ background:'none', border:'none', color:'#5a5a70', cursor:'pointer', fontSize:'0.9rem', padding:'0 4px' }}>✕</button>
          </div>
        ))}

        <Btn ghost small onClick={addExercise} style={{ marginTop:'6px' }}>+ ADD EXERCISE</Btn>

        {/* Stats */}
        <div style={{ marginTop:'20px', paddingTop:'16px', borderTop:'1px solid #ffffff0f' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[['TOTAL SESSIONS', totalWorkouts, '#fc5c7d'], ['THIS WEEK', thisWeek, '#ff9500'], ['TOTAL VOL.', `${Math.round((s.physical?.totalVolume||0)/1000)}k kg`, '#ffd700']].map(([lbl,val,col]) => (
              <div key={lbl} style={{ background:'#1a1a24', borderRadius:'10px', padding:'12px', textAlign:'center', border:'1px solid #ffffff0f' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:col }}>{val}</div>
                <div style={{ fontSize:'0.52rem', color:'#5a5a70', letterSpacing:'2px', marginTop:'2px' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Workout History */}
      <Card style={{ gridColumn:'1/-1' }}>
        <AccentLine color="linear-gradient(90deg,#7c5cfc,#fc5c7d)" />
        <CardHeader icon="📋" title="WORKOUT HISTORY" />
        {workouts.length === 0
          ? <div style={{ color:'#5a5a70', fontSize:'0.65rem', letterSpacing:'2px', padding:'30px 0', textAlign:'center' }}>// NO WORKOUTS LOGGED YET — GET TO WORK</div>
          : workouts.slice(0,15).map((w,i) => (
            <div key={w.id||i} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px 0', borderBottom:'1px solid #ffffff0f' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:'#fc5c7d', minWidth:'32px', textAlign:'center' }}>💪</div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.8rem' }}>{w.type}</div>
                <div style={{ fontSize:'0.58rem', color:'#5a5a70', letterSpacing:'1px', marginTop:'2px' }}>
                  {w.date} · {w.duration}min · {w.muscles?.join(', ') || '—'}
                </div>
                {w.exercises?.length > 0 && (
                  <div style={{ fontSize:'0.58rem', color:'#5a5a70', marginTop:'2px' }}>
                    {w.exercises.slice(0,3).map(ex => `${ex.name} ${ex.sets}×${ex.reps}@${ex.weight}`).join(' · ')}
                    {w.exercises.length > 3 && ` +${w.exercises.length-3} more`}
                  </div>
                )}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'0.6rem', color:'#ff9500' }}>{INTENSITY_ICONS[w.intensity-1] || '—'}</div>
                {w.volume > 0 && <div style={{ fontSize:'0.6rem', color:'#5a5a70' }}>{w.volume.toLocaleString()} kg</div>}
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function LeaderboardPanel({ currentUser, currentXp, currentStreak }) {
  const [players, setPlayers] = useState([]);
  const [loadingLb, setLoadingLb] = useState(true);
  const [friendInput, setFriendInput] = useState('');
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    loadLeaderboard(friends);
  }, []);

  async function loadLeaderboard(friendsList = friends) {
    setLoadingLb(true);
    const all = [currentUser, ...friendsList];
    const profiles = await Promise.all(all.map(async u => {
      try {
        const r = await window.storage.get(`khan:profile:${u}`, true);
        if (r && r.value) return JSON.parse(r.value);
        return { username: u, xp: u === currentUser ? currentXp : 0, rank: u === currentUser ? rankFor(currentXp).name : 'UNKNOWN', streak: u === currentUser ? currentStreak : 0 };
      } catch {
        return { username: u, xp: u === currentUser ? currentXp : 0, rank: u === currentUser ? rankFor(currentXp).name : 'UNKNOWN', streak: u === currentUser ? currentStreak : 0 };
      }
    }));
    profiles.sort((a, b) => b.xp - a.xp);
    setPlayers(profiles);
    setLoadingLb(false);
  }

  function addFriend() {
    const name = friendInput.trim();
    if (!name || friends.includes(name) || name === currentUser) { setFriendInput(''); return; }
    const updated = [...friends, name];
    setFriends(updated);
    setFriendInput('');
    loadLeaderboard([...updated]);
  }

  function removeFriend(name) {
    const updated = friends.filter(f => f !== name);
    setFriends(updated);
    setPlayers(prev => prev.filter(p => p.username !== name));
  }

  const MEDALS = ['🥇','🥈','🥉'];

  return (
    <div style={{ display:'grid', gap:'16px' }}>
      <Card>
        <AccentLine color="linear-gradient(90deg,#ffd700,#ff9500)" />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'1.3rem' }}>🏆</span>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.9rem', letterSpacing:'1px' }}>FRIEND LEADERBOARD</span>
          </div>
          <Btn ghost small onClick={() => loadLeaderboard(friends)}>↺ REFRESH</Btn>
        </div>

        {/* Add friend */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
          <input value={friendInput} onChange={e=>setFriendInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addFriend()} placeholder="Enter a friend's username..." style={{ flex:1, background:'#1a1a24', border:'1px solid #ffffff0f', borderRadius:'8px', color:'#e8e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.72rem', padding:'8px 12px', outline:'none' }} />
          <Btn primary small onClick={addFriend}>+ ADD FRIEND</Btn>
        </div>

        {loadingLb
          ? <div style={{ color:'#5a5a70', fontSize:'0.65rem', letterSpacing:'2px', padding:'20px 0', textAlign:'center' }}>// LOADING...</div>
          : players.length === 0
          ? <div style={{ color:'#5a5a70', fontSize:'0.65rem', letterSpacing:'2px', padding:'40px 0', textAlign:'center' }}>// ADD FRIENDS TO COMPETE</div>
          : players.map((p, i) => {
            const r = rankFor(p.xp);
            const isMe = p.username === currentUser;
            return (
              <div key={p.username} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px', borderRadius:'12px', marginBottom:'8px', background: isMe ? '#7c5cfc11' : '#1a1a2411', border:`1px solid ${isMe ? '#7c5cfc44' : '#ffffff0f'}` }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', color: i < 3 ? '#ffd700' : '#5a5a70', minWidth:'36px', textAlign:'center' }}>{MEDALS[i] || `#${i+1}`}</div>
                <div style={{ fontSize:'1.8rem', filter: p.xp > 0 ? 'none' : 'grayscale(1)' }}>{r.badge}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.85rem', color: isMe ? '#e8e8f0' : '#b0b0c0' }}>
                    {p.username} {isMe && <span style={{ fontSize:'0.6rem', color:'#7c5cfc', marginLeft:'6px' }}>YOU</span>}
                  </div>
                  <div style={{ fontSize:'0.6rem', color: r.color, letterSpacing:'2px', marginTop:'2px' }}>{r.icon} {r.name} · 🔥 {p.streak || 0} streak</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:'#7c5cfc' }}>{(p.xp||0).toLocaleString()}</div>
                  <div style={{ fontSize:'0.55rem', color:'#5a5a70', letterSpacing:'2px' }}>XP</div>
                </div>
                {!isMe && <button onClick={() => removeFriend(p.username)} style={{ background:'none', border:'none', color:'#5a5a70', cursor:'pointer', fontSize:'0.8rem' }}>✕</button>}
              </div>
            );
          })
        }
      </Card>

      <Card>
        <AccentLine color="linear-gradient(90deg,#7c5cfc,#fc5c7d)" />
        <CardHeader icon="📢" title="HOW TO COMPETE" />
        <div style={{ fontSize:'0.65rem', color:'#5a5a70', lineHeight:'1.8', letterSpacing:'1px' }}>
          <div style={{ marginBottom:'8px' }}>1. Share your username <span style={{ color:'#7c5cfc' }}>"{currentUser}"</span> with friends</div>
          <div style={{ marginBottom:'8px' }}>2. They add it in their KHAN app under Leaderboard</div>
          <div style={{ marginBottom:'8px' }}>3. Earn XP daily to climb the ranks</div>
          <div>4. Hit refresh to see updated scores</div>
        </div>
      </Card>
    </div>
  );
}

// ─── GOALS ────────────────────────────────────────────────────────────────────
function GoalsPanel({ s, addXp, updateState, showForm, setShowForm, goalTitle, setGoalTitle, goalCat, setGoalCat, goalDate, setGoalDate, goalXp, setGoalXp }) {
  const [goalType, setGoalType] = useState('long');
  const [showShortForm, setShowShortForm] = useState(false);
  const [shortTitle, setShortTitle] = useState('');
  const [shortCat, setShortCat] = useState('trading');
  const [shortDate, setShortDate] = useState('');
  const [shortXp, setShortXp] = useState(200);

  function addGoal(type) {
    const title = type === 'long' ? goalTitle : shortTitle;
    const cat = type === 'long' ? goalCat : shortCat;
    const date = type === 'long' ? goalDate : shortDate;
    const xp = type === 'long' ? goalXp : shortXp;
    if (!title.trim()) return;
    const goal = { id: Date.now(), title, category: cat, date, xpReward: +xp||200, completed: false, type };
    updateState(prev => ({ ...prev, goals: [goal, ...prev.goals] }));
    if (type === 'long') { setGoalTitle(''); setGoalDate(''); setGoalXp(500); setShowForm(false); }
    else { setShortTitle(''); setShortDate(''); setShortXp(200); setShowShortForm(false); }
  }

  function completeGoal(id) {
    const goal = s.goals.find(g => g.id === id);
    if (!goal || goal.completed) return;
    updateState(prev => ({ ...prev, goals: prev.goals.map(g => g.id===id ? {...g,completed:true} : g) }));
    addXp(goal.xpReward);
  }

  function deleteGoal(id) {
    updateState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
  }

  // Goals without a type field default to long-term (backwards compat)
  const longActive = s.goals.filter(g => !g.completed && (g.type === 'long' || !g.type));
  const longDone = s.goals.filter(g => g.completed && (g.type === 'long' || !g.type));
  const shortActive = s.goals.filter(g => !g.completed && g.type === 'short');
  const shortDone = s.goals.filter(g => g.completed && g.type === 'short');

  function GoalRow({ g, size = 'lg' }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'16px', padding: size==='lg' ? '16px' : '12px', borderBottom:'1px solid #ffffff0f', transition:'background 0.2s' }}>
        <div style={{ fontSize: size==='lg' ? '2rem' : '1.6rem' }}>{CAT_ICONS[g.category]||'🎯'}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize: size==='lg' ? '0.9rem' : '0.8rem' }}>{g.title}</div>
          <div style={{ fontSize:'0.58rem', color:'#5a5a70', letterSpacing:'2px', marginTop:'2px' }}>{g.category.toUpperCase()}{g.date ? ` · ${g.date}` : ''}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.1rem', color: CAT_COLORS[g.category]||'#7c5cfc' }}>+{g.xpReward} XP</div>
          <Btn primary small onClick={() => completeGoal(g.id)}>✦ COMPLETE</Btn>
          <Btn danger small onClick={() => deleteGoal(g.id)}>✕</Btn>
        </div>
      </div>
    );
  }

  function CompletedRow({ g }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'16px', padding:'12px 16px', borderBottom:'1px solid #ffffff0f', opacity:0.5 }}>
        <div style={{ fontSize:'1.5rem' }}>{CAT_ICONS[g.category]||'🎯'}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.85rem', textDecoration:'line-through', color:'#5a5a70' }}>{g.title}</div>
        </div>
        <span style={{ color:'#00e5a0', fontSize:'0.65rem', letterSpacing:'2px' }}>ACHIEVED ✓</span>
      </div>
    );
  }

  return (
    <div style={{ display:'grid', gap:'16px' }}>
      {/* LONG-TERM GOALS */}
      <Card>
        <AccentLine color="linear-gradient(90deg,#ffd700,#fc5c7d)" />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'1.3rem' }}>🏔️</span>
            <div>
              <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700 }}>LONG-TERM GOALS</span>
              <div style={{ fontSize:'0.58rem', color:'#5a5a70', letterSpacing:'2px', marginTop:'2px' }}>// BIG VISION · MONTHS OR YEARS OUT</div>
            </div>
          </div>
          <Btn primary onClick={() => setShowForm(!showForm)}>+ ADD GOAL</Btn>
        </div>

        {showForm && (
          <div style={{ background:'#1a1a24', borderRadius:'12px', padding:'20px', marginBottom:'20px', border:'1px solid #7c5cfc33' }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, marginBottom:'14px', fontSize:'0.85rem' }}>NEW LONG-TERM GOAL</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
              <div>
                <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>GOAL TITLE</div>
                <TextInput value={goalTitle} onChange={setGoalTitle} placeholder="e.g. Hit $10k/month trading" />
              </div>
              <div>
                <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>CATEGORY</div>
                <select value={goalCat} onChange={e=>setGoalCat(e.target.value)} style={{ background:'#0a0a0f', border:'1px solid #ffffff0f', borderRadius:'8px', color:'#e8e8f0', fontFamily:"'JetBrains Mono'", fontSize:'0.75rem', padding:'8px 12px', width:'100%', outline:'none', cursor:'pointer' }}>
                  {Object.entries(CAT_ICONS).map(([k,v]) => <option key={k} value={k}>{v} {k}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>TARGET DATE</div>
                <NInput value={goalDate} onChange={setGoalDate} placeholder="" type="date" />
              </div>
              <div>
                <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>XP REWARD</div>
                <NInput value={goalXp} onChange={setGoalXp} placeholder="500" />
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <Btn primary onClick={() => addGoal('long')}>✦ CREATE GOAL</Btn>
              <Btn ghost onClick={() => setShowForm(false)}>CANCEL</Btn>
            </div>
          </div>
        )}

        {longActive.length === 0 && longDone.length === 0 && (
          <div style={{ color:'#5a5a70', fontSize:'0.65rem', letterSpacing:'2px', padding:'30px 0', textAlign:'center' }}>// NO LONG-TERM GOALS YET — THINK BIG, HIT + ADD GOAL</div>
        )}

        {longActive.map(g => <GoalRow key={g.id} g={g} />)}

        {longDone.length > 0 && (
          <>
            <div style={{ fontSize:'0.6rem', letterSpacing:'3px', color:'#5a5a70', padding:'12px 0 8px' }}>// COMPLETED</div>
            {longDone.map(g => <CompletedRow key={g.id} g={g} />)}
          </>
        )}
      </Card>

      {/* SHORT-TERM GOALS */}
      <Card>
        <AccentLine color="linear-gradient(90deg,#00e5a0,#00b4ff)" />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'1.3rem' }}>⚡</span>
            <div>
              <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700 }}>SHORT-TERM GOALS</span>
              <div style={{ fontSize:'0.58rem', color:'#5a5a70', letterSpacing:'2px', marginTop:'2px' }}>// QUICK WINS · DAYS OR WEEKS OUT</div>
            </div>
          </div>
          <Btn onClick={() => setShowShortForm(!showShortForm)} style={{ background:'linear-gradient(135deg,#00e5a044,#00b4ff22)', color:'#00e5a0', border:'1px solid #00e5a033' }}>+ ADD GOAL</Btn>
        </div>

        {showShortForm && (
          <div style={{ background:'#1a1a24', borderRadius:'12px', padding:'20px', marginBottom:'20px', border:'1px solid #00e5a033' }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, marginBottom:'14px', fontSize:'0.85rem' }}>NEW SHORT-TERM GOAL</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
              <div>
                <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>GOAL TITLE</div>
                <TextInput value={shortTitle} onChange={setShortTitle} placeholder="e.g. Complete 20 backtests this week" />
              </div>
              <div>
                <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>CATEGORY</div>
                <select value={shortCat} onChange={e=>setShortCat(e.target.value)} style={{ background:'#0a0a0f', border:'1px solid #ffffff0f', borderRadius:'8px', color:'#e8e8f0', fontFamily:"'JetBrains Mono'", fontSize:'0.75rem', padding:'8px 12px', width:'100%', outline:'none', cursor:'pointer' }}>
                  {Object.entries(CAT_ICONS).map(([k,v]) => <option key={k} value={k}>{v} {k}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>TARGET DATE</div>
                <NInput value={shortDate} onChange={setShortDate} placeholder="" type="date" />
              </div>
              <div>
                <div style={{ fontSize:'0.6rem', color:'#5a5a70', letterSpacing:'2px', marginBottom:'4px' }}>XP REWARD</div>
                <NInput value={shortXp} onChange={setShortXp} placeholder="200" />
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <Btn onClick={() => addGoal('short')} style={{ background:'linear-gradient(135deg,#00e5a0,#00b4ff)', color:'#0a0a0f' }}>✦ CREATE GOAL</Btn>
              <Btn ghost onClick={() => setShowShortForm(false)}>CANCEL</Btn>
            </div>
          </div>
        )}

        {shortActive.length === 0 && shortDone.length === 0 && (
          <div style={{ color:'#5a5a70', fontSize:'0.65rem', letterSpacing:'2px', padding:'30px 0', textAlign:'center' }}>// NO SHORT-TERM GOALS YET — BREAK YOUR VISION INTO QUICK WINS</div>
        )}

        {shortActive.map(g => <GoalRow key={g.id} g={g} size="sm" />)}

        {shortDone.length > 0 && (
          <>
            <div style={{ fontSize:'0.6rem', letterSpacing:'3px', color:'#5a5a70', padding:'12px 0 8px' }}>// COMPLETED</div>
            {shortDone.map(g => <CompletedRow key={g.id} g={g} />)}
          </>
        )}
      </Card>
    </div>
  );
}
