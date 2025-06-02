import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import ChatAI from './ChatAI';

function Dashboard() {
  const [rows, setRows] = useState([{ task: '', status: '', hari: '', tanggal: '' }]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10); // YYYY-MM-DD
  });
  const [aiKey, setAiKey] = useState(() => localStorage.getItem('openai_key') || '');
  const [aiLoading, setAiLoading] = useState(false);

  // Helper untuk dapatkan hari dari tanggal
  const getHari = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { weekday: 'long' });
  };

  // Ambil user yang sedang login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else setUser(null);
    });
    return () => unsub();
  }, []);

  // Hapus data lebih dari 7 hari
  useEffect(() => {
    if (!user) return;
    const cleanOldData = async () => {
      const colRef = collection(db, 'users', user.uid, 'tasks');
      const snap = await getDocs(colRef);
      const today = new Date();
      await Promise.all(snap.docs.map(async (d) => {
        const tgl = d.id; // id = YYYY-MM-DD
        const diff = (today - new Date(tgl)) / (1000 * 60 * 60 * 24);
        if (diff > 7) await deleteDoc(doc(colRef, tgl));
      }));
    };
    cleanOldData();
  }, [user]);

  // Fungsi generate challenge AI otomatis
  const generateChallengeAI = async (tanggal) => {
    if (!aiKey) {
      alert('Masukkan Gemini API Key di chat AI dulu!');
      return;
    }
    setAiLoading(true);
    try {
      const prompt = `Buatkan 5 challenge harian bertema disiplin dan pengembangan diri untuk tanggal ${tanggal}, singkat, actionable, dan berbeda dari hari lain. Format: satu challenge per baris, tanpa penomoran.`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${aiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: prompt }] }
            ]
          })
        }
      );
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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

  // Load data dari Firestore untuk tanggal yang dipilih
  useEffect(() => {
    if (!user || !selectedDate) return;
    setLoading(true);
    const fetchData = async () => {
      const docRef = doc(db, 'users', user.uid, 'tasks', selectedDate);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const loadedRows = (snap.data().rows || []).filter(row => row.task || row.status);
        setRows(loadedRows.length > 0 ? loadedRows : [{ task: '', status: '', hari: getHari(selectedDate), tanggal: selectedDate }]);
      } else {
        setRows([{ task: '', status: '', hari: getHari(selectedDate), tanggal: selectedDate }]);
      }
      setLoading(false);
    };
    fetchData();
    // eslint-disable-next-line
  }, [user, selectedDate]);

  // Simpan data ke Firestore setiap kali rows berubah
  useEffect(() => {
    if (!user || !selectedDate || loading) return;
    // Cegah simpan data jika rows bukan untuk tanggal aktif
    if (rows.length > 0 && rows[0].tanggal !== selectedDate) return;
    const saveData = async () => {
      const docRef = doc(db, 'users', user.uid, 'tasks', selectedDate);
      await setDoc(docRef, { rows });
    };
    saveData();
    // eslint-disable-next-line
  }, [rows, user, selectedDate, loading]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAiKey(localStorage.getItem('openai_key') || '');
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handler input baris
  const handleChange = (idx, field, value) => {
    const newRows = [...rows];
    newRows[idx][field] = value;
    // Pastikan tanggal baris selalu sama dengan selectedDate
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

  // Tombol manual tetap ada, panggil generateChallengeAI(selectedDate)
  const handleGenerateAI = () => generateChallengeAI(selectedDate);

  if (!user) return <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',display:'flex',justifyContent:'center',alignItems:'center',fontSize:32,fontWeight:600,color:'#234',zIndex:999}}>Loading...</div>;
  if (loading) return <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',display:'flex',justifyContent:'center',alignItems:'center',fontSize:32,fontWeight:600,color:'#234',zIndex:999}}>Memuat data...</div>;

  return (
    <>
      <ChatAI />
      <div style={{ width: '100vw', minHeight: '100vh', padding: '56px 2vw 32px 2vw', boxSizing: 'border-box', background: '#fafbfc', overflowX: 'hidden' }}>
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
