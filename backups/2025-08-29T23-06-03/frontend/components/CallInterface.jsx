import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, VolumeX, Volume2, Wifi, WifiOff } from 'lucide-react';
import { socketService } from '../api/socketService.js';
import { webrtcConfig } from '../api/webrtcConfig.js';
import { toast } from 'sonner';

export default function CallInterface({ isOpen, onClose, callData, isIncoming = false }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [iceConnectionState, setIceConnectionState] = useState('new');
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const durationInterval = useRef(null);
  const statsInterval = useRef(null);

  useEffect(() => {
    if (isOpen && isIncoming) {
      // Set up for incoming call
      initializeMedia(callData?.callType === 'video');
    }

    return () => {
      endCall();
    };
  }, [isOpen, isIncoming]);

  const initializeMedia = async (video = false) => {
    try {
      // Use optimized media constraints from WebRTC config
      const constraints = webrtcConfig.getMediaConstraints({
        video,
        audio: true,
        preferredVideoResolution: '720p',
        preferredAudioQuality: 'high'
      });

      console.log('🎥 Requesting media access:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsVideoOn(video);
      console.log('✅ Media access granted:', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length
      });
      
      return stream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      toast.error('Failed to access camera/microphone');
      return null;
    }
  };

  const startCall = async () => {
    try {
      setIsConnecting(true);
      toast.loading('Connecting call...', { id: 'call-connect' });

      const stream = await initializeMedia(isVideoOn);
      if (!stream) {
        setIsConnecting(false);
        toast.error('Cannot access media devices', { id: 'call-connect' });
        return;
      }

      // Create RTCPeerConnection with production configuration
      const peerConnection = webrtcConfig.createPeerConnection();
      peerConnectionRef.current = peerConnection;
      
      // Set up connection state monitoring
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        setConnectionState(state);
        
        switch (state) {
          case 'connected':
            setIsConnected(true);
            setIsConnecting(false);
            toast.success('Call connected', { id: 'call-connect' });
            startCallTimer();
            startStatsMonitoring();
            break;
          case 'disconnected':
            toast.warning('Call temporarily disconnected', { id: 'call-connect' });
            break;
          case 'failed':
            setIsConnected(false);
            setIsConnecting(false);
            toast.error('Call connection failed', { id: 'call-connect' });
            break;
          case 'closed':
            cleanupCall();
            break;
        }
      };

      // Monitor ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        setIceConnectionState(iceState);
        
        if (iceState === 'failed') {
          toast.error('Network connection issues - trying to reconnect', { id: 'call-connect' });
        }
      };
      
      // Add local stream tracks
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
        console.log(`➕ Added ${track.kind} track to peer connection`);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('📡 Received remote track:', event.track.kind);
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates with enhanced logging
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 ICE candidate:', {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address
          });
          
          if (callData?.targetUserId) {
            socketService.sendIceCandidate(callData.targetUserId, event.candidate);
          }
        } else {
          console.log('🧊 ICE gathering complete');
        }
      };

      // Create and send offer with enhanced options
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoOn,
        iceRestart: false
      };

      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      console.log('📞 Created call offer:', {
        type: offer.type,
        hasVideo: isVideoOn,
        sdpLines: offer.sdp.split('\n').length
      });

      // Send offer through WebSocket with enhanced data
      const callResult = await socketService.initiateCall(
        callData?.targetUserId, 
        isVideoOn ? 'video' : 'voice'
      );

      if (!callResult) {
        throw new Error('Failed to initiate call through signaling server');
      }

    } catch (error) {
      console.error('❌ Error starting call:', error);
      setIsConnecting(false);
      toast.error(`Call failed: ${error.message}`, { id: 'call-connect' });
      cleanupCall();
    }
  };

  const answerCall = async () => {
    try {
      const stream = await initializeMedia(callData?.callType === 'video');
      if (!stream) return;

      setIsConnected(true);
      startCallTimer();
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  const startCallTimer = () => {
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const startStatsMonitoring = () => {
    if (!peerConnectionRef.current) return;

    statsInterval.current = setInterval(async () => {
      try {
        const stats = await peerConnectionRef.current.getStats();
        analyzeConnectionQuality(stats);
      } catch (error) {
        console.error('Error getting connection stats:', error);
      }
    }, 5000); // Check every 5 seconds
  };

  const analyzeConnectionQuality = (stats) => {
    let quality = 'good';
    let packetsLost = 0;
    let packetsReceived = 0;
    let roundTripTime = 0;

    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        packetsLost += report.packetsLost || 0;
        packetsReceived += report.packetsReceived || 0;
      }
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        roundTripTime = report.currentRoundTripTime || 0;
      }
    });

    // Calculate packet loss percentage
    const totalPackets = packetsLost + packetsReceived;
    const lossPercentage = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

    // Determine quality based on metrics
    if (lossPercentage > 5 || roundTripTime > 0.3) {
      quality = 'poor';
    } else if (lossPercentage > 2 || roundTripTime > 0.15) {
      quality = 'fair';
    }

    setConnectionQuality(quality);

    if (quality === 'poor') {
      toast.warning('Poor connection quality detected', { id: 'connection-quality' });
    }
  };

  const cleanupCall = () => {
    // Clear intervals
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      setLocalStream(null);
    }

    // Clear remote stream
    setRemoteStream(null);

    // Reset states
    setIsConnected(false);
    setIsConnecting(false);
    setCallDuration(0);
    setConnectionState('new');
    setIceConnectionState('new');
    setConnectionQuality('good');

    console.log('🧹 Call cleanup completed');
  };

  const acceptCall = async () => {
    console.log('Accepting call...');
    
    // ТОЛЬКО сейчас запрашиваем разрешения
    const stream = await initializeMedia(callData?.callType === 'video');
    
    if (stream) {
      setIsConnected(true);
      startCallTimer();
      
      // Simulate connection
      setTimeout(() => {
        console.log('Call connected');
      }, 1000);
    } else {
      // Если нет разрешений - все равно можем принять audio-only
      setIsConnected(true);
      startCallTimer();
    }
  };


  const endCall = () => {
    console.log('Ending call...');
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    
    setIsConnected(false);
    stopCallTimer();
    onClose();
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      } else if (!isVideoOn) {
        // User wants to turn on video - request permission now
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
          });
          
          // Replace the old stream
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
          }
          
          setLocalStream(newStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = newStream;
          }
          setIsVideoOn(true);
        } catch (error) {
          console.error('Error enabling video:', error);
        }
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const stopCallTimer = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    setCallDuration(0);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col"
    >
      {/* Video Container */}
      <div className="flex-1 relative">
        {/* Remote Video (Full Screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local Video (Picture in Picture) */}
        {isVideoOn && (
          <div className="absolute top-4 right-4 w-32 h-48 bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Call Info Overlay */}
        <div className="absolute top-4 left-4 text-white">
          <h2 className="text-xl font-semibold">{callData?.targetUserName || 'Unknown'}</h2>
          <p className="text-sm opacity-75">
            {isConnected ? formatDuration(callDuration) : (isIncoming ? 'Incoming call...' : 'Calling...')}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/80 backdrop-blur-sm">
        <div className="flex justify-center items-center gap-6">
          {/* Mute */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isMuted ? 'bg-red-500' : 'bg-white/20'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </motion.button>

          {/* Video Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isVideoOn ? 'bg-white/20' : 'bg-red-500'
            }`}
          >
            {isVideoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
          </motion.button>

          {/* Accept/Start Call */}
          {!isConnected && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={isIncoming ? acceptCall : startCall}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center"
            >
              <Phone className="w-8 h-8 text-white" />
            </motion.button>
          )}

          {/* End Call */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={endCall}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center"
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </motion.button>

          {/* Speaker */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleSpeaker}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isSpeakerOn ? 'bg-blue-500' : 'bg-white/20'
            }`}
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6 text-white" /> : <VolumeX className="w-6 h-6 text-white" />}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
} 