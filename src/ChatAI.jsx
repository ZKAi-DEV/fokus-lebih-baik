// src/ChatAI.jsx (HANYA MENERIMA PROPS DAN MENGIRIM DARI PROPS)

import React, { useState, useEffect, useRef } from 'react';
// Hapus import db, auth, doc, getDoc, setDoc, onAuthStateChanged (sudah pindah ke Dashboard)

// Komponen ChatAI sekarang menerima semua data dan fungsi sebagai props
function ChatAI({ 
  messages, 
  handleSend, 
  loading, 
  input, 
  setInput, 
  voices, 
  selectedVoice, 
  setSelectedVoice,
  startListening,
  stopListening,
  startVoiceChat,
  stopVoiceChat,
  listening,
  voiceLoopRef
}) {
  const chatContainerRef = useRef(null);

  // Auto scroll ke bawah setiap ada pesan baru (tetap di sini)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Logika Speech Synthesis & Voice Command (dikurangi, disederhanakan)
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
  }, [messages, voices, selectedVoice, startListening]);
  
  // HAPUS SEMUA LOGIKA API KEY, FIREBASE, DAN FUNGSI UTAMA DI SINI

  return (
    <div
      style={{
        maxWidth: 700,
        width: '100%',
        margin: '700px auto 32px auto',
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
        {/* INPUT API KEY SUDAH DIHAPUS DARI SINI */}
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
