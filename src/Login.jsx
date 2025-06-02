import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { useNavigate } from 'react-router-dom';
import './login-responsive.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 style={{ textAlign: 'center' }}>{isRegister ? 'Daftar' : 'Login'}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="login-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="login-input"
          />
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
          <button type="submit" className="login-btn">
            {isRegister ? 'Daftar' : 'Login'}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          {isRegister ? (
            <span>Sudah punya akun? <button onClick={() => setIsRegister(false)} style={{ color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer' }}>Login</button></span>
          ) : (
            <span>Belum punya akun? <button onClick={() => setIsRegister(true)} style={{ color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer' }}>Daftar</button></span>
          )}
        </div>
      </div>
      <div style={{ marginTop: 32, textAlign: 'center', fontSize: 14 }}>
        Dibuat oleh <b>Yusuf Ubaidilah Musta'in</b> <br />
        <a href="mailto:yusuubaidilahmustain@gmail.com" target="_blank" rel="noopener noreferrer">Email</a> |{' '}
        <a href="https://www.linkedin.com/in/yusufum/" target="_blank" rel="noopener noreferrer">LinkedIn</a> |{' '}
        <a href="https://www.instagram.com/saya_humoris/" target="_blank" rel="noopener noreferrer">Instagram</a>
      </div>
    </div>
  );
}

export default Login; 
