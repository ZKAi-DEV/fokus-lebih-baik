// file: /api/gemini.js
// Catatan: Anda perlu menginstall GoogleGenAI SDK (npm install @google/genai)
import { GoogleGenAI } from '@google/genai';

// Kunci API diambil secara aman dari Vercel/Environment Variable
const apiKey = process.env.GEMINI_API_KEY;

// Pastikan kode ini berjalan di Serverless Function
export default async function handler(req, res) {
  // Hanya izinkan metode POST dari frontend
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cek apakah Environment Variable sudah diset di Vercel/Server
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API Key tidak terkonfigurasi di server. Silakan cek Environment Variable GEMINI_API_KEY." });
  }
  
  const ai = new GoogleGenAI({ apiKey });
  // Menerima History Chat dan System Instruction dari frontend (ChatAI.jsx)
  const { contents, systemInstruction } = req.body;
  
  try {
    // Panggilan API yang aman dan menyertakan System Instruction
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Model yang cepat dan efisien
      contents: contents, // Menerima seluruh history chat dari frontend
      config: {
          systemInstruction: systemInstruction, // Menerapkan Persona Anda
      }
    });

    const aiMsg = response.text || 'AI tidak bisa membalas.';
    // Mengirim hanya teks respons, bukan API Key
    res.status(200).json({ text: aiMsg });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: 'Gagal menghubungi AI.' });
  }
}