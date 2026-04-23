import React, { useState, useEffect, useRef } from 'react';
import { useMission } from '../context/MissionContext';

export default function VoiceControlFAB() {
  const { processAIVoiceCommand } = useMission();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [pulse, setPulse] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const transcriptionRef = useRef(""); // To track latest string for auto-execution

  // Waveform animation loop (only pulses when actively listening)
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => setPulse(p => p + 1), 80);
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Break naturally upon silence VAD
      recognition.interimResults = true; // Show results typing live

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscription(currentTranscript);
        transcriptionRef.current = currentTranscript;
      };

      recognition.onerror = (event) => {
        console.error("Speech Engine Error:", event.error);
        if (event.error === 'network') {
           setStatusMessage("RECONNECTING STREAM...");
           // We ignore the error. onend will fire immediately after and restart the stream.
        } else if (event.error === 'not-allowed') {
           shouldListenRef.current = false;
           setIsRecording(false);
           setStatusMessage("[ERR]: Mic permission denied.");
        }
      };

      recognition.onend = () => {
         const finalSentence = transcriptionRef.current.trim();
         
         // Auto-Submit if there is a detected sentence
         if (finalSentence && shouldListenRef.current) {
             processAIVoiceCommand(finalSentence);
             // Flash the input briefly
             setTimeout(() => {
                 setTranscription("");
                 transcriptionRef.current = "";
             }, 800);
         }

         // THE INFINITE LOOP: Restart listening immediately if still toggled
         if (shouldListenRef.current) {
             setStatusMessage("AWAITING NEXT COMMAND...");
             setTimeout(() => {
                 try { recognitionRef.current.start(); } catch(e) {}
             }, 200); // Small buffer to prevent race conditions
         } else {
             setIsRecording(false);
             setStatusMessage("");
         }
      };

      recognitionRef.current = recognition;
    }
  }, [processAIVoiceCommand]);

  const toggleRecording = (e) => {
    if (e) e.preventDefault();
    if (!recognitionRef.current) {
        alert("Your browser does not support SpeechRecognition. Please use Chrome/Safari.");
        setIsExpanded(true);
        return;
    }

    if (!isExpanded) setIsExpanded(true);

    if (isRecording) {
      // User manual switch OFF
      shouldListenRef.current = false;
      setIsRecording(false);
      setStatusMessage("");
      recognitionRef.current.stop();
    } else {
      // User manual switch ON (Enter Conversational Mode)
      shouldListenRef.current = true;
      setIsRecording(true);
      setTranscription("");
      transcriptionRef.current = "";
      setStatusMessage("OPEN MIC // CONVERSATION ACTIVE");
      try { recognitionRef.current.start(); } catch(e) {}
    }
  };

  const closeDialog = () => {
    setIsExpanded(false);
    shouldListenRef.current = false;
    setIsRecording(false);
    recognitionRef.current?.abort();
  };

  const handleSubmit = () => {
    if (transcription.trim()) {
      processAIVoiceCommand(transcription);
      setTranscription("");
      transcriptionRef.current = "";
      // Don't close dialog, keep listening!
    }
  };

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(15, 20, 25, 0.85)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${isRecording ? 'var(--orange-alert)' : 'rgba(0, 229, 255, 0.3)'}`,
        boxShadow: isRecording ? '0 0 20px rgba(255, 107, 0, 0.2)' : '0 10px 30px rgba(0,0,0,0.5)',
        borderRadius: '32px',
        padding: '8px 12px',
        width: '480px',
        maxWidth: '90vw',
        transition: 'all 0.3s ease',
        gap: '12px'
      }}
    >
      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0px var(--orange-alert); }
          100% { box-shadow: 0 0 15px var(--orange-alert); }
        }
      `}</style>
      
      {/* Mic Icon Toggle */}
      <button 
        onClick={toggleRecording}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          flexShrink: 0,
          background: isRecording ? 'rgba(255, 107, 0, 0.2)' : 'rgba(0, 229, 255, 0.1)',
          border: `1px solid ${isRecording ? 'var(--orange-alert)' : 'var(--cyan-primary)'}`,
          animation: isRecording ? 'pulseGlow 0.8s infinite alternate' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          outline: 'none'
        }}
      >
        <svg 
           width="20" height="20" 
           fill="none" 
           stroke={isRecording ? "var(--orange-alert)" : "var(--cyan-primary)"} 
           strokeWidth="2" 
           strokeLinecap="round" 
           strokeLinejoin="round" 
           viewBox="0 0 24 24"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      </button>

      {/* Input Field / Waveform Area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', height: '100%' }}>
        {isRecording && !transcription ? (
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '30px', width: '100%', paddingLeft: '8px' }}>
             {[...Array(40)].map((_, i) => {
                const h = Math.max(4, Math.random() * 20 + Math.sin(i * 0.5 + pulse) * 10);
                return (
                  <div key={i} style={{ 
                    width: '3px', 
                    height: `${h}px`, 
                    background: 'var(--orange-alert)',
                    borderRadius: '2px',
                    transition: 'height 0.08s ease'
                  }}></div>
                );
             })}
             <span className="mono text-orange" style={{ marginLeft: '12px', fontSize: '11px', opacity: 0.8 }}>LISTENING...</span>
          </div>
        ) : (
          <textarea 
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Awaiting tactical mandate... (Tap mic or type)"
            rows={Math.min(3, Math.max(1, Math.ceil(transcription.length / 45)))}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '14px',
              padding: '0 8px',
              outline: 'none',
              resize: 'none',
              lineHeight: '20px',
              overflowY: 'auto'
            }}
          />
        )}
      </div>

      {/* Submit / Execute Icon */}
      {transcription.trim() && (
        <button 
          onClick={handleSubmit}
          className="btn-primary"
          style={{
            height: '36px',
            padding: '0 16px',
            borderRadius: '20px',
            background: 'var(--cyan-primary)',
            color: '#000',
            border: 'none',
            fontWeight: 'bold',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          EXECUTE
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      )}
    </div>
  );
}
