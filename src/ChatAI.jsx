import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

function ChatAI() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_key') || '');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [listening, setListening] = useState(false);
  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceLoopRef = useRef(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [voices, setVoices] = useState([]);

  // Load chat history dari Firestore saat user login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid, 'chatHistory', 'history');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setMessages(snap.data().messages || []);
        }
      }
    });
    return () => unsub();
  }, []);

  // Simpan chat history ke Firestore setiap kali messages berubah
  useEffect(() => {
    const saveHistory = async () => {
      if (user) {
        const docRef = doc(db, 'users', user.uid, 'chatHistory', 'history');
        await setDoc(docRef, { messages });
      }
    };
    if (user && messages.length > 0) saveHistory();
  }, [messages, user]);

  // Auto scroll ke bawah setiap ada pesan baru
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Ambil daftar voice saat komponen mount
  useEffect(() => {
    const updateVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
      // Hanya set default voice jika selectedVoice masih null
      if (selectedVoice === null && vs.length > 0) {
        const v =
          vs.find(v => v.lang.startsWith('id') && v.name.toLowerCase().includes('female')) ||
          vs.find(v => v.lang.startsWith('id') && v.name.toLowerCase().includes('perempuan')) ||
          vs.find(v => v.lang.startsWith('id') && v.gender === 'female') ||
          vs.find(v => v.lang.startsWith('id')) ||
          vs.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
          vs.find(v => v.lang.startsWith('en') && v.gender === 'female') ||
          vs.find(v => v.lang.startsWith('en')) ||
          vs[0];
        setSelectedVoice(v?.name || vs[0].name);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [selectedVoice]);

  // Text-to-Speech untuk balasan AI (pakai voice yang dipilih)
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant' && voiceLoopRef.current) {
      const utter = new window.SpeechSynthesisUtterance(lastMsg.content);
      utter.lang = 'id-ID';
      const vs = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      utter.voice = vs.find(v => v.name === selectedVoice) || vs[0];
      utter.onend = () => {
        if (voiceLoopRef.current) startListening();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  }, [messages, voices, selectedVoice]);

  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
    localStorage.setItem('openai_key', e.target.value);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !apiKey.trim()) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setLoading(true);
    try {
      // Kirim seluruh history chat ke Gemini
      const geminiMessages = newMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: geminiMessages
          })
        }
      );
      const data = await res.json();
      const aiMsg = data.candidates?.[0]?.content?.parts?.[0]?.text || 'AI tidak bisa membalas.';
      setMessages([...newMessages, { role: 'assistant', content: aiMsg }]);
      setInput('');
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Gagal menghubungi AI.' }]);
    }
    setLoading(false);
  };

  // Voice chat: SpeechRecognition
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Browser kamu belum support voice input!');
      return;
    }
    setListening(true);
    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.lang = 'id-ID';
    recognitionRef.current.interimResults = false;
    recognitionRef.current.maxAlternatives = 1;
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput('');
      setListening(false);
      sendVoiceMessage(transcript);
    };
    recognitionRef.current.onend = () => {
      setListening(false);
    };
    recognitionRef.current.start();
  };

  const stopListening = () => {
    setListening(false);
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  // Loop voice chat
  const startVoiceChat = () => {
    voiceLoopRef.current = true;
    startListening();
  };
  const stopVoiceChat = () => {
    voiceLoopRef.current = false;
    stopListening();
    window.speechSynthesis.cancel();
  };

  // Kirim pesan dari suara
  const sendVoiceMessage = async (text) => {
    if (!text.trim() || !apiKey.trim()) return;
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const geminiMessages = newMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: geminiMessages
          })
        }
      );
      const data = await res.json();
      const aiMsg = data.candidates?.[0]?.content?.parts?.[0]?.text || 'AI tidak bisa membalas.';
      setMessages([...newMessages, { role: 'assistant', content: aiMsg }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Gagal menghubungi AI.' }]);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        maxWidth: 700,
        width: '100%',
        margin: '0 auto 32px auto',
        padding: '24px 16px 16px 16px',
        border: '1px solid #eee',
        borderRadius: 8,
        background: '#fafbfc',
        boxSizing: 'border-box',
        boxShadow: '0 2px 12px 0 rgba(0,0,0,0.06)',
      }}
    >
      <style>{`
        @media (max-width: 600px) {
          .chatai-container { padding: 8px !important; }
          .chatai-input, .chatai-btn { width: 100% !important; box-sizing: border-box; }
          .chatai-main { margin-top: 32px !important; }
        }
      `}</style>
      <div className="chatai-main">
        <div className="chatai-container" style={{ marginBottom: 8 }}>
          <b>Chat AI (Motivasi & Saran Disiplin)</b>
        </div>
        {/* Dropdown pilih voice */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontWeight: 500, marginRight: 8 }}>Pilih Suara AI:</label>
          <select
            value={selectedVoice || ''}
            onChange={e => setSelectedVoice(e.target.value)}
            style={{ padding: 6, borderRadius: 4, border: '1px solid #bbb', minWidth: 180 }}
          >
            {voices.map((v, i) => (
              <option key={v.name + i} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>
        <input
          className="chatai-input"
          type="password"
          placeholder="Masukkan Gemini API Key..."
          value={apiKey}
          onChange={handleApiKeyChange}
          style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 4, border: '1px solid #bbb' }}
        />
        <div
          ref={chatContainerRef}
          style={{ maxHeight: 180, overflowY: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: 8, marginBottom: 8 }}
        >
          {messages.length === 0 && <div style={{ color: '#888' }}>Belum ada chat. Tanyakan apapun ke AI!</div>}
          {messages.map((msg, i) => (
            <div key={i} style={{ margin: '6px 0', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              <span style={{ background: msg.role === 'user' ? '#e3f2fd' : '#e8f5e9', padding: '6px 12px', borderRadius: 8, display: 'inline-block', wordBreak: 'break-word', maxWidth: '100%' }}>{msg.content}</span>
            </div>
          ))}
        </div>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="chatai-input"
            type="text"
            placeholder="Tulis pesan ke AI..."
            value={input}
            onChange={e => setInput(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: 8, borderRadius: 4, border: '1px solid #bbb' }}
            disabled={loading}
          />
          <button
            className="chatai-btn"
            type="submit"
            style={{ padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, minWidth: 80 }}
            disabled={loading}
          >
            {loading ? 'Mengirim...' : 'Kirim'}
          </button>
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            style={{ padding: '8px', background: listening ? '#ff9800' : '#eee', color: '#222', border: 'none', borderRadius: 4 }}
            disabled={loading}
            title={listening ? 'Sedang mendengarkan...' : 'Bicara'}
          >
            🎤
          </button>
        </form>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={startVoiceChat}
            style={{ padding: '8px 16px', background: '#43a047', color: '#fff', border: 'none', borderRadius: 4 }}
            disabled={voiceLoopRef.current || loading}
          >
            Mulai Ngobrol
          </button>
          <button
            type="button"
            onClick={stopVoiceChat}
            style={{ padding: '8px 16px', background: '#e53935', color: '#fff', border: 'none', borderRadius: 4 }}
            disabled={!voiceLoopRef.current}
          >
            Stop Ngobrol
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatAI; 
