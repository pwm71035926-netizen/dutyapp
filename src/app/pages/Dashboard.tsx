import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Bell,
  RefreshCw,
  Calendar as CalendarIcon,
  MessageSquare,
  User as UserIcon,
  ArrowRight,
  Trash2,
  CheckSquare,
  Square,
  Shield,
  Save,
  X
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Duty {
  date: number;
  userId: string;
  userName: string;
  type: 'weekday' | 'weekend';
  isHoliday?: boolean;
}

interface Notification {
  id: number;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  requestId?: string;
}

interface SwapRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  year: number;
  month: number;
  date: number;
  status: 'pending' | 'approved' | 'rejected';
}

import { requestNotificationPermission, showNotification, presentPwaInstall } from '../utils/notification';

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [duties, setDuties] = useState<Duty[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<number | null>(new Date().getDate());
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editProfileMode, setEditProfileMode] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', password: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  useEffect(() => {
    loadUserData();
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }

    // Check if PWA install prompt is available
    const checkPwa = () => {
      // Small delay to ensure the listener in App.tsx has caught the event
      setTimeout(() => {
        // This is a bit of a hack since we can't easily detect if the event fired
        // but we'll show the button if the window event was triggered.
        // For now we'll just listen locally too.
      }, 1000);
    };
    
    window.addEventListener('beforeinstallprompt', () => setCanInstallPwa(true));
    checkPwa();
    
    return () => window.removeEventListener('beforeinstallprompt', () => setCanInstallPwa(true));
  }, []);

  const handleInstallPwa = async () => {
    const installed = await presentPwaInstall();
    if (installed) {
      setCanInstallPwa(false);
      toast.success('앱 설치가 시작되었습니다.');
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationsEnabled(true);
      toast.success('알림이 활성화되었습니다.');
      showNotification('공당 알림 설정 완료', {
        body: '이제 당직 관련 알림을 브라우저에서 받아보실 수 있습니다.',
      });
    } else {
      toast.error('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
    }
  };

  useEffect(() => {
    if (token) {
      loadDuties(currentDate.getFullYear(), currentDate.getMonth() + 1);
      loadNotifications();
      loadSwapRequests();
    }
  }, [currentDate, token]);

  const loadUserData = async () => {
    try {
      const session = await api.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }

      setToken(session.access_token);
      
      try {
        const { user } = await api.getCurrentUser(session.access_token);
        setCurrentUser(user);
      } catch (userError: any) {
        console.error('Failed to load current user:', userError);
        await api.logout();
        navigate('/');
        return;
      }

      try {
        const { users: allUsers } = await api.getUsers(session.access_token);
        setUsers(allUsers);
      } catch (usersError: any) {
        setUsers([]);
      }
    } catch (error: any) {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadDuties = async (year: number, month: number) => {
    if (!token) return;
    try {
      const { duties: loadedDuties } = await api.getDuties(token, year, month);
      setDuties(loadedDuties || []);
    } catch (error: any) {
      setDuties([]);
    }
  };

  const loadNotifications = async () => {
    if (!token) return;
    try {
      const { notifications: loadedNotifications } = await api.getNotifications(token);
      setNotifications(loadedNotifications || []);
    } catch (error: any) {
      setNotifications([]);
    }
  };

  const loadSwapRequests = async () => {
    if (!token) return;
    try {
      const { requests } = await api.getSwapRequests(token);
      setSwapRequests(requests || []);
    } catch (error: any) {
      setSwapRequests([]);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    navigate('/');
  };

  const isKoreanHoliday = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const solarHolidays = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];
    if (solarHolidays.includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)) return true;
    const holidays = [
      '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-06', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
      '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-24', '2026-05-25', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-05'
    ];
    return holidays.includes(dateStr);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getDutyForDate = (date: number | null) => {
    if (!date) return null;
    return duties.find((d) => d.date === date);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedDate(null);
  };

  const handleSwapRequest = async () => {
    if (!selectedDate || !selectedUserId || !token) {
      toast.error('날짜와 교환할 사용자를 선택하세요.');
      return;
    }
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      await api.createSwapRequest(token, selectedUserId, year, month, selectedDate);
      toast.success('당직 교환 요청을 보냈습니다.');
      setSwapDialogOpen(false);
      setSelectedUserId('');
      loadSwapRequests();
    } catch (error: any) {
      toast.error(error.message || '교환 요청 실패');
    }
  };

  const handleMarkAsRead = async (notificationId: number) => {
    if (!token || isEditMode) return;
    try {
      await api.markNotificationAsRead(token, notificationId);
      loadNotifications();
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleProfileUpdate = async () => {
    if (!token || !profileForm.name.trim()) {
      toast.error('이름을 입력해주세요.');
      return;
    }
    
    setIsUpdatingProfile(true);
    try {
      await api.updateMe(token, {
        name: profileForm.name,
        password: profileForm.password || undefined
      });
      toast.success('프로필이 업데이트되었습니다.');
      setEditProfileMode(false);
      setProfileForm({ ...profileForm, password: '' });
      loadUserData();
    } catch (error: any) {
      toast.error(error.message || '업데이트 실패');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const toggleSelectNotification = (id: number) => {
    if (selectedNotifications.includes(id)) {
      setSelectedNotifications(selectedNotifications.filter(i => i !== id));
    } else {
      setSelectedNotifications([...selectedNotifications, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (!token || selectedNotifications.length === 0) return;
    try {
      await api.deleteNotifications(token, selectedNotifications);
      toast.success('선택한 알림이 삭제되었습니다.');
      setSelectedNotifications([]);
      setIsEditMode(false);
      loadNotifications();
    } catch (error: any) {
      toast.error('알림 삭제 실패');
    }
  };

  const handleDeleteAll = async () => {
    if (!token) return;
    if (!confirm('모든 알림을 삭제하시겠습니까?')) return;
    try {
      await api.deleteNotifications(token, [], true);
      toast.success('모든 알림이 삭제되었습니다.');
      setSelectedNotifications([]);
      setIsEditMode(false);
      loadNotifications();
    } catch (error: any) {
      toast.error('알림 삭제 실패');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pendingReceivedSwaps = swapRequests.filter(r => r.toUserId === currentUser?.id && r.status === 'pending');
  const hasPendingSwaps = pendingReceivedSwaps.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const days = getDaysInMonth();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const selectedDuty = getDutyForDate(selectedDate);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 overflow-x-hidden">
      {/* iOS/Android Status Bar / Notch Area Safe Area */}
      <div className="sticky top-0 z-40 bg-white h-10 w-full" />

      {/* Mobile Header */}
      <header className="sticky top-10 z-30 bg-white/80 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              공병반 당직 관리
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <Dialog open={notificationDialogOpen} onOpenChange={(open) => {
              setNotificationDialogOpen(open);
              if (!open) {
                setIsEditMode(false);
                setSelectedNotifications([]);
              }
            }}>
              <DialogTrigger asChild>
                <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden">
                <DialogHeader className="p-5 border-b bg-white flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <DialogTitle className="text-lg font-bold">알림 센터</DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">수신된 최신 알림을 확인하세요.</DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`text-xs font-bold rounded-xl h-8 ${isEditMode ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}
                        onClick={() => {
                          setIsEditMode(!isEditMode);
                          setSelectedNotifications([]);
                        }}
                      >
                        {isEditMode ? '취소' : '편집'}
                      </Button>
                    )}
                  </div>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                  {notifications.length === 0 ? (
                    <div className="py-20 text-center text-gray-400">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bell className="w-8 h-8 opacity-20" />
                      </div>
                      <p className="font-medium">새로운 알림이 없습니다.</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`group relative flex items-start gap-3 p-4 rounded-2xl border transition-all duration-200 ${
                          notification.read ? 'bg-white border-gray-100' : 'bg-white border-indigo-100 ring-1 ring-indigo-50 shadow-sm'
                        }`}
                        onClick={() => {
                          if (isEditMode) toggleSelectNotification(notification.id);
                          else handleMarkAsRead(notification.id);
                        }}
                      >
                        {isEditMode && (
                          <div className="mt-0.5">
                            {selectedNotifications.includes(notification.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-gray-300" />}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                             <div className="flex items-center gap-2">
                               {!notification.read && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
                               <p className={`text-sm font-bold ${notification.read ? 'text-gray-600' : 'text-gray-900'}`}>
                                 {notification.type === 'swap-request' ? '교환 요청' : '시스템 알림'}
                               </p>
                             </div>
                             <p className="text-[10px] text-gray-400 font-medium">{new Date(notification.createdAt).toLocaleDateString('ko-KR')}</p>
                          </div>
                          <p className={`text-sm leading-relaxed ${notification.read ? 'text-gray-400' : 'text-gray-700'}`}>{notification.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-4 border-t bg-white flex items-center gap-2">
                    {isEditMode ? (
                      <>
                        <Button variant="destructive" className="flex-1 rounded-xl h-12 font-bold bg-red-500 shadow-sm disabled:opacity-50" disabled={selectedNotifications.length === 0} onClick={handleDeleteSelected}>
                          <Trash2 className="w-4 h-4 mr-2" />{selectedNotifications.length}개 삭제
                        </Button>
                        <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold border-gray-100" onClick={() => setSelectedNotifications(selectedNotifications.length === notifications.length ? [] : notifications.map(n => n.id))}>
                          {selectedNotifications.length === notifications.length ? '전체 해제' : '전체 선택'}
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" className="w-full h-12 rounded-xl text-red-500 font-bold hover:bg-red-50 transition-colors" onClick={handleDeleteAll}>
                        <Trash2 className="w-4 h-4 mr-2" />모든 알림 전체 삭제
                      </Button>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Dialog open={profileDialogOpen} onOpenChange={(open) => {
              setProfileDialogOpen(open);
              if (open && currentUser) {
                setProfileForm({ name: currentUser.name, password: '' });
                setEditProfileMode(false);
              }
            }}>
              <DialogTrigger asChild>
                <button className="w-9 h-9 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100 shadow-sm active:scale-95 transition-transform cursor-pointer">
                  <div className="w-full h-full flex items-center justify-center font-bold text-indigo-600 text-xs">
                    {currentUser?.name.charAt(0)}
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden">
                <DialogHeader className="sr-only">
                  <DialogTitle>프로필 설정</DialogTitle>
                  <DialogDescription>사용자 프로필 정보를 확인하고 수정합니다.</DialogDescription>
                </DialogHeader>
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 text-white relative">
                   <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-4 ring-4 ring-white/10">
                        <UserIcon className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-1">{currentUser?.name}</h3>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider">
                         <Shield className="w-3 h-3" />
                         {currentUser?.role === 'admin' ? '관리자' : '일반 대원'}
                      </div>
                   </div>
                </div>

                <div className="p-6 space-y-4 bg-white">
                  {editProfileMode ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">이름</label>
                         <Input 
                           value={profileForm.name} 
                           onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                           className="h-12 rounded-xl border-gray-100 bg-gray-50 focus:ring-indigo-500"
                           placeholder="변경할 이름을 입력하세요"
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">새 비밀번호 (선택)</label>
                         <Input 
                           type="password"
                           value={profileForm.password} 
                           onChange={(e) => setProfileForm({...profileForm, password: e.target.value})}
                           className="h-12 rounded-xl border-gray-100 bg-gray-50 focus:ring-indigo-500"
                           placeholder="변경 시에만 입력"
                         />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button onClick={handleProfileUpdate} disabled={isUpdatingProfile} className="flex-1 h-12 rounded-xl bg-indigo-600 font-bold">
                          <Save className="w-4 h-4 mr-2" /> {isUpdatingProfile ? '저장 중...' : '변경사항 저장'}
                        </Button>
                        <Button variant="ghost" onClick={() => setEditProfileMode(false)} className="h-12 rounded-xl text-gray-400 px-6">취소</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <Button 
                         variant="ghost" 
                         onClick={() => setEditProfileMode(true)}
                         className="w-full h-14 justify-start px-4 rounded-2xl hover:bg-gray-50 text-gray-700 font-bold group"
                       >
                         <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Settings className="w-5 h-5" />
                         </div>
                         개인정보변경
                       </Button>
                       <div className="h-px bg-gray-50 mx-2" />
                       <Button 
                         variant="ghost" 
                         onClick={handleEnableNotifications}
                         disabled={notificationsEnabled}
                         className={`w-full h-14 justify-start px-4 rounded-2xl hover:bg-indigo-50 font-bold group ${notificationsEnabled ? 'opacity-60 grayscale' : 'text-indigo-600'}`}
                       >
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-colors ${notificationsEnabled ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 group-hover:bg-indigo-100'}`}>
                            <Bell className="w-5 h-5" />
                         </div>
                         {notificationsEnabled ? '알림 활성화됨' : '브라우저 알림 설정'}
                       </Button>
                       <div className="h-px bg-gray-50 mx-2" />
                       <Button 
                         variant="ghost" 
                         onClick={handleLogout}
                         className="w-full h-14 justify-start px-4 rounded-2xl hover:bg-red-50 text-red-500 font-bold group"
                       >
                         <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mr-4 group-hover:bg-red-100 transition-colors">
                            <LogOut className="w-5 h-5" />
                         </div>
                         로그아웃
                       </Button>
                    </div>
                  )}
                  {!editProfileMode && (
                    <Button variant="ghost" onClick={() => setProfileDialogOpen(false)} className="w-full h-12 rounded-xl text-gray-400 font-medium">닫기</Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="max-w-lg mx-auto w-full relative">
        <div className="px-4 py-4 space-y-4">
          {/* PWA Install Prompt */}
          <AnimatePresence>
            {canInstallPwa && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between shadow-sm overflow-hidden"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-600 rounded-xl">
                    <CalendarDays className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-indigo-900 font-bold text-sm">홈 화면에 추가</h3>
                    <p className="text-indigo-600 text-[10px] font-medium leading-tight">앱으로 사용하면 더욱 편리합니다.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button size="sm" onClick={handleInstallPwa} className="rounded-xl h-8 bg-indigo-600 text-xs font-bold px-4">설치</Button>
                   <button onClick={() => setCanInstallPwa(false)} className="p-1 text-indigo-300 hover:text-indigo-500"><X className="w-4 h-4" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pending Swap Requests Alert */}
          <AnimatePresence>
            {hasPendingSwaps && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => navigate('/swap-requests')}
                className="bg-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-100 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                     <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">새로운 당직 교환 요청</h3>
                    <p className="text-indigo-100 text-xs">{pendingReceivedSwaps.length}건의 대기 중인 요청이 있습니다.</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/50" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Month Selector */}
          <div className="flex items-center justify-between bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <Button variant="ghost" size="icon" onClick={previousMonth} className="rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <h2 className="text-base font-bold text-gray-900">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-xl">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1">
                {dayNames.map((day, index) => (
                  <div key={day} className={`text-center text-[10px] font-bold py-2 uppercase tracking-widest ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{day}</div>
                ))}
                {getDaysInMonth().map((day, index) => {
                  const duty = getDutyForDate(day);
                  const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                  const isSelected = selectedDate === day;
                  const isMyDuty = duty?.userId === currentUser?.id;
                  return (
                    <div
                      key={index}
                      className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative ${!day ? 'invisible' : 'cursor-pointer'} ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : isToday ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200' : 'hover:bg-gray-50'}`}
                      onClick={() => day && setSelectedDate(day)}
                    >
                      {day && (
                        <>
                          <span className={`text-sm font-bold ${isSelected ? 'text-white' : (index % 7 === 0 || isKoreanHoliday(currentDate.getFullYear(), currentDate.getMonth() + 1, day)) ? 'text-red-500' : index % 7 === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</span>
                          {duty && !isSelected && (
                            <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isMyDuty ? 'bg-orange-500 animate-pulse' : duty.type === 'weekend' ? 'bg-red-400' : 'bg-gray-300'}`} />
                          )}
                          {isSelected && duty && <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full" />}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Info */}
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-gray-50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><CalendarIcon className="w-4 h-4 text-indigo-600" /></div>
                <CardTitle className="text-base font-bold">{selectedDate ? `${currentDate.getMonth() + 1}월 ${selectedDate}일 상세` : '날짜를 선택하세요'}</CardTitle>
              </div>
              {selectedDate && (
                <div className="flex gap-1">
                  {isKoreanHoliday(currentDate.getFullYear(), currentDate.getMonth() + 1, selectedDate) && <Badge variant="destructive" className="bg-red-500 rounded-lg px-2 py-0.5 text-[10px]">공휴일</Badge>}
                  {selectedDuty && <Badge variant={selectedDuty.type === 'weekend' ? 'destructive' : 'secondary'} className="rounded-lg px-2 py-0.5 text-[10px]">{selectedDuty.type === 'weekend' ? '주말 순번' : '평일 순번'}</Badge>}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-4">
              {selectedDate ? (
                selectedDuty ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">{selectedDuty.userName.charAt(0)}</div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">담당자</p>
                        <p className="text-sm font-bold text-gray-900">{selectedDuty.userName}</p>
                      </div>
                    </div>
                    {selectedDuty.userId === currentUser?.id ? <Badge className="bg-orange-500 hover:bg-orange-600">내 당직</Badge> : (
                      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="rounded-xl text-xs h-8">교환 요청</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md w-[90vw] rounded-3xl p-6">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-bold">당직 교환 요청</DialogTitle>
                            <DialogDescription>{selectedDate}일 당직을 교환할 사용자를 선택하세요.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6 py-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">교환할 사용자</Label>
                              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger className="h-12 rounded-xl border-gray-100 bg-gray-50"><SelectValue placeholder="사용자 선택" /></SelectTrigger>
                                <SelectContent className="rounded-2xl border-gray-100 shadow-xl">
                                  {users.filter(u => u.id !== currentUser?.id).map(user => (
                                    <SelectItem key={user.id} value={user.id} className="rounded-lg">{user.name} ({user.email})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-col space-y-2">
                              <Button onClick={handleSwapRequest} className="h-12 rounded-xl bg-indigo-600 font-bold">요청 보내기</Button>
                              <Button variant="ghost" onClick={() => setSwapDialogOpen(false)} className="h-12 rounded-xl text-gray-500 font-medium">취소</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                ) : <div className="py-4 text-center"><p className="text-sm text-gray-400">배정된 당직이 없습니다.</p></div>
              ) : <p className="text-sm text-center text-gray-400 py-4">캘린더에서 날짜를 터치하여 정보를 확인하세요.</p>}
            </CardContent>
          </Card>

          {/* Quick Actions (Admin Only) */}
          {currentUser?.role === 'admin' && (
            <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 rounded-2xl shadow-md shadow-indigo-100" onClick={() => navigate('/generate')}>
              <Settings className="w-4 h-4 mr-2" />이번 달 당직 자동 생성
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t px-6 py-2 flex items-center justify-between max-w-lg mx-auto w-full h-16 rounded-t-3xl shadow-2xl">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center justify-center space-y-1 flex-1 transition-colors text-indigo-600">
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">일정</span>
        </button>
        <button onClick={() => navigate('/swap-requests')} className="flex flex-col items-center justify-center space-y-1 text-gray-400 hover:text-indigo-500 transition-colors flex-1 relative">
          <div className="relative">
            <MessageSquare className="w-6 h-6" />
            {hasPendingSwaps && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">교환</span>
        </button>
        {currentUser?.role === 'admin' && (
          <button onClick={() => navigate('/generate')} className="flex flex-col items-center justify-center space-y-1 text-gray-400 hover:text-indigo-500 transition-colors flex-1">
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">관리</span>
          </button>
        )}
      </nav>
    </div>
  );
}
