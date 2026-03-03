import React, { useState, useEffect } from 'react'
// FIREBASE IMPORTI
import { db, auth, provider } from './firebase'; 
import { doc, onSnapshot, setDoc, collection, deleteDoc } from "firebase/firestore";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";

function App() {
  // --- AUTH STATES ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({ email: '', password: '' });

  // --- TVOJI UI STATES ---
  const [activeTab, setActiveTab] = useState('home');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false); // Napomena: Zbog ranijeg zahtjeva, možeš je podesiti na 'true' ako želiš multi-add default otvoren
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matchFilter, setMatchFilter] = useState('all');

  // --- FILTERS STATE FOR STATS ---
  const [statsFilters, setStatsFilters] = useState({
    season: 'all', club: 'all', type: 'all', location: 'all', startDate: '', endDate: '', lastMatches: '' 
  });
  
  // Filteri za Club Stats
  const [clubStatsFilters, setClubStatsFilters] = useState({
    season: 'all', location: 'all', type: 'all', startDate: '', endDate: '', lastMatches: '', myRole: 'all' 
  });
  
  // Filter za League Table
  const [tableSeasonFilter, setTableSeasonFilter] = useState('2025/26');

  // --- PLAYER DATA ---
  const [player, setPlayer] = useState({ 
      firstName: "First Name", lastName: "Last Name", club: "Your Club", league: "Your League",
      position: "ST", country: "Bosnia and Herzegovina", birthDate: "01/01/2008", 
      height: "180", weight: "75", bootSize: "43", bootModel: "Nike Mercurial",
      jerseyNumber: "10", preferredFoot: "Right", marketValue: "500", mvUnit: "k",
      playerLevel: "Amateur"
  });

  // --- CLUB DATA ---
  const [clubInfo, setClubInfo] = useState({
      name: "Your Club", location: "City Name", coach: "Coach Name", stadium: "Stadium Name",
      season: "2025/26", league: "League Name"
  });

  const [leagueTable, setLeagueTable] = useState([]);
  const [matches, setMatches] = useState([]);
  
  const [upcoming, setUpcoming] = useState({ 
      homeTeam: "Your Club", awayTeam: "Opponent", date: "", stadium: "" 
  });

  // --- NEW MATCH FORM STATE ---
  const [newMatch, setNewMatch] = useState({
    homeTeam: "", awayTeam: "", stadium: "", referee: "", score: "", 
    myGoals: "", myAssists: "", yellowCards: "", redCards: "", minutesPlayed: "", notes: "", 
    status: "finished", date: "", outcome: "win", location: "home", participation: "starter",
    matchType: "league", season: "2025/26", rating: "7", isCaptain: false, subInMinute: ""
  });

  // ---------------------------------------------------------
  // FIREBASE AUTH & REAL-TIME SYNC
  // ---------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const uPath = `users/${user.uid}`;

    const unsubPlayer = onSnapshot(doc(db, uPath, "data", "player"), (doc) => { if (doc.exists()) setPlayer(doc.data()); });
    const unsubClub = onSnapshot(doc(db, uPath, "data", "club"), (doc) => { if (doc.exists()) setClubInfo(doc.data()); });
    const unsubUpcoming = onSnapshot(doc(db, uPath, "data", "upcoming"), (doc) => { if (doc.exists()) setUpcoming(doc.data()); });
    const unsubMatches = onSnapshot(collection(db, uPath, "matches"), (snapshot) => {
      setMatches(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    const unsubTable = onSnapshot(collection(db, uPath, "leagueTable"), (snapshot) => {
      setLeagueTable(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => { unsubPlayer(); unsubClub(); unsubUpcoming(); unsubMatches(); unsubTable(); };
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, authData.email, authData.password);
      else await createUserWithEmailAndPassword(auth, authData.email, authData.password);
    } catch (err) { alert(err.message); }
  };

  // ---------------------------------------------------------
  // HELPERS (Netaknuto tvoje)
  // ---------------------------------------------------------
  const parseDate = (str) => {
    if(!str) return new Date(0);
    const [d, m, y] = str.split('/');
    return new Date(`${y}-${m}-${d}`);
  };

  const calculateAge = (dob) => {
    if(!dob || dob.length < 10) return "0";
    const [d, m, y] = dob.split('/');
    const birthDate = new Date(`${y}-${m}-${d}`);
    const diff = Date.now() - birthDate.getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
  };

  const getDaysDiff = (dateStr, isFuture = false) => {
    if(!dateStr) return null;
    let target;
    if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        target = new Date(`${y}-${m}-${d}`);
    } else {
        target = new Date(dateStr);
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = isFuture ? target - today : today - target;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };

  const formatBirthdayInput = (val) => {
    const digits = val.replace(/\D/g, '').substring(0, 8);
    let final = digits;
    if (digits.length > 2) final = digits.substring(0, 2) + '/' + digits.substring(2);
    if (digits.length > 4) final = final.substring(0, 5) + '/' + final.substring(5, 9);
    return final;
  };

  const seasons = [];
  for (let i = 2025; i >= 2000; i--) {
    const start = i;
    const end = (i + 1).toString().slice(-2);
    seasons.push(`${start}/${end}`);
  }

  // --- ACTIONS (Povezane na Firebase) ---
  const handleSaveMatch = async () => {
    if (!newMatch.homeTeam || !newMatch.awayTeam || !user) return;
    const id = editingMatchId ? editingMatchId.toString() : Date.now().toString();
    
    await setDoc(doc(db, `users/${user.uid}/matches`, id), { ...newMatch, id });
    
    setNewMatch({ 
        homeTeam: "", awayTeam: "", stadium: "", referee: "", score: "", 
        myGoals: "", myAssists: "", yellowCards: "", redCards: "", minutesPlayed: "", notes: "", 
        status: "finished", date: "", outcome: "win", location: "home", participation: "starter",
        matchType: "league", season: "2025/26", rating: "7", isCaptain: false, subInMinute: ""
    });
    setShowAddMatch(false);
    setEditingMatchId(null);
  };

  const startEditMatch = (match) => {
    setNewMatch(match);
    setEditingMatchId(match.id);
    setShowAddMatch(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMatch = async (id) => {
    if(window.confirm("Delete this match?")) await deleteDoc(doc(db, `users/${user.uid}/matches`, id.toString()));
  };

  const updateTableRow = async (id, field, value) => {
    const row = leagueTable.find(r => r.id === id);
    await setDoc(doc(db, `users/${user.uid}/leagueTable`, id.toString()), { ...row, [field]: value });
  };

  const deleteTableRow = async (id) => {
    if(window.confirm("Delete this team from table?")) await deleteDoc(doc(db, `users/${user.uid}/leagueTable`, id.toString()));
  };

  const addTableRow = async () => {
    const id = Date.now().toString();
    await setDoc(doc(db, `users/${user.uid}/leagueTable`, id), { id, name: "New Team", w: 0, d: 0, l: 0, gf: 0, ga: 0, season: tableSeasonFilter });
  };

  const handleMainSave = async () => { 
    if(!user) return;
    await setDoc(doc(db, `users/${user.uid}/data`, "player"), player); 
    await setDoc(doc(db, `users/${user.uid}/data`, "club"), clubInfo); 
    await setDoc(doc(db, `users/${user.uid}/data`, "upcoming"), upcoming); 
    setIsEditing(false); 
  };

  // --- CLUB STATISTICS ---
  let filteredForClubStats = matches.filter(m => {
    if (m.status !== 'finished') return false;
    const mDate = parseDate(m.date);
    const start = clubStatsFilters.startDate ? parseDate(clubStatsFilters.startDate) : null;
    const end = clubStatsFilters.endDate ? parseDate(clubStatsFilters.endDate) : null;

    if (clubStatsFilters.season !== 'all' && m.season !== clubStatsFilters.season) return false;
    if (clubStatsFilters.location !== 'all' && m.location !== clubStatsFilters.location) return false;
    if (clubStatsFilters.type !== 'all' && m.matchType !== clubStatsFilters.type) return false;
   
    if (start && mDate < start) return false;
    if (end && mDate > end) return false;

    if (clubStatsFilters.myRole === 'starter' && m.participation !== 'starter') return false;
    if (clubStatsFilters.myRole === 'sub' && m.participation !== 'substitute') return false;
    if (clubStatsFilters.myRole === 'played' && m.participation === 'none') return false;
    if (clubStatsFilters.myRole === 'captain' && !m.isCaptain) return false;
    if (clubStatsFilters.myRole === 'dnp' && m.participation !== 'none') return false;

    return true;
  });

  if (clubStatsFilters.lastMatches && Number(clubStatsFilters.lastMatches) > 0) {
    filteredForClubStats = filteredForClubStats.slice(0, Number(clubStatsFilters.lastMatches));
  }

  const clubStats = filteredForClubStats.reduce((acc, m) => {
      acc.played += 1;
      if (m.outcome === 'win') acc.wins += 1;
      else if (m.outcome === 'draw') acc.draws += 1;
      else acc.losses += 1;

      const [h, a] = (m.score || "0-0").split('-').map(Number);
      if (!isNaN(h) && !isNaN(a)) {
        acc.goalsScored += (m.location === 'home' ? h : a);
        acc.goalsConceded += (m.location === 'home' ? a : h);
        const conceded = (m.location === 'home' ? a : h);
        if (conceded === 0) acc.cleanSheets += 1;
      }
      acc.yellows += Number(m.yellowCards || 0);
      acc.reds += Number(m.redCards || 0);
    return acc;
  }, { played: 0, wins: 0, draws: 0, losses: 0, goalsScored: 0, goalsConceded: 0, yellows: 0, reds: 0, cleanSheets: 0 });

  // --- CAREER STATISTICS CALCULATION ---
  let filteredForStats = matches.filter(m => {
    if (m.status !== 'finished') return false;
    const mDate = parseDate(m.date);
    const start = statsFilters.startDate ? parseDate(statsFilters.startDate) : null;
    const end = statsFilters.endDate ? parseDate(statsFilters.endDate) : null;

    if (statsFilters.season !== 'all' && m.season !== statsFilters.season) return false;
    if (statsFilters.club !== 'all' && (m.homeTeam !== statsFilters.club && m.awayTeam !== statsFilters.club)) return false;
    if (statsFilters.type !== 'all' && m.matchType !== statsFilters.type) return false;
    if (statsFilters.location !== 'all' && m.location !== statsFilters.location) return false;
    if (start && mDate < start) return false;
    if (end && mDate > end) return false;

    return true;
  });

  if (statsFilters.lastMatches && Number(statsFilters.lastMatches) > 0) {
    filteredForStats = filteredForStats.slice(0, Number(statsFilters.lastMatches));
  }

  const stats = filteredForStats.reduce((acc, m) => {
    acc.goals += Number(m.myGoals || 0);
    acc.assists += Number(m.myAssists || 0);
    acc.yellows += Number(m.yellowCards || 0);
    acc.reds += Number(m.redCards || 0);
    acc.minutes += Number(m.minutesPlayed || 0);
    acc.ratingsSum += Number(m.rating || 0);
    acc.played += 1;
    if (m.isCaptain) acc.captainCount += 1;
    if (m.participation === 'starter') acc.starts += 1;
    else if (m.participation === 'substitute') acc.offBench += 1;
    else acc.unused += 1;
  
    return acc;
  }, { goals: 0, assists: 0, yellows: 0, reds: 0, minutes: 0, played: 0, ratingsSum: 0, captainCount: 0, starts: 0, offBench: 0, unused: 0 });

  const avgMinutes = stats.played > 0 ? (stats.minutes / stats.played).toFixed(1) : 0;
  const avgRating = stats.played > 0 ? (stats.ratingsSum / stats.played).toFixed(1) : 0;
  const minPerGoal = stats.goals > 0 ? (stats.minutes / stats.goals).toFixed(1) : 0;
  
  const avgRatingLast5 = matches.filter(m => m.status === 'finished').slice(0, 5).length > 0 
    ? (matches.filter(m => m.status === 'finished').slice(0, 5).reduce((acc, m) => acc + Number(m.rating || 0), 0) / matches.filter(m => m.status === 'finished').slice(0, 5).length).toFixed(1)
    : "0.0";

  const countries = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "North Korea", "South Korea", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "Spain", "Sri Lanka", "Sudan", "Suriname", "Swaziland", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];
  const positions = ["GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"];
  const levels = ["Amateur", "Semi-Pro", "Professional"];
  const bootSizes = [];
  for(let i=30; i<=50; i++) {
    bootSizes.push(`${i}`, `${i} 1/3`, `${i}.5`, `${i} 2/3`);
  }

  // --- TABELA LOGIKA ---
  const filteredTableData = leagueTable.filter(row => row.season === tableSeasonFilter);
  const tableWithStats = filteredTableData.map(row => {
    const p = (row.w || 0) + (row.d || 0) + (row.l || 0);
    const gd = (row.gf || 0) - (row.ga || 0);
    const pts = (row.w || 0) * 3 + (row.d || 0) * 1;
    return { ...row, p, gd, pts };
  });
  const sortedTable = [...tableWithStats].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  const myClubIndex = sortedTable.findIndex(t => t.name.toLowerCase() === clubInfo.name.toLowerCase());
  const myClubPosition = myClubIndex !== -1 ? myClubIndex + 1 : '—';
  
  const filteredMatches = matches.filter(m => {
    if (matchFilter === 'all') return true;
    if (matchFilter === 'finished' || matchFilter === 'upcoming') return m.status === matchFilter;
    return m.outcome === matchFilter;
  });
  
  const uniqueClubs = Array.from(new Set(matches.flatMap(m => [m.homeTeam, m.awayTeam]).filter(Boolean)));

  // ---------------------------------------------------------
  // RENDER LOGIN EKRAN
  // ---------------------------------------------------------
  if (loading) return <div style={{background:'#0D0E12', height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', color:'#3A86FF'}}>Učitavanje...</div>;

  if (!user) {
    return (
      <div style={{background:'#0D0E12', height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>
        <div style={{...cardStyle, maxWidth:'400px', width:'100%', textAlign:'center'}}>
          <h2 style={{color:'#3A86FF', letterSpacing:'3px', fontSize:'12px'}}>MY FOOTBALL CAREER</h2>
          <h1 style={{margin:'20px 0'}}>{authMode === 'login' ? 'Prijava' : 'Registracija'}</h1>
          <form onSubmit={handleAuth} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            <input style={inputStyle} type="email" placeholder="Email" onChange={e=>setAuthData({...authData, email:e.target.value})} required />
            <input style={inputStyle} type="password" placeholder="Lozinka" onChange={e=>setAuthData({...authData, password:e.target.value})} required />
            <button style={{...primaryBtn, background:'#3A86FF', border:'none', width:'100%'}} type="submit">{authMode.toUpperCase()}</button>
          </form>
          <button onClick={() => signInWithPopup(auth, provider)} style={{...primaryBtn, background:'white', color:'black', marginTop:'10px', width:'100%'}}>GOOGLE LOGIN</button>
          <p onClick={() => setAuthMode(authMode === 'login' ? 'reg' : 'login')} style={{color:'#888', cursor:'pointer', textAlign:'center', marginTop:'15px'}}>
            {authMode === 'login' ? 'Nemaš nalog? Registruj se' : 'Već imaš nalog? Prijavi se'}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // RENDER GLAVNA APLIKACIJA (Tvoj dizajn netaknut)
  // ---------------------------------------------------------
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0D0E12', color: '#E0E0E0', fontFamily: '"Inter", sans-serif' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: '260px', backgroundColor: '#15171C', padding: '30px 20px', borderRight: '1px solid #252830', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '900', letterSpacing: '3px', color: '#3A86FF', marginBottom: '40px', textAlign: 'center' }}>MY FOOTBALL CAREER</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <MenuBtn label="Dashboard" active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon="⬩" />
          <MenuBtn label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon="👤" />
          <MenuBtn label="My Club" active={activeTab === 'club'} onClick={() => setActiveTab('club')} icon="🛡" />
          <MenuBtn label="Matches" active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} icon="🏟" />
          <MenuBtn label="Statistics" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon="📊" />
          <MenuBtn label="Seasons" active={activeTab === 'seasons'} onClick={() => setActiveTab('seasons')} icon="📅" />
          <MenuBtn label="Goals" active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon="🎯" />
          <MenuBtn label="Training Centre" active={activeTab === 'training'} onClick={() => setActiveTab('training')} icon="🏃" />
          <MenuBtn label="Analyses & Notes" active={activeTab === 'analyses'} onClick={() => setActiveTab('analyses')} icon="📝" />
          <MenuBtn label="Injuries" active={activeTab === 'injuries'} onClick={() => setActiveTab('injuries')} icon="🏥" />
          <MenuBtn label="Awards" active={activeTab === 'awards'} onClick={() => setActiveTab('awards')} icon="🏆" />
          <MenuBtn label="Transfers" active={activeTab === 'transfers'} onClick={() => setActiveTab('transfers')} icon="⇄" />
          <MenuBtn label="Sponsors" active={activeTab === 'sponsors'} onClick={() => setActiveTab('sponsors')} icon="💎" />
          <MenuBtn label="Gallery" active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} icon="📸" />
          <MenuBtn label="Friends" active={activeTab === 'friends'} onClick={() => setActiveTab('friends')} icon="👥" />
          
          {/* Dodat Account tab ispod svega na zahtjev */}
          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #252830' }}>
            <MenuBtn label="Account" active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon="🔐" />
            <MenuBtn label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon="⚙" />
            <MenuBtn label="Support" active={activeTab === 'support'} onClick={() => setActiveTab('support')} icon="✉" />
          </div>
        </nav>
      </div>

      <div style={{ flex: 1, padding: '40px 60px', overflowY: 'auto' }}>
        
        {/* DASHBOARD */}
        {activeTab === 'home' && (
          <div style={{ maxWidth: '1000px' }}>
            <h4 style={{ color: '#3A86FF', margin: 0, fontSize: '12px', letterSpacing: '1px' }}>OVERVIEW</h4>
            <h1 style={{ fontSize: '32px', margin: '5px 0' }}>Welcome back, {player.firstName}</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '25px', marginTop: '30px' }}>
              <div style={cardStyle}>
                <div style={{display:'flex', justifyContent:'space-between'}}><label style={labelStyle}>Last Match</label><span style={{fontSize:'11px', color:'#3A86FF'}}>{matches[0] ? `${getDaysDiff(matches[0].date)} days ago` : 'No data'}</span></div>
                {matches[0] ? <div style={{marginTop:'15px'}}><h2 style={{margin:0}}>{matches[0].homeTeam} {matches[0].score} {matches[0].awayTeam}</h2><p style={{fontSize:'12px', color:'#555'}}>{matches[0].stadium}</p></div> : <p>No matches yet.</p>}
              </div>
              <div style={{...cardStyle, border:'1px solid #3A86FF'}}>
                <div style={{display:'flex', justifyContent:'space-between'}}><label style={labelStyle}>Next Match</label><span style={{fontSize:'11px', color:'#3A86FF'}}>{upcoming.date ? `${getDaysDiff(upcoming.date, true)} days left` : 'TBD'}</span></div>
                <div style={{marginTop:'15px'}}>
                    {upcoming.date ? (
                        <>
                            <h2 style={{margin:0}}>{upcoming.homeTeam} vs {upcoming.awayTeam}</h2>
                            <input type="date" style={{...inputStyle, background:'transparent', border:'none', padding:0, color:'#555'}} value={upcoming.date} onChange={e => setUpcoming({...upcoming, date: e.target.value})} />
                        </>
                    ) : ( <p style={{fontSize:'14px', color:'#888', fontStyle:'italic'}}>Next match is not scheduled yet.</p> )}
                </div>
              </div>
              <div style={cardStyle}><div style={{display:'flex', justifyContent:'space-between'}}><label style={labelStyle}>Your Form</label><span style={{fontSize:'11px', color:'#3A86FF'}}>AVG Rating</span></div><div style={{marginTop:'15px'}}><h2 style={{margin:0, color:'#3A86FF'}}>{avgRatingLast5}</h2><p style={{fontSize:'12px', color:'#555'}}>Recent performance</p></div></div>
              <div style={cardStyle}><label style={labelStyle}>Club Form</label><div style={{display:'flex', gap:'8px', marginTop:'15px'}}>{matches.filter(m => m.status === 'finished').slice(0, 5).reverse().map(m => (<div key={m.id} style={{width:'30px', height:'30px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'bold', backgroundColor: m.outcome === 'win' ? '#4CAF50' : m.outcome === 'loss' ? '#F44336' : '#888'}}>{m.outcome === 'win' ? 'W' : m.outcome === 'loss' ? 'L' : 'D'}</div>))}</div></div>
            </div>
          </div>
        )}

        {/* CLUB SECTION */}
        {activeTab === 'club' && (
          <div style={{ maxWidth: '1000px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div><h4 style={{ color: '#3A86FF', margin: 0, fontSize: '12px' }}>TEAM HUB</h4><h1>{clubInfo.name}</h1></div>
              <button onClick={() => isEditing ? handleMainSave() : setIsEditing(true)} style={{ ...primaryBtn, border: isEditing ? '1px solid #3A86FF' : '1px solid #252830', color: isEditing ? '#3A86FF' : 'white' }}>{isEditing ? '💾 SAVE TO CLOUD' : '✎ EDIT CLUB'}</button>
            </div>
            <div style={{...cardStyle, gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px', padding: '25px', borderLeft: '4px solid #3A86FF'}}>
                <ProfileField label="Club Name" value={clubInfo.name} edit={isEditing} onChange={(v) => setClubInfo({...clubInfo, name: v})} />
                <ProfileField label="City" value={clubInfo.location} edit={isEditing} onChange={(v) => setClubInfo({...clubInfo, location: v})} />
                <ProfileField label="Coach" value={clubInfo.coach} edit={isEditing} onChange={(v) => setClubInfo({...clubInfo, coach: v})} />
                <ProfileField label="Stadium" value={clubInfo.stadium} edit={isEditing} onChange={(v) => setClubInfo({...clubInfo, stadium: v})} />
                <div style={fieldGroup}><label style={labelStyle}>Current Season</label>{isEditing ? (<select style={inputStyle} value={clubInfo.season} onChange={e => setClubInfo({...clubInfo, season: e.target.value})}>{seasons.map(s => <option key={s} value={s}>{s}</option>)}</select>) : <p style={valueStyle}>{clubInfo.season}</p>}</div>
                <ProfileField label="League" value={clubInfo.league} edit={isEditing} onChange={(v) => setClubInfo({...clubInfo, league: v})} />
                <div style={fieldGroup}><label style={labelStyle}>League Position</label><p style={{...valueStyle, color: '#3A86FF', fontWeight: '900'}}>{myClubPosition}.</p></div>
                <div style={fieldGroup}><label style={labelStyle}>Trend</label><p style={{...valueStyle, color: '#4CAF50'}}>Stable ▲</p></div>
            </div>

            <div style={{...cardStyle, gridTemplateColumns: '1fr', gap: '25px', marginBottom: '30px', padding: '25px', borderLeft: '4px solid #3A86FF'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><h3 style={{margin: 0, fontSize: '14px', letterSpacing: '1px'}}>PERFORMANCE</h3></div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', backgroundColor: '#1C1F26', padding: '20px', borderRadius: '12px'}}>
                    <div style={fieldGroup}><label style={labelStyle}>Season</label><select style={inputStyle} value={clubStatsFilters.season} onChange={e => setClubStatsFilters({...clubStatsFilters, season: e.target.value})}><option value="all">All Seasons</option>{seasons.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div style={fieldGroup}><label style={labelStyle}>Location</label><select style={inputStyle} value={clubStatsFilters.location} onChange={e => setClubStatsFilters({...clubStatsFilters, location: e.target.value})}><option value="all">Home & Away</option><option value="home">Home</option><option value="away">Away</option></select></div>
                    <div style={fieldGroup}><label style={labelStyle}>Type</label><select style={inputStyle} value={clubStatsFilters.type} onChange={e => setClubStatsFilters({...clubStatsFilters, type: e.target.value})}><option value="all">All Competitions</option><option value="league">League</option><option value="cup">Cup</option><option value="friendly">Friendly</option></select></div>
                    <div style={fieldGroup}><label style={labelStyle}>My Role In Team</label><select style={inputStyle} value={clubStatsFilters.myRole} onChange={e => setClubStatsFilters({...clubStatsFilters, myRole: e.target.value})}><option value="all">Any Status</option><option value="starter">As Starter</option><option value="sub">From the bench</option><option value="played">Played (All)</option><option value="captain">As Captain</option><option value="dnp">Did Not Play</option></select></div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', textAlign: 'center'}}>
                    <div style={{padding: '15px', background: '#0D0E12', borderRadius: '10px'}}><label style={labelStyle}>Matches</label><h2 style={{margin: '5px 0'}}>{clubStats.played}</h2></div>
                    <div style={{padding: '15px', background: '#0D0E12', borderRadius: '10px'}}><label style={labelStyle}>Wins</label><h2 style={{margin: '5px 0', color: '#4CAF50'}}>{clubStats.wins}</h2></div>
                    <div style={{padding: '15px', background: '#0D0E12', borderRadius: '10px'}}><label style={labelStyle}>Draws</label><h2 style={{margin: '5px 0', color: '#888'}}>{clubStats.draws}</h2></div>
                    <div style={{padding: '15px', background: '#0D0E12', borderRadius: '10px'}}><label style={labelStyle}>Losses</label><h2 style={{margin: '5px 0', color: '#F44336'}}>{clubStats.losses}</h2></div>
                    <div style={{padding: '15px', background: '#0D0E12', borderRadius: '10px'}}><label style={labelStyle}>Cards</label><h2 style={{margin: '5px 0'}}><span style={{color: '#FFD700'}}>{clubStats.yellows}Y</span> <span style={{color: '#F44336'}}>{clubStats.reds}R</span></h2></div>
                </div>
            </div>

            <div style={{...cardStyle, gridTemplateColumns:'1fr', padding: '25px', borderLeft: '4px solid #3A86FF'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems: 'center'}}>
                    <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}><label style={labelStyle}>LEAGUE STANDINGS</label><select style={{...inputStyle, width: 'auto', padding: '5px 15px'}} value={tableSeasonFilter} onChange={e => setTableSeasonFilter(e.target.value)}>{seasons.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    {isEditing && <button onClick={addTableRow} style={{...primaryBtn, padding:'5px 15px', fontSize:'10px', backgroundColor:'#3A86FF', color:'white'}}>+ ADD TEAM</button>}
                </div>
                <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left'}}>
                    <thead><tr style={{color:'#50535E', fontSize:'12px', borderBottom:'1px solid #252830'}}><th style={{padding:'10px'}}>#</th><th>TEAM</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th>{isEditing && <th>ACTIONS</th>}</tr></thead>
                    <tbody>
                        {sortedTable.map((row, idx) => {
                            const isMyClub = row.name.toLowerCase() === clubInfo.name.toLowerCase();
                            return (
                                <tr key={row.id} style={{ borderBottom: '1px solid #1C1F26', fontSize: '14px', backgroundColor: isMyClub ? 'rgba(58, 134, 255, 0.15)' : 'transparent', borderLeft: isMyClub ? '4px solid #3A86FF' : 'none' }}>
                                    <td style={{padding:'12px', fontWeight: isMyClub ? '900' : 'normal', color: isMyClub ? '#3A86FF' : 'white'}}>{idx + 1}</td>
                                    <td style={{fontWeight: isMyClub ? '900' : 'normal', color: isMyClub ? '#3A86FF' : 'white'}}>{isEditing ? <input style={{...inputStyle, padding:'4px 8px'}} value={row.name} onChange={e => updateTableRow(row.id, 'name', e.target.value)} /> : (isMyClub ? row.name.toUpperCase() : row.name)}</td>
                                    <td>{row.p}</td>
                                    <td>{isEditing ? <input type="number" style={{...inputStyle, padding:'4px 8px', width:'50px'}} value={row.w} onChange={e => updateTableRow(row.id, 'w', parseInt(e.target.value) || 0)} /> : row.w}</td>
                                    <td>{isEditing ? <input type="number" style={{...inputStyle, padding:'4px 8px', width:'50px'}} value={row.d} onChange={e => updateTableRow(row.id, 'd', parseInt(e.target.value) || 0)} /> : row.d}</td>
                                    <td>{isEditing ? <input type="number" style={{...inputStyle, padding:'4px 8px', width:'50px'}} value={row.l} onChange={e => updateTableRow(row.id, 'l', parseInt(e.target.value) || 0)} /> : row.l}</td>
                                    <td>{isEditing ? <input type="number" style={{...inputStyle, padding:'4px 8px', width:'50px'}} value={row.gf} onChange={e => updateTableRow(row.id, 'gf', parseInt(e.target.value) || 0)} /> : row.gf}</td>
                                    <td>{isEditing ? <input type="number" style={{...inputStyle, padding:'4px 8px', width:'50px'}} value={row.ga} onChange={e => updateTableRow(row.id, 'ga', parseInt(e.target.value) || 0)} /> : row.ga}</td>
                                    <td>{row.gd}</td>
                                    <td style={{fontWeight:'900', color: isMyClub ? '#3A86FF' : 'white'}}>{row.pts}</td>
                                    {isEditing && <td>{!isMyClub && <button onClick={() => deleteTableRow(row.id)} style={{background:'none', border:'none', color:'#F44336', cursor:'pointer', fontSize:'11px'}}>Delete</button>}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          </div>
        )}

        {/* PROFILE SECTION */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: '1000px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
              <div><h4 style={{ color: '#3A86FF', margin: 0, fontSize: '12px' }}>PLAYER IDENTITY</h4><h1>Profile details</h1></div>
              <button onClick={() => isEditing ? handleMainSave() : setIsEditing(true)} style={{ ...primaryBtn, border: isEditing ? '1px solid #3A86FF' : '1px solid #252830', color: isEditing ? '#3A86FF' : 'white' }}>{isEditing ? '💾 SAVE TO CLOUD' : '✎ EDIT PROFILE'}</button>
            </div>
            <div style={{ ...cardStyle, gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }}>
              <ProfileField label="First Name" value={player.firstName} edit={isEditing} onChange={(v) => setPlayer({...player, firstName: v})} />
              <ProfileField label="Last Name" value={player.lastName} edit={isEditing} onChange={(v) => setPlayer({...player, lastName: v})} />
              <ProfileField label="Current Club" value={player.club} edit={isEditing} onChange={(v) => setPlayer({...player, club: v})} />
              <ProfileField label="League" value={player.league} edit={isEditing} onChange={(v) => setPlayer({...player, league: v})} />
              <div style={fieldGroup}><label style={labelStyle}>Player Level</label>{isEditing ? <select style={inputStyle} value={player.playerLevel} onChange={e => setPlayer({...player, playerLevel: e.target.value})}>{levels.map(l => <option key={l} value={l}>{l}</option>)}</select> : <p style={valueStyle}>{player.playerLevel}</p>}</div>
              <div style={fieldGroup}><label style={labelStyle}>Nationality</label>{isEditing ? <select style={inputStyle} value={player.country} onChange={e => setPlayer({...player, country: e.target.value})}>{countries.map(c => <option key={c} value={c}>{c}</option>)}</select> : <p style={valueStyle}>{player.country}</p>}</div>
              <div style={fieldGroup}><label style={labelStyle}>Position</label>{isEditing ? <select style={inputStyle} value={player.position} onChange={e => setPlayer({...player, position: e.target.value})}>{positions.map(p => <option key={p} value={p}>{p}</option>)}</select> : <p style={valueStyle}>{player.position}</p>}</div>
              <div style={fieldGroup}><label style={labelStyle}>Jersey Number</label>{isEditing ? <input type="number" style={inputStyle} value={player.jerseyNumber} onChange={e => setPlayer({...player, jerseyNumber: e.target.value})} /> : <p style={valueStyle}>{player.jerseyNumber}</p>}</div>
              <div style={fieldGroup}><label style={labelStyle}>Birth Date</label>{isEditing ? <input placeholder="DD/MM/YYYY" style={inputStyle} value={player.birthDate} onChange={e => setPlayer({...player, birthDate: formatBirthdayInput(e.target.value)})} /> : <p style={valueStyle}>{player.birthDate}</p>}</div>
              <div style={fieldGroup}><label style={labelStyle}>Age</label><p style={valueStyle}>{calculateAge(player.birthDate)} years old</p></div>
              <div style={fieldGroup}><label style={labelStyle}>Market Value</label>{isEditing ? <div style={{display:'flex', gap:'5px'}}><input type="number" style={inputStyle} value={player.marketValue} onChange={e => setPlayer({...player, marketValue: e.target.value})} /><select style={inputStyle} value={player.mvUnit} onChange={e => setPlayer({...player, mvUnit: e.target.value})}><option value="k">k</option><option value="M">M</option></select></div> : <p style={valueStyle}>€{player.marketValue}{player.mvUnit}</p>}</div>
              <div style={fieldGroup}><label style={labelStyle}>Height</label>{isEditing ? <input type="number" style={inputStyle} value={player.height} onChange={e => setPlayer({...player, height: e.target.value})} /> : <p style={valueStyle}>{player.height} cm</p>}</div>
              <div style={fieldGroup}><label style={labelStyle}>Weight</label>{isEditing ? <input type="number" style={inputStyle} value={player.weight} onChange={e => setPlayer({...player, weight: e.target.value})} /> : <p style={valueStyle}>{player.weight} kg</p>}</div>
              <div style={fieldGroup}><label style={labelStyle}>Preferred Foot</label>{isEditing ? <select style={inputStyle} value={player.preferredFoot} onChange={e => setPlayer({...player, preferredFoot: e.target.value})}><option value="Right">Right</option><option value="Left">Left</option><option value="Both">Both</option></select> : <p style={valueStyle}>{player.preferredFoot}</p>}</div>
              <ProfileField label="Boot Model" value={player.bootModel} edit={isEditing} onChange={(v) => setPlayer({...player, bootModel: v})} />
              <div style={fieldGroup}><label style={labelStyle}>Boot Size</label>{isEditing ? <select style={inputStyle} value={player.bootSize} onChange={e => setPlayer({...player, bootSize: e.target.value})}>{bootSizes.map(s => <option key={s} value={s}>{s}</option>)}</select> : <p style={valueStyle}>{player.bootSize}</p>}</div>
            </div>
          </div>
        )}

        {/* MATCHES SECTION */}
        {activeTab === 'matches' && (
          <div style={{ maxWidth: '1000px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div><h4 style={{ color: '#3A86FF', fontSize: '12px' }}>FIXTURES</h4><h1>{editingMatchId ? 'Edit Match' : 'Match History'}</h1></div>
              <button onClick={() => { setShowAddMatch(!showAddMatch); setEditingMatchId(null); }} style={primaryBtn}>{showAddMatch ? '✕ CLOSE' : '＋ ADD MATCH'}</button>
            </div>
            {showAddMatch && (
              <div style={{ ...cardStyle, marginBottom: '30px', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <div style={fieldGroup}><label style={labelStyle}>Home Team</label><input style={inputStyle} value={newMatch.homeTeam} onChange={e => setNewMatch({...newMatch, homeTeam: e.target.value})} /></div>
                  <div style={fieldGroup}><label style={labelStyle}>Away Team</label><input style={inputStyle} value={newMatch.awayTeam} onChange={e => setNewMatch({...newMatch, awayTeam: e.target.value})} /></div>
                  <div style={fieldGroup}><label style={labelStyle}>Score</label><input style={inputStyle} placeholder="e.g. 2-1" value={newMatch.score} onChange={e => setNewMatch({...newMatch, score: e.target.value})} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
                  <div style={fieldGroup}><label style={labelStyle}>Date</label><input style={inputStyle} placeholder="DD/MM/YYYY" value={newMatch.date} onChange={e => setNewMatch({...newMatch, date: formatBirthdayInput(e.target.value)})} /></div>
                  <div style={fieldGroup}><label style={labelStyle}>Status</label><select style={inputStyle} value={newMatch.status} onChange={e => setNewMatch({...newMatch, status: e.target.value})}><option value="finished">Finished</option><option value="upcoming">Upcoming</option></select></div>
                  <div style={fieldGroup}><label style={labelStyle}>Outcome</label><select style={inputStyle} value={newMatch.outcome} onChange={e => setNewMatch({...newMatch, outcome: e.target.value})}><option value="win">Win</option><option value="draw">Draw</option><option value="loss">Loss</option></select></div>
                  <div style={fieldGroup}><label style={labelStyle}>My Rating</label><select style={inputStyle} value={newMatch.rating} onChange={e => setNewMatch({...newMatch, rating: e.target.value})}>{[1,2,3,4,5,6,7,8,9,10].map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' }}>
                  <div style={fieldGroup}><label style={labelStyle}>Goals</label><input style={inputStyle} type="number" value={newMatch.myGoals} onChange={e => setNewMatch({...newMatch, myGoals: e.target.value})} /></div>
                  <div style={fieldGroup}><label style={labelStyle}>Assists</label><input style={inputStyle} type="number" value={newMatch.myAssists} onChange={e => setNewMatch({...newMatch, myAssists: e.target.value})} /></div>
                  <div style={fieldGroup}><label style={labelStyle}>Yellow</label><input style={inputStyle} type="number" value={newMatch.yellowCards} onChange={e => setNewMatch({...newMatch, yellowCards: e.target.value})} /></div>
                  <div style={fieldGroup}><label style={labelStyle}>Red</label><input style={inputStyle} type="number" value={newMatch.redCards} onChange={e => setNewMatch({...newMatch, redCards: e.target.value})} /></div>
                  <div style={fieldGroup}><label style={labelStyle}>Minutes</label><input style={inputStyle} type="number" value={newMatch.minutesPlayed} onChange={e => setNewMatch({...newMatch, minutesPlayed: e.target.value})} /></div>
                </div>
                <button onClick={handleSaveMatch} style={{ ...primaryBtn, backgroundColor: '#3A86FF', color: 'white' }}>SAVE TO CLOUD</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {['all', 'finished', 'upcoming', 'win', 'draw', 'loss'].map(f => (
                <button key={f} onClick={() => setMatchFilter(f)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #252830', backgroundColor: matchFilter === f ? '#3A86FF' : '#15171C', color: 'white', cursor: 'pointer' }}>{f.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredMatches.map(m => (
                <div key={m.id} style={{ ...cardStyle, padding: '20px', gridTemplateColumns: '1fr 1fr 150px' }}>
                  <div><p style={{ ...labelStyle, color: m.outcome === 'win' ? '#4CAF50' : m.outcome === 'loss' ? '#F44336' : '#888' }}>{m.outcome?.toUpperCase()} • {m.matchType?.toUpperCase()}</p><h3>{m.homeTeam} vs {m.awayTeam}</h3><p style={{fontSize:'12px', color:'#555'}}>{m.date}</p></div>
                  <div style={{ textAlign: 'center' }}><h2>{m.score}</h2><p style={{fontSize:'11px', color:'#555'}}>{m.minutesPlayed}' Played</p></div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '10px' }}><div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}><button onClick={() => startEditMatch(m)} style={{background:'none', border:'none', color:'#3A86FF', fontSize:'11px', cursor:'pointer', fontWeight:'bold'}}>Edit</button><button onClick={() => deleteMatch(m.id)} style={{background:'none', border:'none', color:'#444', fontSize:'11px', cursor:'pointer'}}>Delete</button></div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATISTICS SECTION */}
        {activeTab === 'stats' && (
          <div style={{ maxWidth: '1000px' }}>
             <h4 style={{ color: '#3A86FF', fontSize: '12px' }}>PERFORMANCE</h4><h1>Career Statistics</h1>
             <div style={{...cardStyle, gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px', padding: '20px'}}>
                <div style={fieldGroup}><label style={labelStyle}>Season</label><select style={inputStyle} value={statsFilters.season} onChange={e => setStatsFilters({...statsFilters, season: e.target.value})}><option value="all">All Seasons</option>{seasons.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div style={fieldGroup}><label style={labelStyle}>Club</label><select style={inputStyle} value={statsFilters.club} onChange={e => setStatsFilters({...statsFilters, club: e.target.value})}><option value="all">All Clubs</option>{uniqueClubs.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div style={fieldGroup}><label style={labelStyle}>Last X Matches</label><input type="number" style={inputStyle} value={statsFilters.lastMatches} onChange={e => setStatsFilters({...statsFilters, lastMatches: e.target.value})} /></div>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div style={cardStyle}><label style={labelStyle}>Matches</label><h2 style={{margin:0}}>{stats.played}</h2></div>
                <div style={cardStyle}><label style={labelStyle}>Goals</label><h2 style={{margin:0}}>{stats.goals}</h2></div>
                <div style={cardStyle}><label style={labelStyle}>Assists</label><h2 style={{margin:0}}>{stats.assists}</h2></div>
                <div style={cardStyle}><label style={labelStyle}>Rating Avg</label><h2 style={{margin:0, color:'#3A86FF'}}>{avgRating}</h2></div>
             </div>
          </div>
        )}

        {/* ACCOUNT TAB */}
        {activeTab === 'account' && (
          <div style={{ maxWidth: '600px' }}>
            <h4 style={{ color: '#3A86FF', fontSize: '12px' }}>SETTINGS</h4>
            <h1>My Account</h1>
            <div style={{ ...cardStyle, marginTop: '20px', gap: '25px' }}>
                <div style={fieldGroup}><label style={labelStyle}>Logged in as</label><p style={{fontSize:'18px', margin:0}}>{user.email}</p></div>
                <div style={{padding:'15px', background:'rgba(76, 175, 80, 0.1)', borderRadius:'10px', border:'1px solid rgba(76,175,80,0.2)'}}>
                    <p style={{color:'#4CAF50', margin:0, fontSize:'14px', display:'flex', alignItems:'center', gap:'10px'}}>
                        <span>●</span> Cloud Synchronization Active
                    </p>
                    <p style={{fontSize:'12px', color:'#888', marginTop:'5px'}}>Svi tvoji podaci su bezbjedno spremljeni na Firebase server.</p>
                </div>
                <button onClick={() => signOut(auth)} style={{ ...primaryBtn, backgroundColor: '#F44336', color: 'white', border: 'none', marginTop:'15px' }}>LOGOUT FROM ACCOUNT</button>
            </div>
          </div>
        )}

        {/* PLACEHOLDERS ZA TVOJE OSTALE Tremove */}
        {(activeTab === 'goals' || activeTab === 'training' || activeTab === 'injuries' || activeTab === 'seasons' || activeTab === 'analyses' || activeTab === 'awards' || activeTab === 'transfers' || activeTab === 'sponsors' || activeTab === 'gallery' || activeTab === 'friends' || activeTab === 'settings' || activeTab === 'support') && (
            <div style={{ maxWidth: '1000px', textAlign: 'center', marginTop: '100px' }}>
                <h1 style={{textTransform: 'uppercase'}}>{activeTab.replace('_', ' ')}</h1>
                <p style={{color: '#555'}}>Ova sekcija stiže uskoro. U međuvremenu koristi Dashboard, Profile i Matches.</p>
            </div>
        )}

      </div>
    </div>
  )
}

function MenuBtn({ label, active, onClick, icon }) { 
  return ( 
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', padding: '12px 20px', backgroundColor: active ? 'rgba(58, 134, 255, 0.08)' : 'transparent', color: active ? '#3A86FF' : '#888', border: 'none', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '14px', transition: '0.2s' }}> 
      <span style={{ fontSize: '18px', width: '24px' }}>{icon}</span> {label} 
    </button> 
  );
}

function ProfileField({ label, value, edit, onChange }) { 
  return ( 
    <div style={fieldGroup}>
      <label style={labelStyle}>{label}</label>
      {edit ? <input style={inputStyle} value={value} onChange={e => onChange(e.target.value)} /> : <p style={valueStyle}>{value || "—"}</p>}
    </div> 
  );
}

const cardStyle = { backgroundColor: '#15171C', padding: '40px', borderRadius: '20px', border: '1px solid #252830', display: 'grid' };
const fieldGroup = { display: 'flex', flexDirection: 'column', gap: '8px' };
const labelStyle = { color: '#50535E', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' };
const valueStyle = { fontSize: '16px', color: '#FFFFFF', margin: 0 };
const inputStyle = { padding: '12px 16px', borderRadius: '10px', border: '1px solid #252830', backgroundColor: '#1C1F26', color: 'white', outline: 'none', fontSize: '14px', width: '100%', boxSizing: 'border-box' };
const primaryBtn = { backgroundColor: 'transparent', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: 'white' };

export default App;
