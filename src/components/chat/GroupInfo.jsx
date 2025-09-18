import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Shield, Users, Settings, Camera, Edit, UserPlus, 
  LogOut, Trash2, Bell, Clock, Link, Share2, UserCog 
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { toast } from 'sonner';
import MemberManagementModal from './MemberManagementModal';
import AddMemberModal from './AddMemberModal';

export default function GroupInfo({ 
  group, 
  currentUserId,
  isAdmin,
  onClose,
  onUpdate,
  onLeaveGroup,
  onDeleteGroup,
  onAddMembers
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [groupDescription, setGroupDescription] = useState(group.description || '');
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const fileInputRef = useRef(null);

  const handleSave = async () => {
    if (!groupName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }

    await onUpdate({
      name: groupName,
      description: groupDescription
    });
    
    setIsEditing(false);
    toast.success('Group info updated');
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    await onUpdate({ avatar: file });
    toast.success('Group photo updated');
  };

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/join/${group.id}`;
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied');
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30 }}
      className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background-primary z-50 overflow-hidden"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 bg-background-secondary/50 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Group Info</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Group Info Section */}
          <div className="p-6 space-y-4 border-b border-border">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => isAdmin && fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center group"
                  disabled={!isAdmin}
                >
                  {group.avatar_url ? (
                    <img
                      src={group.avatar_url}
                      alt={group.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-10 h-10 text-white" />
                  )}
                  {isAdmin && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  )}
                </motion.button>
              </div>

              {/* Group Details */}
              <div className="flex-1 space-y-2">
                {isEditing ? (
                  <>
                    <Input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Group name"
                      className="font-semibold"
                      maxLength={100}
                    />
                    <Input
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      placeholder="Add description"
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSave}
                        className="bg-accent-primary hover:bg-accent-primary/80"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsEditing(false);
                          setGroupName(group.name);
                          setGroupDescription(group.description || '');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{group.name}</h3>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setIsEditing(true)}
                          className="h-6 w-6"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-sm text-text-secondary">{group.description}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Group Stats */}
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {group.participants?.length || 0} members
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-green-400" />
                End-to-end encrypted
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 space-y-2 border-b border-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-5 h-5" />
              Group Settings
              <motion.div
                animate={{ rotate: showSettings ? 180 : 0 }}
                className="ml-auto"
              >
                ▼
              </motion.div>
            </Button>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pl-8 space-y-2 py-2">
                    <label className="flex items-center justify-between cursor-pointer p-2 hover:bg-white/5 rounded-lg">
                      <span className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Mute notifications
                      </span>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-accent-primary"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer p-2 hover:bg-white/5 rounded-lg">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Disappearing messages
                      </span>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-accent-primary"
                      />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isAdmin && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={() => setShowAddMember(true)}
              >
                <UserPlus className="w-5 h-5" />
                Add Members
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={copyInviteLink}
            >
              <Link className="w-5 h-5" />
              Invite via Link
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
            >
              <Share2 className="w-5 h-5" />
              Share Group
            </Button>
          </div>

          {/* Members Section */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Members ({group.participants?.length || 0})
              </h4>
            </div>

            {/* Member Management Button */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => setShowMemberManagement(true)}
            >
              <UserCog className="w-5 h-5" />
              {isAdmin ? 'Manage Members' : 'View Members'}
            </Button>

            {/* Quick Preview of First Few Members */}
            <div className="space-y-2">
              {group.participants?.slice(0, 3).map((member, index) => (
                <motion.div
                  key={member.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center">
                    {member.users?.avatar_url ? (
                      <img
                        src={member.users.avatar_url}
                        alt={member.users?.full_name || member.users?.name || 'User'}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-sm font-bold">
                        {(member.users?.full_name || member.users?.name || 'U')?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {member.users?.full_name || member.users?.name || 'Unknown User'}
                      {member.user_id === currentUserId && ' (You)'}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </p>
                  </div>
                </motion.div>
              ))}
              
              {group.participants && group.participants.length > 3 && (
                <div className="text-center text-sm text-text-secondary">
                  +{group.participants.length - 3} more members
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="ghost"
            onClick={onLeaveGroup}
            className="w-full justify-center gap-2 text-red-500 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            Leave Group
          </Button>
          
          {isAdmin && (
            <Button
              variant="ghost"
              onClick={onDeleteGroup}
              className="w-full justify-center gap-2 text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="w-5 h-5" />
              Delete Group
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Member Management Modal */}
      <AnimatePresence>
        {showMemberManagement && (
          <MemberManagementModal
            group={group}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onClose={() => setShowMemberManagement(false)}
            onMemberAction={(action, userId, result) => {
              // Handle member action if needed
              console.log('Member action:', action, userId, result);
            }}
          />
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddMember && (
          <AddMemberModal
            group={group}
            currentUserId={currentUserId}
            onClose={() => setShowAddMember(false)}
            onMemberAdded={(userIds) => {
              // Handle member added
              console.log('Members added:', userIds);
              // Optionally trigger group data refresh
              if (onUpdate) {
                onUpdate({ refreshMembers: true });
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
} 