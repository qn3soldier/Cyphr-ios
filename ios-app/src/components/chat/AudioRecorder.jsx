import React, { useState, useRef, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { Mic, X, Send, Pause, Play } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';

export default function AudioRecorder({ onSendAudio, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [visualizerData, setVisualizerData] = useState(new Uint8Array(128));
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    startRecording();
    
    return () => {
      stopRecording();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Setup audio context for visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      // Start visualization
      visualizeAudio();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      onCancel();
    }
  };

  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const animate = () => {
      if (!isRecording || isPaused) {
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);
      setVisualizerData([...dataArray]);
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        visualizeAudio();
      } else {
        mediaRecorderRef.current.pause();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }
      setIsPaused(!isPaused);
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onSendAudio(audioBlob, recordingTime);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-background-secondary/95 backdrop-blur-xl border-t border-border p-4 z-50"
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              stopRecording();
              onCancel();
            }}
            className="text-red-500 hover:bg-red-500/10"
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2 text-text-primary">
            <motion.div
              animate={{ opacity: isRecording && !isPaused ? [1, 0.5, 1] : 1 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`w-3 h-3 rounded-full ${isRecording && !isPaused ? 'bg-red-500' : 'bg-gray-500'}`}
            />
            <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
          </div>

          {!audioBlob ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={pauseRecording}
              disabled={!isRecording}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPause}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
          )}
        </div>

        {/* Audio Visualizer */}
        <div className="h-24 flex items-center justify-center gap-1 mb-4">
          <AnimatePresence>
            {visualizerData.slice(0, 64).map((value, index) => (
              <motion.div
                key={index}
                initial={{ height: 0 }}
                animate={{ 
                  height: Math.max(4, (value / 255) * 80),
                  backgroundColor: value > 180 ? '#8b5cf6' : value > 120 ? '#3b82f6' : '#64748b'
                }}
                exit={{ height: 0 }}
                transition={{ duration: 0.1 }}
                className="w-1 rounded-full"
                style={{ opacity: audioBlob ? 0.5 : 1 }}
              />
            ))}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-4">
          {!audioBlob ? (
            <Button
              size="lg"
              onClick={stopRecording}
              className="bg-accent-primary hover:bg-accent-primary/80"
            >
              <Mic className="w-5 h-5 mr-2" />
              Stop Recording
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setAudioBlob(null);
                  setAudioUrl(null);
                  setRecordingTime(0);
                  setIsPlaying(false);
                  startRecording();
                }}
              >
                Re-record
              </Button>
              <Button
                size="lg"
                onClick={handleSend}
                className="bg-accent-primary hover:bg-accent-primary/80"
              >
                <Send className="w-5 h-5 mr-2" />
                Send Voice Message
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
} 