// src/pages/admin/users.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { 
  User, Trash2, UserPlus, Shield, Key, Mail, Search, Filter, MoreVertical, X, Check 
} from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { apiClient } from '@/components/auth/authService';
import { useTheme } from '@/components/ThemeProvider';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'locked' | 'pending';
  last_login: string;
  has_2fa: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/api/admin/users');
        setUsers(response.data.users);
      } catch (err) {
        setError('Failed to fetch users');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    // Filter by search term
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by status
    const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await apiClient.delete(`/api/admin/users/${userId}`);
      setUsers(users.filter(user => user.id !== userId));
    } catch (err) {
      setError('Failed to delete user');
      console.error(err);
    }
  };

  const handleLockUser = async (userId: string, isLocked: boolean) => {
    try {
      await apiClient.put(`/api/admin/users/${userId}/status`, {
        status: isLocked ? 'locked' : 'active'
      });
      
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, status: isLocked ? 'locked' : 'active' } 
          : user
      ));
    } catch (err) {
      setError('Failed to update user status');
      console.error(err);
    }
  };

  return (
    <ProtectedRoute>
      <div className={`min-h-screen ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-100'}`}>
        <div className="container mx-auto px-4 py-6">
          <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>
            User Management
          </h1>
          
          {/* Error message */}
          {error && (
            <div className={`p-4 mb-6 rounded-lg flex items-center ${
              isDark ? 'bg-red-900/30 border border-red-800 text-red-200' : 'bg-red-100 border border-red-200 text-red-800'
            }`}>
              <span>{error}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-auto"
              >
                <X size={18} />
              </button>
            </div>
          )}
          
          {/* Search and filters */}
          <div className={`p-4 mb-6 rounded-lg ${
            isDark ? 'bg-[#131520] border border-gray-800' : 'bg-white shadow'
          }`}>
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                </div>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg ${
                    isDark 
                      ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-indigo-500' 
                      : 'bg-gray-50 border border-gray-300 text-gray-700 focus:border-blue-500'
                  } focus:outline-none focus:ring-1`}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`inline-flex items-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <Filter size={18} className="mr-2" />
                  <span>Status:</span>
                </div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={`rounded-lg ${
                    isDark 
                      ? 'bg-gray-800 border-gray-700 text-gray-200' 
                      : 'bg-gray-50 border border-gray-300 text-gray-700'
                  } focus:outline-none focus:ring-1 py-2 px-3`}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="locked">Locked</option>
                  <option value="pending">Pending</option>
                </select>
                
                <button 
                  onClick={() => router.push('/admin/users/new')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    isDark 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <UserPlus size={18} />
                  <span>Add User</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Users table */}
          <div className={`rounded-lg overflow-hidden ${
            isDark ? 'bg-[#131520] border border-gray-800' : 'bg-white shadow'
          }`}>
            {loading ? (
              <div className="p-8 text-center">
                <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mx-auto ${
                  isDark ? 'border-indigo-500' : 'border-blue-500'
                }`}></div>
                <p className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Loading users...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center">
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  No users found.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      } uppercase tracking-wider`}>
                        User
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      } uppercase tracking-wider`}>
                        Role
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      } uppercase tracking-wider`}>
                        Status
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      } uppercase tracking-wider`}>
                        2FA
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      } uppercase tracking-wider`}>
                        Last Login
                      </th>
                      <th className={`px-6 py-3 text-right text-xs font-medium ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      } uppercase tracking-wider`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
                    {filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td className={`px-6 py-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          <div className="flex items-center">
                            <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${
                              isDark ? 'bg-gray-800' : 'bg-gray-200'
                            }`}>
                              <User size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                            </div>
                            <div className="ml-4">
                              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {user.name}
                              </div>
                              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'admin' 
                              ? isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-800'
                              : user.role === 'manager'
                                ? isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-800'
                                : isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className={`px-6 py-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.status === 'active' 
                              ? isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-800'
                              : user.status === 'locked'
                                ? isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-800'
                                : isDark ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className={`px-6 py-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          {user.has_2fa ? (
                            <Check size={18} className={isDark ? 'text-green-500' : 'text-green-600'} />
                          ) : (
                            <X size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                          )}
                        </td>
                        <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              onClick={() => handleLockUser(user.id, user.status !== 'locked')}
                              className={`p-1 rounded-full ${
                                isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                              }`}
                              title={user.status === 'locked' ? 'Unlock User' : 'Lock User'}
                            >
                              <Shield size={18} />
                            </button>
                            <button 
                              onClick={() => router.push(`/admin/users/${user.id}`)}
                              className={`p-1 rounded-full ${
                                isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                              }`}
                              title="Edit User"
                            >
                              <Key size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user.id)}
                              className={`p-1 rounded-full ${
                                isDark ? 'hover:bg-gray-800 text-red-400' : 'hover:bg-gray-100 text-red-600'
                              }`}
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}