import React, { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { 
  X, Users, MoreVertical, Crown, UserMinus, Ban, 
  UserPlus, Shield, AlertTriangle, Search, Check 
} from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { toast } from 'react-native-toast-message';

const MemberActions = {
  PROMOTE: 'promote',
  DEMOTE: 'demote',
  REMOVE: 'remove',
  BAN: 'ban',
  UNBAN: 'unban'
};

export default function MemberManagementModal({ 
  group, 
  currentUserId, 
  isAdmin,
  onClose,
  onMemberAction
}) {
  const [members, setMembers] = useState([]);
  const [bannedMembers, setBannedMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBanned, setShowBanned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [group.id]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chats/${group.id}/members`, {
        headers: {
          'user-id': currentUserId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load members');
      }

      const data = await response.json();
      setMembers(data.members || []);
      setBannedMembers(data.bannedMembers || []);
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Failed to load group members');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberAction = async (action, targetUserId, reason = null) => {
    if (!isAdmin) {
      toast.error('Only admins can perform this action');
      return;
    }

    // Prevent self-actions that could break the group
    if (targetUserId === currentUserId) {
      const lastAdmin = members.filter(m => m.role === 'admin').length === 1;
      if (lastAdmin && (action === MemberActions.DEMOTE || action === MemberActions.REMOVE)) {
        toast.error('Cannot remove the last admin from the group');
        return;
      }
    }

    setActionInProgress(true);
    try {
      let endpoint = '';
      let method = 'POST';
      let body = {};

      switch (action) {
        case MemberActions.REMOVE:
          endpoint = `/api/chats/${group.id}/members/${targetUserId}`;
          method = 'DELETE';
          break;
        case MemberActions.PROMOTE:
        case MemberActions.DEMOTE:
          endpoint = `/api/chats/${group.id}/members/${targetUserId}/role`;
          method = 'PUT';
          body = { role: action === MemberActions.PROMOTE ? 'admin' : 'member' };
          break;
        case MemberActions.BAN:
          endpoint = `/api/chats/${group.id}/ban/${targetUserId}`;
          method = 'POST';
          body = { reason };
          break;
        case MemberActions.UNBAN:
          endpoint = `/api/chats/${group.id}/ban/${targetUserId}`;
          method = 'DELETE';
          break;
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'user-id': currentUserId
        },
        body: method !== 'DELETE' ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Action failed');
      }

      const result = await response.json();
      toast.success(result.message);
      
      // Refresh member list
      await loadMembers();
      
      // Notify parent component
      if (onMemberAction) {
        onMemberAction(action, targetUserId, result);
      }

      setSelectedMember(null);
    } catch (error) {
      console.error('Member action error:', error);
      toast.error(error.message || 'Failed to perform action');
    } finally {
      setActionInProgress(false);
    }
  };

  const filteredMembers = members.filter(member => 
    member.users?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.users?.phone?.includes(searchQuery)
  );

  const filteredBannedMembers = bannedMembers.filter(banned => 
    banned.users?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    banned.users?.phone?.includes(searchQuery)
  );

  const AdminActions = ({ member }) => {
    if (!isAdmin || member.user_id === currentUserId) return null;

    return (
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedMember(selectedMember === member.user_id ? null : member.user_id)}
          className="p-1 h-8 w-8"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>

        <AnimatePresence>
          {selectedMember === member.user_id && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-10 bg-background-secondary border border-border rounded-lg shadow-lg py-1 z-50 min-w-[150px]"
            >
              {member.role === 'member' ? (
                <button
                  onClick={() => handleMemberAction(MemberActions.PROMOTE, member.user_id)}
                  disabled={actionInProgress}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-sm"
                >
                  <Crown className="w-4 h-4 text-yellow-500" />
                  Promote to Admin
                </button>
              ) : (
                <button
                  onClick={() => handleMemberAction(MemberActions.DEMOTE, member.user_id)}
                  disabled={actionInProgress}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-sm"
                >
                  <Shield className="w-4 h-4 text-blue-500" />
                  Demote to Member
                </button>
              )}
              
              <button
                onClick={() => handleMemberAction(MemberActions.REMOVE, member.user_id)}
                disabled={actionInProgress}
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-sm text-orange-500"
              >
                <UserMinus className="w-4 h-4" />
                Remove from Group
              </button>
              
              <button
                onClick={() => {
                  const reason = prompt('Reason for ban (optional):');
                  if (reason !== null) {
                    handleMemberAction(MemberActions.BAN, member.user_id, reason);
                  }
                }}
                disabled={actionInProgress}
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-sm text-red-500"
              >
                <Ban className="w-4 h-4" />
                Ban from Group
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const MemberItem = ({ member, isBanned = false }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center">
          {member.users?.avatar_url ? (
            <img
              src={member.users.avatar_url}
              alt={member.users?.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-white font-bold">
              {member.users?.name?.charAt(0)?.toUpperCase()}
            </span>
          )}
        </div>
        
        {!isBanned && member.users?.status === 'online' && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-background-primary" />
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">
            {member.users?.name}
            {member.user_id === currentUserId && ' (You)'}
          </p>
          
          {!isBanned && member.role === 'admin' && (
            <Crown className="w-4 h-4 text-yellow-500" />
          )}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {isBanned ? (
            <>
              <Ban className="w-3 h-3 text-red-500" />
              <span>Banned • {member.reason}</span>
            </>
          ) : (
            <>
              <span>{member.role === 'admin' ? 'Administrator' : 'Member'}</span>
              {member.joined_at && (
                <span>• Joined {new Date(member.joined_at).toLocaleDateString()}</span>
              )}
            </>
          )}
        </div>
      </div>

      {isBanned && isAdmin ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleMemberAction(MemberActions.UNBAN, member.user_id)}
          disabled={actionInProgress}
          className="text-green-500 hover:bg-green-500/10"
        >
          Unban
        </Button>
      ) : (
        <AdminActions member={member} />
      )}
    </motion.div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-background-primary rounded-2xl p-6">
          <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-center mt-2">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background-primary rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              Manage Members
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="mt-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background-secondary/50"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <Button
                variant={!showBanned ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setShowBanned(false)}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Members ({filteredMembers.length})
              </Button>
              
              {isAdmin && bannedMembers.length > 0 && (
                <Button
                  variant={showBanned ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setShowBanned(true)}
                  className="flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Banned ({filteredBannedMembers.length})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">
            {!showBanned ? (
              <motion.div
                key="members"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <MemberItem key={member.user_id} member={member} />
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    {searchQuery ? 'No members found' : 'No members in this group'}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="banned"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {filteredBannedMembers.length > 0 ? (
                  filteredBannedMembers.map((banned) => (
                    <MemberItem key={banned.user_id} member={banned} isBanned />
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    {searchQuery ? 'No banned members found' : 'No banned members'}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {isAdmin && (
          <div className="p-6 border-t border-border">
            <div className="text-xs text-text-secondary">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              As an admin, you can promote members, remove users, and ban members from the group.
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}