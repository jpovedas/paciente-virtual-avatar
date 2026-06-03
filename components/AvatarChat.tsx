'use client';

import { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  audio?: string;
  videoUrl?: string;
}

interface AvatarChatProps {
  caseData: {
    id: string;
    title: string;
    caseContext: string;
    avatarGender: 'male' | 'female';
  };
  userId: string;
}

export default function AvatarChat({ caseData, userId }: AvatarChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    createSession();
  }, []);

  const createSession = async () => {
    const sessionRef = await addDoc(collection(db, 'sessions'), {
      userId,
      caseId: caseData.id,
      messages: [],
      startTime: serverTimestamp(),
      status: 'active',
    });
    setSessionId(sessionRef.id);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error al acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      // 1. Transcribir audio
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const { transcript } = await transcribeResponse.json();

      if (!transcript || transcript.trim() === '') {
        alert('No se detectó audio. Intenta de nuevo.');
        setIsProcessing(false);
        return;
      }

      const userMessage: Message = {
        role: 'user',
        content: transcript,
      };

      setMessages(prev => [...prev, userMessage]);

      // 2. Obtener respuesta de Claude + Audio
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          caseContext: caseData.caseContext,
        }),
      });

      const { message, audio } = await chatResponse.json();

      // 3. Generar video con D-ID
      const avatarResponse = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
        }),
      });

      const { videoUrl } = await avatarResponse.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: message,
        audio,
        videoUrl,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentVideoUrl(videoUrl);

      // Reproducir video
      if (videoRef.current) {
        videoRef.current.src = videoUrl;
        videoRef.current.play();
      }

      // Guardar en Firestore
      if (sessionId) {
        await updateDoc(doc(db, 'sessions', sessionId), {
          messages: [...messages, userMessage, assistantMessage],
        });
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar la solicitud');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 shadow-lg">
        <h2 className="text-2xl font-bold">{caseData.title}</h2>
        <p className="text-sm opacity-90">Consulta Virtual con Paciente IA</p>
      </div>

      <div className="flex-1 flex">
        {/* Video Avatar - Lado Izquierdo */}
        <div className="w-1/2 bg-black flex items-center justify-center relative">
          {currentVideoUrl ? (
            <video
              ref={videoRef}
              className="max-w-full max-h-full"
              autoPlay
              playsInline
            />
          ) : (
            <div className="text-center text-gray-400">
              <div className="w-32 h-32 bg-gray-800 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <p>Presiona el botón para iniciar la conversación</p>
            </div>
          )}
          
          {isProcessing && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Generando respuesta del paciente...</p>
              </div>
            </div>
          )}
        </div>

        {/* Transcripciones - Lado Derecho */}
        <div className="w-1/2 bg-gray-100 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-12">
                <p className="text-lg mb-2">👋 Inicia la consulta</p>
                <p className="text-sm">Presiona y mantén el botón de micrófono para hablar</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-lg shadow ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800'
                  }`}
                >
                  <p className="text-xs font-semibold mb-1 opacity-75">
                    {msg.role === 'user' ? '🩺 Médico' : '👤 Paciente'}
                  </p>
                  <p>{msg.content}</p>
                  
                  {msg.audio && (
                    <audio controls className="mt-2 w-full">
                      <source src={msg.audio} type="audio/mpeg" />
                    </audio>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Controles */}
          <div className="p-6 bg-white border-t border-gray-200">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={isProcessing}
              className={`w-full py-4 rounded-full font-bold text-lg transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : isProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {isRecording ? (
                '🎤 Grabando... (suelta para enviar)'
              ) : isProcessing ? (
                '⏳ Procesando...'
              ) : (
                '🎤 Mantén presionado para hablar'
              )}
            </button>
            
            <p className="text-center text-xs text-gray-500 mt-3">
              Consejo: Presiona y mantén el botón mientras hablas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}