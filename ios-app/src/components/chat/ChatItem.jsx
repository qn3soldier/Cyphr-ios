import React from 'react';
import Animated from 'react-native-reanimated';
import EnhancedAvatar from '../EnhancedAvatar';
import { cn } from '../lib/utils';
import { cva } from 'class-variance-authority';

const chatItemVariants = cva(
  "flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10",
        active: "bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/50 shadow-lg shadow-blue-500/10",
        selected: "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 hover:from-purple-500/30 hover:to-cyan-500/30 border border-purple-400/50 shadow-lg shadow-purple-500/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const ChatItem = ({ chat, onClick, variant, isSelected }) => {
  const actualVariant = isSelected ? 'selected' : variant;
  const { id, name, lastMessage, time, unreadCount, avatar, online, userId, participants } = chat;
  
  // For group chats, use the chat ID, for direct chats use the other participant's ID
  const avatarUserId = chat.type === 'group' ? id : (participants && participants.length > 0 ? participants[0].user_id : userId);

  return (
    <motion.div
      onClick={onClick}
      className={cn(chatItemVariants({ variant: actualVariant }))}
      whileHover={{ scale: 1.03, x: 5 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <div className="mr-4">
        <EnhancedAvatar
          userId={avatarUserId}
          size="md"
          showOnline={chat.type !== 'group'}
          online={online}
          fallbackData={avatar ? null : { initials: name.charAt(0).toUpperCase(), color: 'bg-gradient-to-br from-violet-600 to-cyan-600' }}
        />
      </div>
      <div className="flex-grow overflow-hidden">
        <h3 className="font-semibold text-white truncate">{name}</h3>
        <p className="text-sm text-gray-400 truncate">{lastMessage}</p>
      </div>
      <div className="flex flex-col items-end ml-4 flex-shrink-0">
        <span className="text-xs text-gray-500 mb-1.5">{time}</span>
        {unreadCount > 0 ? (
          <span className="flex items-center justify-center bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5">
            {unreadCount}
          </span>
        ) : (
          <div className="h-5 w-5" /> // Placeholder for alignment
        )}
      </div>
    </motion.div>
  );
};

export default ChatItem; 