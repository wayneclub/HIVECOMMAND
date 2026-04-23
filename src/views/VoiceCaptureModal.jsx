import React, { useState, useEffect, useRef } from 'react';
import { useMission } from '../context/MissionContext';

export default function VoiceCaptureModal() {
  const { setActiveScreen, setTacticalPhase, setActiveFormation, processAIVoiceCommand } = useMission();
  const [transcription, setTranscription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pulse, setPulse] = useState(0);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscription(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Visualizer Animation Loop
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => setPulse(p => p + 1), 80);
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        alert("Your browser does not support Speech Recognition. Please type your command manually.");
        return;
      }
      setTranscription(""); // Clear previous recording before new one
      recognitionRef.current.start();
    }
    setIsRecording(!isRecording);
  };

  const handleSubmit = () => {
    if (!transcription.trim()) {
      alert("Please provide input either via voice or typing before processing command.");
      return;
    }
    
    // Call the AI processing engine to extract tactical entities
    processAIVoiceCommand(transcription);
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(8, 12, 20, 0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      
      <div className="glass-panel" style={{ width: '800px', border: '1px solid var(--border-cyan)', padding: '0', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="flex-between" style={{ padding: '24px 32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isRecording ? 'var(--orange-alert)' : 'var(--cyan-primary)', transition: 'background 0.3s' }}></div>
              <span className="mono text-cyan" style={{ fontSize: '18px', fontWeight: 'bold' }}>{isRecording ? "VOICE CAPTURE ACTIVE" : "VOICE CAPTURE STANDBY"}</span>
            </div>
            <span className="mono text-muted" style={{ fontSize: '10px' }}>SECURE LINK: STABLE | NODE: PRIMARY_HIVE</span>
          </div>
          
          <button 
            onClick={toggleRecording} 
            className="btn"
            style={{ 
              border: isRecording ? '1px solid var(--orange-alert)' : '1px solid var(--cyan-primary)', 
              color: isRecording ? 'var(--orange-alert)' : 'var(--cyan-primary)',
              background: isRecording ? 'rgba(255, 59, 48, 0.1)' : 'rgba(0, 229, 255, 0.1)'
            }}
          >
            {isRecording ? "⏹ STOP RECORDING" : "🎙 START MIC"}
          </button>
        </div>

        {/* Visualizer Area */}
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {/* Animated Sine Bars */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
             {[...Array(25)].map((_, i) => {
                const h = isRecording ? Math.random() * 80 + 20 : Math.sin(i + pulse) * 5 + 10;
                return (
                  <div key={i} style={{ 
                    width: '6px', 
                    height: `${h}px`, 
                    background: isRecording ? 'var(--cyan-primary)' : 'var(--text-muted)', 
                    opacity: isRecording ? 0.8 : 0.2,
                    boxShadow: isRecording ? '0 0 10px var(--cyan-primary)' : 'none',
                    transition: 'height 0.08s ease'
                  }}></div>
                );
             })}
          </div>
          
          <div style={{ position: 'absolute', bottom: '16px', display: 'flex', justifyContent: 'space-between', width: '250px' }}>
            <span className="mono text-cyan" style={{ fontSize: '10px' }}>-48dB</span>
            <span className="mono text-cyan" style={{ fontSize: '10px' }}>+12dB</span>
          </div>
        </div>

        {/* Transcription Area */}
        <div style={{ padding: '32px', background: 'rgba(0, 0, 0, 0.4)' }}>
           <div style={{ borderLeft: '2px solid var(--cyan-primary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <span className="mono text-cyan" style={{ fontSize: '10px' }}>[INPUT]: AUDIO OR MANUAL OVERRIDE</span>
             <textarea 
               value={transcription}
               onChange={(e) => setTranscription(e.target.value)}
               placeholder="Waiting for voice input or type command here..."
               style={{
                 background: 'rgba(0,0,0,0.2)',
                 border: '1px solid var(--border-color)',
                 color: 'var(--text-main)',
                 minHeight: '80px',
                 fontFamily: 'Share Tech Mono, monospace',
                 fontSize: '14px',
                 padding: '12px',
                 outline: 'none',
                 resize: 'vertical',
                 width: '100%'
               }}
             />
           </div>
           
           <div className="flex-between" style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div className="flex-column">
                  <span className="mono text-muted" style={{ fontSize: '8px' }}>SIGNAL LATENCY</span>
                  <span className="mono text-cyan" style={{ fontSize: '12px' }}>14ms</span>
                </div>
                <div className="flex-column">
                  <span className="mono text-muted" style={{ fontSize: '8px' }}>ENCRYPTION</span>
                  <span className="mono text-cyan" style={{ fontSize: '12px' }}>AES-256-MIL</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button className="btn" onClick={() => setActiveScreen(1)} style={{ background: 'transparent' }}>CANCEL</button>
                <button className="btn btn-primary" onClick={handleSubmit} style={{ background: 'var(--cyan-primary)', color: '#000', fontWeight: 'bold' }}>
                  PROCESS COMMAND
                </button>
              </div>
           </div>
        </div>

      </div>

    </div>
  );
}
