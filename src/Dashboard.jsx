// src/Dashboard.jsx (PUSAT KONTROL STATE DAN LOGIKA AI)

import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import ChatAI from './ChatAI';

// Definisikan Persona Anda di sini (System Instruction)
const SYSTEM_INSTRUCTION_CHAT = "Anda adalah Yusuf. Anda adalah asisten pribadi yang disiplin. Balas dengan sopan, berikan motivasi dan kritik yang jujur dan realistis berdasarkan tujuan hidup pengguna: OJT Beckhoff/KNX, SNBT Teknik Elektro UGM, dan Keuangan Stabil (Cicilan Motor). Panggil pengguna dengan sebutan 'Bos' atau 'Atasan'.";

// Instruksi Challenge Generator (Sekarang lebih spesifik!)
const SYSTEM_INSTRUCTION_CHALLENGE = "Anda adalah AI pembuat challenge disiplin yang tahu semua tentang Yusuf (pengguna). Buatkan 5 challenge harian SPESIFIK yang membantu Yusuf mencapai tujuannya. Fokus hari ini: OJT di PT Inovasindo Smart System (pelajari PLC Beckhoff/KNX), SNBT (Teknik Elektro UGM), dan Bahasa Jepang (Duolingo). Jangan pernah memberikan saran di luar 5 baris challenge.";

// Fungsi untuk mapping role (dari assistant ke model)
const mapMessagesForGemini = (messages) => {
    return messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user', 
        parts: [{ text: msg.content }]
    }));
};

function Dashboard() {
  const [rows, setRows] = useState([{ task: '', status: '', hari: '', tanggal: '' }]);
  const [messages, setMessages] = useState([]); // STATE CHAT HISTORY BARU DI SINI
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10); // YYYY-MM-DD
  });
  const [aiLoading, setAiLoading] = useState(false);
  
  // Logic Voice Chat di pindahkan
  const recognitionRef = useRef(null);
  const voiceLoopRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [voices, setVoices] = useState([]);

  // Helper untuk dapatkan hari dari tanggal
  const getHari = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { weekday: 'long' });
  };

  // 1. Load Chat History & Task History
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        // Load Chat History
        const docRefChat = doc(db, 'users', u.uid, 'chatHistory', 'history');
        const snapChat = await getDoc(docRefChat);
        if (snapChat.exists()) setMessages(snapChat.data().messages || []);
        else setMessages([]);
        
        // Load Task History for selectedDate (Task loading logic tetap sama)
        const docRefTask = doc(db, 'users', u.uid, 'tasks', selectedDate);
        const snapTask = await getDoc(docRefTask);
        if (snapTask.exists()) {
            const loadedRows = (snapTask.data().rows || []).filter(row => row.task || row.status);
            setRows(loadedRows.length > 0 ? loadedRows : [{ task: '', status: '', hari: getHari(selectedDate), tanggal: selectedDate }]);
        } else {
            setRows([{ task: '', status: '', hari: getHari(selectedDate), tanggal: selectedDate }]);
        }
        setLoading(false);
        
      } else {
        // User LOGOUT: Kosongkan semua state
        setMessages([]);
        setRows([{ task: '', status: '', hari: getHari(selectedDate), tanggal: selectedDate }]);
        setLoading(true);
      }
    });
    return () => unsub();
  }, [selectedDate]);

  // Simpan chat history ke Firestore setiap kali messages berubah
  useEffect(() => {
    const saveHistory = async () => {
      if (user && messages.length > 0) {
        const docRef = doc(db, 'users', user.uid, 'chatHistory', 'history');
        await setDoc(docRef, { messages });
      }
    };
    if (user && messages.length > 0) saveHistory();
  }, [messages, user]);
  
  // Logic Speech Recognition dan TTS (ditempatkan di sini)
  useEffect(() => {
    const updateVoices = () => {
        const vs = window.speechSynthesis.getVoices();
        setVoices(vs);
        if (selectedVoice === null && vs.length > 0) {
            const v = vs.find(v => v.lang.startsWith('id')) || vs[0];
            setSelectedVoice(v?.name || vs[0].name);
        }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [selectedVoice]);

  // Text-to-Speech untuk balasan AI
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant' && voiceLoopRef.current) {
        const utter = new window.SpeechSynthesisUtterance(lastMsg.content);
        utter.lang = 'id-ID';
        const vs = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        utter.voice = vs.find(v => v.name === selectedVoice) || vs[0];
        utter.onend = () => { if (voiceLoopRef.current) startListening(); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
    }
  }, [messages, voices, selectedVoice]);


  // FUNGSI UTAMA PENGIRIMAN PESAN CHAT (sudah aman)
  const handleSend = async (e) => {
    e.preventDefault();
    if (!e.target.input.value.trim()) return; 

    const inputVal = e.target.input.value;
    const newMessages = [...messages, { role: 'user', content: inputVal }];
    setMessages(newMessages);
    setAiLoading(true);
    
    try {
      // Kirim history chat dan System Instruction ke Serverless Function
      const geminiMessages = mapMessagesForGemini(newMessages);
      
      const res = await fetch('/api/gemini', 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: geminiMessages,
            systemInstruction: SYSTEM_INSTRUCTION_CHAT, 
          })
        }
      );
      
      const data = await res.json();
      
      const aiMsg = data.text || `Gagal menghubungi AI. Pesan error server: ${data.error}`;
      setMessages([...newMessages, { role: 'assistant', content: aiMsg }]);
      e.target.input.value = ''; // Clear input field
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Gagal menghubungi Serverless Function.' }]);
    }
    setAiLoading(false);
  };
  
  // Voice Chat Logic (disertakan di sini)
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) { alert('Browser kamu belum support voice input!'); return; }
    setListening(true);
    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.lang = 'id-ID';
    recognitionRef.current.interimResults = false;
    recognitionRef.current.maxAlternatives = 1;
    recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setListening(false);
        sendVoiceMessage(transcript);
    };
    recognitionRef.current.onend = () => { setListening(false); };
    recognitionRef.current.start();
  };
  const stopListening = () => { setListening(false); if (recognitionRef.current) recognitionRef.current.stop(); };
  const startVoiceChat = () => { voiceLoopRef.current = true; startListening(); };
  const stopVoiceChat = () => { voiceLoopRef.current = false; stopListening(); window.speechSynthesis.cancel(); };

  const sendVoiceMessage = async (text) => {
    if (!text.trim()) return; 
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setAiLoading(true);
    
    try {
      const geminiMessages = mapMessagesForGemini(newMessages);
      
      const res = await fetch('/api/gemini', 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: geminiMessages, systemInstruction: SYSTEM_INSTRUCTION_CHAT })
        }
      );
      const data = await res.json();
      const aiMsg = data.text || `Gagal menghubungi AI. Pesan error server: ${data.error}`;
      setMessages([...newMessages, { role: 'assistant', content: aiMsg }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Gagal menghubungi Serverless Function.' }]);
    }
    setAiLoading(false);
  };


  // Fungsi generate challenge AI otomatis (SEKARANG MENGIRIM FULL HISTORY)
  const generateChallengeAI = async (tanggal) => {
    setAiLoading(true);
    
    // Konversi chat history menjadi string prompt untuk memberi konteks pada AI
    const historyContext = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const challengePrompt = `Berdasarkan riwayat obrolan di bawah ini (yang berisi tujuan, kesulitan, dan rencana pengguna), buatkan 5 challenge harian SPESIFIK untuk tanggal ${tanggal}. Format: satu challenge per baris, tanpa penomoran. \n\nRIWAYAT OBROLAN:\n${historyContext}`;
    
    try {
      const res = await fetch(
        '/api/gemini', // Panggil Serverless Function
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // HANYA MENGIRIM 1 PROMPT UNTUK GENERASI CHALLENGE
            contents: [
              { role: "user", parts: [{ text: challengePrompt }] } 
            ],
            systemInstruction: SYSTEM_INSTRUCTION_CHALLENGE, // Mengirim System Instruction Generator
          })
        }
      );
      
      const data = await res.json();
      const text = data.text || 'Gagal menghasilkan challenge dari AI.';
      
      const challenges = text
        .split('\n')
        .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 5);
      setRows(challenges.map(ch => ({ task: ch, status: '', hari: getHari(tanggal), tanggal })));
    } catch (err) {
      alert('Gagal generate challenge dari AI.');
    }
    setAiLoading(false);
  };

  // Simpan data ke Firestore setiap kali rows berubah (Task loading logic tetap sama)
  useEffect(() => {
    if (!user || !selectedDate || loading) return;
    // Cegah simpan data jika rows bukan untuk tanggal aktif
    if (rows.length > 0 && rows[0].tanggal !== selectedDate) return;
    const saveData = async () => {
      const docRef = doc(db, 'users', user.uid, 'tasks', selectedDate);
      await setDoc(docRef, { rows });
    };
    saveData();
  }, [rows, user, selectedDate, loading]);

  // Handler input baris
  const handleChange = (idx, field, value) => {
    const newRows = [...rows];
    newRows[idx][field] = value;
    newRows[idx].tanggal = selectedDate;
    newRows[idx].hari = getHari(selectedDate);
    setRows(newRows);
  };

  // Handler tambah baris
  const addRow = () => {
    setRows([
      ...rows,
      { task: '', status: '', hari: getHari(selectedDate), tanggal: selectedDate }
    ]);
  };

  // Handler hapus baris
  const removeRow = (idx) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleLogout = async () => {
    await signOut(auth); 
    window.location.href = '/';
  };

  const handleDownload = () => {
    let content = 'Hari\tTanggal\tTask/Challenge\tStatus\n';
    rows.forEach(row => {
      content += `${row.hari || '-'}\t${row.tanggal || '-'}\t${row.task || '-'}\t${row.status || '-'}\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fokus-lebih-baik-${selectedDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateAI = () => generateChallengeAI(selectedDate);

  // Jika user belum login atau data belum dimuat, tampilkan loading/redirect
  if (!user) return <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',display:'flex',justifyContent:'center',alignItems:'center',fontSize:32,fontWeight:600,color:'#234',zIndex:999}}>Loading...</div>;
  if (loading) return <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',display:'flex',justifyContent:'center',alignItems:'center',fontSize:32,fontWeight:600,color:'#234',zIndex:999}}>Memuat data...</div>;

  return (
    <>
      <ChatAI 
        messages={messages}
        handleSend={handleSend}
        loading={aiLoading}
        input={messages.length > 0 ? '' : ''} // Set input to null since handled by handleSend
        setInput={() => {}} // Dummy input setter
        voices={voices}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        startListening={startListening}
        stopListening={stopListening}
        startVoiceChat={startVoiceChat}
        stopVoiceChat={stopVoiceChat}
        listening={listening}
        voiceLoopRef={voiceLoopRef}
      />
      
      <div style={{ width: '100vw', minHeight: '100vh', padding: '32px 2vw 32px 2vw', boxSizing: 'border-box', background: '#fafbfc', overflowX: 'hidden' }}>
        <style>{`
          @media (max-width: 700px) {
            .dashboard-container { padding: 8px !important; }
            .dashboard-table { display: block; width: 100%; overflow-x: auto; }
            .dashboard-table table { min-width: 600px; }
            .dashboard-btn, .dashboard-input { width: 100% !important; margin-bottom: 8px; box-sizing: border-box; }
          }
        `}</style>
        <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ textAlign: 'center', flex: 1, minWidth: 180 }}>Fokus Lebih Baik</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{marginRight:0, padding:6, borderRadius:4, border:'1px solid #bbb', minWidth:120}} className="dashboard-input" />
            <button onClick={handleGenerateAI} style={{ background:'#43a047', color:'#fff', border:'none', borderRadius:4, padding:'8px 16px', cursor:'pointer', marginRight:0, minWidth:120 }} disabled={aiLoading} className="dashboard-btn">
              {aiLoading ? 'Mengisi...' : 'Generate Challenge AI'}
            </button>
            <button onClick={handleDownload} style={{ background:'#1976d2', color:'#fff', border:'none', borderRadius:4, padding:'8px 16px', cursor:'pointer', marginRight:0, minWidth:100 }} className="dashboard-btn">Simpan</button>
            <button onClick={handleLogout} style={{ background:'#eee', color:'#1976d2', border:'none', borderRadius:4, padding:'8px 16px', cursor:'pointer', minWidth:80 }} className="dashboard-btn">Logout</button>
          </div>
        </div>
        <div className="dashboard-table" style={{ width: '100%', overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Hari</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Tanggal</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Task/Challenge</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Status</th>
                <th style={{ padding: 8, border: '1px solid #eee' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>
                    {row.hari || '-'}
                  </td>
                  <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>
                    {row.tanggal || '-'}
                  </td>
                  <td style={{ padding: 8, border: '1px solid #eee' }}>
                    <input
                      type="text"
                      value={row.task}
                      onChange={e => handleChange(idx, 'task', e.target.value)}
                      style={{ width: '100%' }}
                      placeholder="Tulis tugas/challenge..."
                      className="dashboard-input"
                    />
                  </td>
                  <td style={{ padding: 8, border: '1px solid #eee' }}>
                    <input
                      type="text"
                      value={row.status}
                      onChange={e => handleChange(idx, 'status', e.target.value)}
                      style={{ width: '100%' }}
                      placeholder="Status (misal: selesai, proses)"
                      className="dashboard-input"
                    />
                  </td>
                  <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>
                    <button onClick={() => removeRow(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addRow} style={{ padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', width: '100%', maxWidth: 200 }}>
          + Tambah Baris
        </button>
      </div>
      {/* Footer Kredit */}
      <footer style={{ textAlign: 'center', marginTop: 32, fontSize: 14, color: '#555' }}>
        Dibuat oleh <b>Yusuf Ubaidilah Musta'in</b> |
        <a href="mailto:yusuubaidilahmustain@gmail.com" target="_blank" rel="noopener noreferrer"> Email</a> |
        <a href="https://www.linkedin.com/in/yusufum/" target="_blank" rel="noopener noreferrer"> LinkedIn</a> |
        <a href="https://www.instagram.com/saya_humoris/" target="_blank" rel="noopener noreferrer"> Instagram</a>
      </footer>
    </>
  );
}

export default Dashboard;
