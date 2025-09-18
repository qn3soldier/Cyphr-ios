import React, { useState, useRef, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { Play, Pause, Download } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';

export default function AudioMessage({ audioUrl, duration, timestamp, isOwn }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [waveformData, setWaveformData] = useState([]);
  
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    // Generate mock waveform data
    const data = Array.from({ length: 50 }, () => Math.random() * 0.8 + 0.2);
    setWaveformData(data);
    
    // Preload audio
    audioRef.current = new Audio(audioUrl);
    audioRef.current.addEventListener('loadeddata', () => setIsLoading(false));
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, [audioUrl]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || isLoading) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `voice_message_${Date.now()}.webm`;
    link.click();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-3 p-3 rounded-2xl backdrop-blur-xl ${
        isOwn 
          ? 'bg-accent-primary/20 rounded-br-sm' 
          : 'bg-background-secondary/80 rounded-bl-sm'
      }`}
      style={{ minWidth: '280px', maxWidth: '400px' }}
    >
      {/* Play/Pause Button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={togglePlayPause}
        disabled={isLoading}
        className={`h-12 w-12 rounded-full ${
          isOwn ? 'hover:bg-white/10' : 'hover:bg-black/10'
        }`}
      >
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div
              key="pause"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Pause className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Play className="w-5 h-5 ml-1" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* Waveform Visualization */}
      <div className="flex-1 relative">
        <div className="h-10 flex items-center gap-0.5 relative">
          {waveformData.map((height, index) => {
            const isPassed = (index / waveformData.length) * 100 <= progress;
            return (
              <motion.div
                key={index}
                initial={{ scaleY: 0 }}
                animate={{ 
                  scaleY: isPlaying ? [height, height * 1.2, height] : height,
                  backgroundColor: isPassed 
                    ? isOwn ? '#8b5cf6' : '#3b82f6'
                    : isOwn ? '#8b5cf6/30' : '#3b82f6/30'
                }}
                transition={{
                  scaleY: {
                    repeat: isPlaying ? Infinity : 0,
                    duration: 0.8,
                    delay: index * 0.02
                  },
                  backgroundColor: { duration: 0.1 }
                }}
                className="w-1 rounded-full origin-center"
                style={{ height: `${height * 100}%` }}
              />
            );
          })}
        </div>

        {/* Progress Overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* Duration & Download */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-text-secondary/70 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDownload}
          className="h-6 w-6 opacity-60 hover:opacity-100"
        >
          <Download className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
} 