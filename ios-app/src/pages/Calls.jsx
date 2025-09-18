import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Phone, Video, MicOff, Mic, VideoOff, PhoneOff, Users, Clock, Shield, Search, Plus } from 'react-native-vector-icons/MaterialIcons';
import Animated from 'react-native-reanimated';
import { toast } from 'react-native-toast-message';
import socketService from '../api/socketService.js';
import { supabase } from '../api/supabaseClient';

const Calls = () => {
  const navigate = useNavigation();
  const [callHistory, setCallHistory] = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);

  useEffect(() => {
    loadCallHistory();
    loadContacts();
    setupWebRTC();

    // Listen for incoming calls
    socketService.on('incoming_call', handleIncomingCall);
    socketService.on('call_answer', handleCallAnswer);
    socketService.on('ice_candidate', handleIceCandidate);
    socketService.on('call_ended', handleCallEnded);

    return () => {
      cleanupWebRTC();
      socketService.off('incoming_call');
      socketService.off('call_answer');
      socketService.off('ice_candidate');
      socketService.off('call_ended');
    };
  }, []);

  const setupWebRTC = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast.error('Failed to access camera/microphone');
    }
  };

  const cleanupWebRTC = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
  };

  const loadCallHistory = async () => {
    try {
      const userId = sessionStorage.getItem('userId');
      if (!userId) return;

      // Load real call history from database
      const { data: calls, error } = await supabase
        .from('calls')
        .select(`
          id,
          type,
          duration,
          status,
          created_at,
          caller_id,
          receiver_id,
          caller:users!calls_caller_id_fkey(name, phone),
          receiver:users!calls_receiver_id_fkey(name, phone)
        `)
        .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading call history:', error);
        return;
      }

      setCallHistory(calls || []);
    } catch (error) {
      console.error('Error loading call history:', error);
    }
  };

  const loadContacts = async () => {
    try {
      const userId = sessionStorage.getItem('userId');
      if (!userId) return;

      // Load contacts from chat participants
      const { data: contacts, error } = await supabase
        .from('chat_participants')
        .select(`
          user_id,
          users!chat_participants_user_id_fkey(
            id,
            name,
            phone,
            avatar_url,
            status
          )
        `)
        .neq('user_id', userId);

      if (error) {
        console.error('Error loading contacts:', error);
        return;
      }

      // Remove duplicates and format contacts
      const uniqueContacts = [];
      const seenIds = new Set();
      
      contacts?.forEach(participant => {
        if (participant.users && !seenIds.has(participant.users.id)) {
          seenIds.add(participant.users.id);
          uniqueContacts.push(participant.users);
        }
      });

      setContacts(uniqueContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const searchContacts = async (query) => {
    if (!query.trim()) {
      loadContacts();
      return;
    }

    setIsSearching(true);
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, phone, avatar_url, status')
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .neq('id', sessionStorage.getItem('userId'))
        .limit(20);

      if (error) {
        console.error('Error searching contacts:', error);
        return;
      }

      setContacts(users || []);
    } catch (error) {
      console.error('Error searching contacts:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('ice_candidate', {
          candidate: event.candidate,
          to: activeCall?.userId
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    localStream?.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    peerConnection.current = pc;
    return pc;
  };

  const startCall = async (userId, isVideo, userName = 'Unknown') => {
    try {
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketService.emit('call_offer', {
        offer,
        to: userId,
        isVideo
      });

      setActiveCall({ userId, isVideo, isOutgoing: true, userName });
      toast.success(`${isVideo ? 'Video' : 'Voice'} call started with ${userName}`);
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Failed to start call');
    }
  };

  const handleIncomingCall = async ({ from, offer, isVideo, fromName }) => {
    setActiveCall({ userId: from, isVideo, isOutgoing: false, offer, userName: fromName });
    toast.info(`Incoming ${isVideo ? 'video' : 'voice'} call from ${fromName}`);
  };

  const acceptCall = async () => {
    if (!activeCall?.offer) return;

    try {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(activeCall.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.emit('call_answer', {
        answer,
        to: activeCall.userId
      });

      toast.success('Call accepted');
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('Failed to accept call');
    }
  };

  const handleCallAnswer = async ({ answer }) => {
    try {
      await peerConnection.current?.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling call answer:', error);
    }
  };

  const handleIceCandidate = async ({ candidate }) => {
    try {
      await peerConnection.current?.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const endCall = () => {
    socketService.emit('end_call', { to: activeCall?.userId });
    handleCallEnded();
    toast.info('Call ended');
  };

  const handleCallEnded = () => {
    cleanupWebRTC();
    setActiveCall(null);
    setRemoteStream(null);
    setupWebRTC(); // Restart media for next call
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatCallTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)} minutes ago`;
    } else if (diff < 86400000) { // Less than 24 hours
      return `${Math.floor(diff / 3600000)} hours ago`;
    } else if (diff < 604800000) { // Less than 7 days
      return `${Math.floor(diff / 86400000)} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] text-white">
      {/* Header */}
      <div className="glass border-b border-white/10">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Calls</h1>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="text-sm text-white/60">E2E Encrypted</span>
          </div>
        </div>
      </div>

      {/* Active Call */}
      <AnimatePresence>
        {activeCall && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 bg-black"
          >
            <div className="relative h-full">
              {/* Remote Video */}
              <video
                ref={remoteVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
              />

              {/* Local Video */}
              <video
                ref={localVideoRef}
                className="absolute top-4 right-4 w-32 h-48 rounded-xl object-cover shadow-lg"
                autoPlay
                playsInline
                muted
              />

              {/* Call Info */}
              <div className="absolute top-4 left-4 glass rounded-xl p-4">
                <h3 className="text-lg font-semibold">{activeCall.userName}</h3>
                <p className="text-sm text-white/60">
                  {activeCall.isVideo ? 'Video Call' : 'Voice Call'} • 
                  {activeCall.isOutgoing ? ' Outgoing' : ' Incoming'}
                </p>
              </div>

              {/* Incoming Call Controls */}
              {!activeCall.isOutgoing && activeCall.offer && (
                <div className="absolute bottom-32 left-0 right-0 flex justify-center gap-6">
                  <button
                    onClick={() => handleCallEnded()}
                    className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <PhoneOff className="w-8 h-8" />
                  </button>
                  <button
                    onClick={acceptCall}
                    className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center"
                  >
                    <Phone className="w-8 h-8" />
                  </button>
                </div>
              )}

              {/* Call Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex justify-center gap-4">
                  <button
                    onClick={toggleMute}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      isMuted ? 'bg-red-500' : 'glass'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>

                  <button
                    onClick={endCall}
                    className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <PhoneOff className="w-8 h-8" />
                  </button>

                  <button
                    onClick={toggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      isVideoOff ? 'bg-red-500' : 'glass'
                    }`}
                  >
                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search contacts by name or phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchContacts(e.target.value);
              }}
              className="w-full pl-12 pr-4 py-3 glass rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Contacts List */}
        {searchQuery && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {isSearching ? 'Searching...' : `Contacts (${contacts.length})`}
            </h2>
            
            {contacts.length === 0 && !isSearching ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-white/30 mx-auto mb-2" />
                <p className="text-white/60 text-sm">No contacts found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-full flex items-center justify-center">
                      {contact.avatar_url ? (
                        <img 
                          src={contact.avatar_url} 
                          alt={contact.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {contact.name ? contact.name.charAt(0).toUpperCase() : 'U'}
                        </span>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold">{contact.name || 'Unknown'}</h3>
                      <p className="text-sm text-white/60">{contact.phone}</p>
                      {contact.status && (
                        <p className="text-xs text-green-400">Online</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startCall(contact.id, false, contact.name)}
                        className="p-3 glass rounded-full hover:bg-green-500/20 transition-colors"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => startCall(contact.id, true, contact.name)}
                        className="p-3 glass rounded-full hover:bg-blue-500/20 transition-colors"
                      >
                        <Video className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Call History */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Calls</h2>

          {callHistory.length === 0 ? (
            <div className="text-center py-20">
              <Phone className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No calls yet</h3>
              <p className="text-white/60 text-sm">
                Your call history will appear here. Use the search above to find contacts and start calling.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {callHistory.map((call, index) => {
                const isOutgoing = call.caller_id === sessionStorage.getItem('userId');
                const otherUser = isOutgoing ? call.receiver : call.caller;
                
                return (
                  <motion.div
                    key={call.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      call.status === 'missed' ? 'bg-red-500/20' : 'bg-green-500/20'
                    }`}>
                      {call.type === 'video' ? (
                        <Video className={`w-6 h-6 ${call.status === 'missed' ? 'text-red-400' : 'text-green-400'}`} />
                      ) : (
                        <Phone className={`w-6 h-6 ${call.status === 'missed' ? 'text-red-400' : 'text-green-400'}`} />
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold">{otherUser?.name || 'Unknown'}</h3>
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <Clock className="w-3 h-3" />
                        <span>{formatCallTime(call.created_at)}</span>
                        {call.status !== 'missed' && call.duration && <span>• {formatDuration(call.duration)}</span>}
                        {call.status === 'missed' && <span className="text-red-400">• Missed</span>}
                        <span className="text-blue-400">• {isOutgoing ? 'Outgoing' : 'Incoming'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startCall(otherUser?.id, false, otherUser?.name)}
                        className="p-3 glass rounded-full hover:bg-green-500/20 transition-colors"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => startCall(otherUser?.id, true, otherUser?.name)}
                        className="p-3 glass rounded-full hover:bg-blue-500/20 transition-colors"
                      >
                        <Video className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calls;