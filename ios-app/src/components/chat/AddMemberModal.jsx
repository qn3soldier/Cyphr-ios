import React, { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { X, Search, UserPlus, Check, Users } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { toast } from 'react-native-toast-message';
import { supabase } from '../../api/supabaseClient';

export default function AddMemberModal({ 
  group, 
  currentUserId,
  onClose,
  onMemberAdded
}) {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadAvailableUsers();
  }, [group.id]);

  const loadAvailableUsers = async () => {
    try {
      setLoading(true);
      
      // Get current group members to exclude them
      const currentMemberIds = group.participants?.map(p => p.user_id) || [];
      
      // Load all users except current members
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, phone, avatar_url, status')
        .not('id', 'in', `(${currentMemberIds.join(',')})`)
        .order('name');

      if (error) throw error;

      setUsers(users || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load available users');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      
      if (prev.length >= 10) {
        toast.error('Maximum 10 users can be added at once');
        return prev;
      }
      
      return [...prev, userId];
    });
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user to add');
      return;
    }

    setAdding(true);
    try {
      const addPromises = selectedUsers.map(async (userId) => {
        const response = await fetch(`/api/chats/${group.id}/members/${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'user-id': currentUserId
          }
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to add user ${userId}: ${error.error}`);
        }

        return response.json();
      });

      await Promise.all(addPromises);
      
      toast.success(`Successfully added ${selectedUsers.length} member(s) to the group`);
      
      if (onMemberAdded) {
        onMemberAdded(selectedUsers);
      }
      
      onClose();
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error(error.message || 'Failed to add members');
    } finally {
      setAdding(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone?.includes(searchQuery)
  );

  const selectedUsersList = users.filter(u => selectedUsers.includes(u.id));

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-background-primary rounded-2xl p-6">
          <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-center mt-2">Loading users...</p>
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
              <UserPlus className="w-6 h-6" />
              Add Members
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
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background-secondary/50"
              />
            </div>

            {/* Selected count */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {selectedUsers.length} user(s) selected
              </span>
              {selectedUsers.length > 0 && (
                <span className="text-text-secondary">
                  {selectedUsers.length} / 10 max
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Selected Users Preview */}
        {selectedUsersList.length > 0 && (
          <div className="p-4 bg-background-secondary/30 border-b border-border">
            <h4 className="text-sm font-medium mb-2">Selected users:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedUsersList.map(user => (
                <motion.div
                  key={user.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-2 px-3 py-1 bg-accent-primary/20 rounded-full"
                >
                  <span className="text-sm">{user.name}</span>
                  <button
                    onClick={() => toggleUserSelection(user.id)}
                    className="hover:bg-white/10 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* User List */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="space-y-2">
            <AnimatePresence>
              {filteredUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => toggleUserSelection(user.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    selectedUsers.includes(user.id)
                      ? 'bg-accent-primary/20 border-accent-primary'
                      : 'bg-background-secondary/50 hover:bg-background-secondary/70'
                  } border border-transparent`}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold">
                          {user.name?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {user.status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-background-primary" />
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-text-secondary">{user.phone}</p>
                  </div>

                  {/* Selection Checkbox */}
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedUsers.includes(user.id)
                      ? 'bg-accent-primary border-accent-primary'
                      : 'border-border'
                  }`}>
                    {selectedUsers.includes(user.id) && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-text-secondary">
                {searchQuery ? 'No users found' : 'All users are already in this group'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1"
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMembers}
              disabled={selectedUsers.length === 0 || adding}
              className="flex-1 bg-accent-primary hover:bg-accent-primary/80"
            >
              {adding ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add {selectedUsers.length > 0 ? `${selectedUsers.length} ` : ''}Member{selectedUsers.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}