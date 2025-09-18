import React, { useState, useEffect, useRef } from 'react';
import Animated from 'react-native-reanimated';
import { Search, X, Clock, MessageSquare, FileText, Image, Mic, Video, Users, Hash } from 'react-native-vector-icons/MaterialIcons';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { supabase } from '../../api/supabaseClient';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';

export default function SearchModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all'); // all, messages, media, files
  const [results, setResults] = useState({
    messages: [],
    chats: [],
    media: [],
    files: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const searchInputRef = useRef(null);
  const navigate = useNavigation();

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
      loadRecentSearches();
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setResults({ messages: [], chats: [], media: [], files: [] });
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchFilter]);

  const loadRecentSearches = () => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved).slice(0, 5));
    }
  };

  const saveToRecentSearches = (query) => {
    const saved = localStorage.getItem('recentSearches');
    const searches = saved ? JSON.parse(saved) : [];
    const updated = [query, ...searches.filter(s => s !== query)].slice(0, 10);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const performSearch = async () => {
    setIsSearching(true);
    const userId = sessionStorage.getItem('userId');

    try {
      const searchPattern = `%${searchQuery}%`;

      // Search messages
      if (searchFilter === 'all' || searchFilter === 'messages') {
        const { data: messages } = await supabase
          .from('messages')
          .select(`
            *,
            chats (
              id,
              name,
              type,
              avatar_url
            )
          `)
          .or(`content.ilike.${searchPattern},decrypted_content.ilike.${searchPattern}`)
          .in('chat_id', 
            (await supabase
              .from('chat_participants')
              .select('chat_id')
              .eq('user_id', userId)).data?.map(p => p.chat_id) || []
          )
          .order('created_at', { ascending: false })
          .limit(20);

        setResults(prev => ({ ...prev, messages: messages || [] }));
      }

      // Search chats by name
      if (searchFilter === 'all') {
        const { data: chats } = await supabase
          .from('chats')
          .select(`
            *,
            participants:chat_participants (
              user_id,
              users:user_id (full_name, avatar_url)
            )
          `)
          .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
          .in('id',
            (await supabase
              .from('chat_participants')
              .select('chat_id')
              .eq('user_id', userId)).data?.map(p => p.chat_id) || []
          )
          .limit(10);

        setResults(prev => ({ ...prev, chats: chats || [] }));
      }

      // Search media
      if (searchFilter === 'all' || searchFilter === 'media') {
        const { data: media } = await supabase
          .from('messages')
          .select(`
            *,
            chats (
              id,
              name,
              type,
              avatar_url
            )
          `)
          .in('type', ['image', 'video', 'audio'])
          .or(`file_name.ilike.${searchPattern},content.ilike.${searchPattern}`)
          .in('chat_id',
            (await supabase
              .from('chat_participants')
              .select('chat_id')
              .eq('user_id', userId)).data?.map(p => p.chat_id) || []
          )
          .order('created_at', { ascending: false })
          .limit(15);

        setResults(prev => ({ ...prev, media: media || [] }));
      }

      saveToRecentSearches(searchQuery);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (result, type) => {
    if (type === 'chat') {
      navigate(`/chat/${result.id}`);
    } else {
      navigate(`/chat/${result.chat_id}?message=${result.id}`);
    }
    onClose();
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Mic className="w-4 h-4" />;
      case 'file': return <FileText className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={i} className="bg-accent-primary/30 text-accent-primary rounded">{part}</mark> : 
        part
    );
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-3xl mx-auto mt-20 bg-background-primary rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Search Header */}
        <div className="p-6 border-b border-border">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages, media, files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-12 h-12 text-lg bg-background-secondary/50"
            />
            {searchQuery && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4">
            {['all', 'messages', 'media', 'files'].map((filter) => (
              <Button
                key={filter}
                variant={searchFilter === filter ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSearchFilter(filter)}
                className={searchFilter === filter ? 'bg-accent-primary' : ''}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Search Results */}
        <div className="max-h-[500px] overflow-y-auto">
          {isSearching ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-text-secondary">Searching...</p>
            </div>
          ) : searchQuery ? (
            <div className="p-4">
              {/* Chats */}
              {results.chats.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Chats
                  </h3>
                  <div className="space-y-2">
                    {results.chats.map((chat) => (
                      <motion.div
                        key={chat.id}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                        onClick={() => handleResultClick(chat, 'chat')}
                        className="p-3 rounded-lg cursor-pointer flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center">
                          {chat.avatar_url ? (
                            <img src={chat.avatar_url} alt={chat.name} className="w-full h-full rounded-full object-cover" />
                          ) : chat.type === 'group' ? (
                            <Users className="w-5 h-5 text-white" />
                          ) : (
                            <span className="text-white font-bold">{chat.name?.charAt(0)?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{highlightMatch(chat.name, searchQuery)}</p>
                          {chat.description && (
                            <p className="text-sm text-text-secondary truncate">
                              {highlightMatch(chat.description, searchQuery)}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {results.messages.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Messages
                  </h3>
                  <div className="space-y-2">
                    {results.messages.map((message) => (
                      <motion.div
                        key={message.id}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                        onClick={() => handleResultClick(message, 'message')}
                        className="p-3 rounded-lg cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">{getMessageIcon(message.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-accent-primary">
                                {message.chats?.name}
                              </p>
                              <span className="text-xs text-text-secondary">
                                {format(new Date(message.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm text-text-primary truncate">
                              {highlightMatch(message.decrypted_content || message.content || '', searchQuery)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Media */}
              {results.media.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Media & Files
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {results.media.map((media) => (
                      <motion.div
                        key={media.id}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => handleResultClick(media, 'message')}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-background-secondary"
                      >
                        {media.type === 'image' && media.media_url && (
                          <img
                            src={media.media_url}
                            alt={media.file_name}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {media.type === 'video' && (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-8 h-8 text-text-secondary" />
                          </div>
                        )}
                        {media.type === 'audio' && (
                          <div className="w-full h-full flex items-center justify-center">
                            <Mic className="w-8 h-8 text-text-secondary" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-xs text-white truncate">{media.file_name}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {!results.chats.length && !results.messages.length && !results.media.length && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-text-secondary/30 mx-auto mb-4" />
                  <p className="text-text-secondary">No results found for "{searchQuery}"</p>
                </div>
              )}
            </div>
          ) : (
            /* Recent Searches */
            <div className="p-6">
              <h3 className="text-sm font-semibold text-text-secondary mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Searches
              </h3>
              {recentSearches.length > 0 ? (
                <div className="space-y-2">
                  {recentSearches.map((search, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                      onClick={() => setSearchQuery(search)}
                      className="p-3 rounded-lg cursor-pointer flex items-center gap-3"
                    >
                      <Hash className="w-4 h-4 text-text-secondary" />
                      <span className="text-text-primary">{search}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary text-center py-8">No recent searches</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
} 