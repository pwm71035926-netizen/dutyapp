import { useState, useEffect, useContext, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { NavigationContext } from '../context/NavigationContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings as SettingsIcon,
  Bell,
  RefreshCw,
  Calendar as CalendarIcon,
  User as UserIcon,
  Trash2,
  CheckSquare,
  Square,
  Shield,
  Save,
  PlusCircle,
  ArrowLeftRight,
  ShieldCheck,
  Loader2,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, showNotification, presentPwaInstall, setDeferredPrompt } from '../utils/notification';
import { PullToRefresh } from '../components/PullToRefresh';

// Memoized Calendar Day for high performance
const CalendarDay = memo(({ 
  day, 
  duty, 
  isSelected, 
  isToday, 
  isHoliday, 
  onClick, 
  index 
}: { 
  day: number | null, 
  duty: any, 
  isSelected: boolean, 
  isToday: boolean, 
  isHoliday: boolean, 
  onClick: (day: number) => void,
  index: number
}) => {
  if (!day) return <div className="aspect-square invisible" />;
  
  const isMyDuty = duty?.isMyDuty;

  return (
    <div
      className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative cursor-pointer active:scale-90 select-none ${
        isSelected 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : isToday 
            ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200' 
            : 'hover:bg-gray-50'
      }`}
      onClick={() => onClick(day)}
    >
      <span className={`text-sm font-bold ${
        isSelected 
          ? 'text-white' 
          : (index % 7 === 0 || isHoliday) 
            ? 'text-red-500' 
            : index % 7 === 6 
              ? 'text-blue-500' 
              : 'text-gray-700'
      }`}>
        {day}
      </span>
      {duty && !isSelected && (
        <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isMyDuty ? 'bg-indigo-500 animate-pulse' : duty.type === 'weekend' ? 'bg-red-400' : 'bg-gray-300'}`} />
      )}
      {isSelected && duty && <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full" />}
    </div>
  );
});

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  username?: string;
  serviceNumber?: string;
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { startNavigation } = useContext(NavigationContext);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [duties, setDuties] = useState<Duty[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  const [selectedDate, setSelectedDate] = useState<number | null>(new Date().getDate());
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editProfileMode, setEditProfileMode] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', password: '', serviceNumber: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dutyPrices, setDutyPrices] = useState({ weekday: 30000, weekend: 100000 });

  // Confirmation dialog states
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: 'default' | 'destructive';
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'default'
  });

  // Memoized Calendar Calculations
  const daysInMonthList = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const result = [];
    for (let i = 0; i < startingDayOfWeek; i++) result.push(null);
    for (let i = 1; i <= totalDays; i++) result.push(i);
    return result;
  }, [currentDate]);

  const dutyMap = useMemo(() => {
    const map = new Map<number, Duty & { isMyDuty: boolean }>();
    duties.forEach(d => {
      map.set(d.date, { ...d, isMyDuty: d.userId === currentUser?.id });
    });
    return map;
  }, [duties, currentUser?.id]);

  const myMonthlyStats = useMemo(() => {
    if (!currentUser) return { weekday: 0, weekend: 0, total: 0 };
    let weekday = 0;
    let weekend = 0;
    duties.forEach(d => {
      if (d.userId === currentUser.id) {
        if (d.type === 'weekend') weekend++;
        else weekday++;
      }
    });
    return {
      weekday,
      weekend,
      total: (weekday * dutyPrices.weekday) + (weekend * dutyPrices.weekend)
    };
  }, [duties, currentUser, dutyPrices]);

  useEffect(() => {
    loadUserData();
    loadPrices();
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
    
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPwa(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const loadPrices = async () => {
    try {
      const prices = await api.getDutyPrices();
      setDutyPrices(prices);
    } catch (error) {
      console.error('Failed to load prices:', error);
    }
  };

  const handleInstallPwa = async () => {
    const installed = await presentPwaInstall();
    if (installed) {
      setCanInstallPwa(false);
      toast.success('앱 설치가 시작되었습니다.');
    }
  };

  const handleRefresh = async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadDuties(currentDate.getFullYear(), currentDate.getMonth() + 1),
        loadNotifications(),
        loadSwapRequests()
      ]);
      toast.success('데이터가 새로고침되었습니다.');
    } catch (error) {
      toast.error('새로고침 실패');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePullRefresh = useCallback(async () => {
    if (!token) return;
    try {
      await Promise.all([
        loadDuties(currentDate.getFullYear(), currentDate.getMonth() + 1),
        loadNotifications(),
        loadSwapRequests()
      ]);
      toast.success('데이터가 새로고침되었습니다.');
    } catch (error) {
      toast.error('새로고침 실패');
    }
  }, [token, currentDate]);

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
        startNavigation('/', navigate);
        return;
      }

      setToken(session.access_token);
      
      try {
        const { user } = await api.getCurrentUser(session.access_token);
        setCurrentUser(user);
      } catch (userError: any) {
        console.error('Failed to load current user:', userError);
        await api.logout();
        startNavigation('/', navigate);
        return;
      }

      try {
        const { users: allUsers } = await api.getUsers(session.access_token);
        setUsers(allUsers);
      } catch (usersError: any) {
        setUsers([]);
      }
    } catch (error: any) {
      startNavigation('/', navigate);
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

  const isKoreanHoliday = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const solarHolidays = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];
    if (solarHolidays.includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)) return true;
    const holidays = [
      '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-06', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
      '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-24', '2026-05-25', '2026-06-03', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-05'
    ];
    
    // Check if the duty for this day is marked as a custom holiday
    const duty = duties.find(d => d.date === day);
    if (duty?.isHoliday) return true;

    return holidays.includes(dateStr);
  };

  const previousMonth = () => {
    setDirection(-1);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setDirection(1);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedDate(null);
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
        password: profileForm.password || undefined,
        serviceNumber: profileForm.serviceNumber || undefined
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
    setConfirmState({
      open: true,
      title: '모든 알림 삭제',
      description: '정말로 모든 알림을 삭제하시겠습니까? 삭제된 알림은 복구할 수 없습니다.',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await api.deleteNotifications(token, [], true);
          toast.success('모든 알림이 삭제되었습니다.');
          setSelectedNotifications([]);
          setIsEditMode(false);
          loadNotifications();
        } catch (error: any) {
          toast.error('알림 삭제 실패');
        }
      }
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pendingReceivedSwaps = swapRequests.filter(r => r.toUserId === currentUser?.id && r.status === 'pending');
  const hasPendingSwaps = pendingReceivedSwaps.length > 0;

  // Memoized callback for CalendarDay onClick to prevent re-renders
  const handleCalendarDayClick = useCallback((day: number) => {
    setSelectedDate(day);
  }, []);

  // Memoize holiday lookup for current month
  const holidaySet = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const set = new Set<number>();
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      if (isKoreanHoliday(year, month, d)) set.add(d);
    }
    return set;
  }, [currentDate, duties]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">불러오는 중...</p>
        </div>
      </div>
    );
  }

  const selectedDuty = selectedDate ? dutyMap.get(selectedDate) : null;

  return (
    <>
    {/* iOS/Android Safe Area Spacer */}
    <div className="fixed top-0 left-0 right-0 z-50 bg-white safe-top-spacer" />

    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="min-h-screen bg-gray-50 content-bottom-safe select-none touch-pan-y">
      
      {/* Header */}
      <div className="sticky top-safe z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 active:scale-95 transition-transform" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col items-start">
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-tight">공당</h1>
            <span className="text-[9px] font-bold text-gray-400 -mt-0.5 tracking-tighter">Product by wonmin</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
            {canInstallPwa && (
               <button onClick={handleInstallPwa} className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center border border-green-100 text-green-600">
                 <PlusCircle className="w-4 h-4" />
               </button>
            )}
            <Dialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="relative w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
                  <Bell className="w-4 h-4 text-gray-600" />
                  {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white" />}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md w-[95vw] rounded-3xl p-0 overflow-hidden bg-white top-[50%]">
                 <DialogHeader className="p-5 border-b border-gray-100 bg-white flex flex-row items-center justify-between">
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
                  <div className="p-4 border-t border-gray-100 bg-white flex items-center gap-2">
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
            <Popover open={profileDialogOpen} onOpenChange={(open) => {
              setProfileDialogOpen(open);
              if (open && currentUser) {
                setProfileForm({ 
                  name: currentUser.name, 
                  password: '', 
                  serviceNumber: currentUser.serviceNumber || '' 
                });
                setEditProfileMode(false);
              }
            }}>
              <PopoverTrigger asChild>
                <Button className="w-9 h-9 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100 shadow-sm active:scale-95 transition-transform cursor-pointer overflow-hidden ring-2 ring-transparent hover:ring-indigo-200 p-0">
                  <div className="w-full h-full flex items-center justify-center font-bold text-indigo-600 text-xs">
                    {currentUser?.name.charAt(0)}
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-[85vw] sm:w-80 rounded-3xl p-0 overflow-hidden bg-white border-none shadow-2xl animate-in zoom-in-95 duration-200 origin-top-right">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 text-white relative">
                   <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 ring-4 ring-white/10">
                        <UserIcon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-lg font-bold mb-0.5">{currentUser?.name}</h3>
                      <p className="text-[9px] font-black tracking-widest text-white/60 mb-2">{currentUser?.serviceNumber || '군번 미등록'}</p>
                      <div className="flex items-center gap-1.2 px-2.5 py-0.5 bg-white/10 rounded-full text-[9px] font-bold uppercase tracking-wider">
                         <Shield className="w-2.5 h-2.5" />
                         {currentUser?.role === 'admin' ? '관리자' : '일반사용자'}
                      </div>
                      <p className="text-[9px] font-bold text-white/40 mt-2 tracking-wider">v1.1.2</p>
                   </div>
                </div>

                <div className="p-4 space-y-3 bg-white">
                  {editProfileMode ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">이름</label>
                         <Input 
                           value={profileForm.name} 
                           onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                           className="h-10 rounded-xl border-gray-100 bg-gray-50 focus:ring-indigo-500 text-sm"
                           placeholder="변경할 이름을 입력하세요"
                         />
                      </div>
                        {currentUser?.role === 'admin' && (
                         <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">군번</label>
                            <Input 
                              value={profileForm.serviceNumber} 
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                let formatted = val;
                                if (val.length > 2) {
                                  formatted = val.slice(0, 2) + '-' + val.slice(2, 8);
                                }
                                setProfileForm({...profileForm, serviceNumber: formatted});
                              }}
                              className="h-10 rounded-xl border-gray-100 bg-gray-50 focus:ring-indigo-500 font-mono text-sm"
                              placeholder="00-000000"
                            />
                         </div>
                        )}
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">새 비밀번호 (선택)</label>
                         <Input 
                           type="password"
                           value={profileForm.password} 
                           onChange={(e) => setProfileForm({...profileForm, password: e.target.value})}
                           className="h-10 rounded-xl border-gray-100 bg-gray-50 focus:ring-indigo-500 text-sm"
                           placeholder="변경 시에만 입력"
                         />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button onClick={handleProfileUpdate} disabled={isUpdatingProfile} size="sm" className="flex-1 h-10 rounded-xl bg-indigo-600 font-bold text-white text-xs">
                          <Save className="w-3.5 h-3.5 mr-1.5" /> {isUpdatingProfile ? '저장' : '저장'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditProfileMode(false)} className="h-10 rounded-xl text-gray-400 px-4 text-xs">취소</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                       <Button 
                         variant="ghost" 
                         onClick={() => setEditProfileMode(true)}
                         className="w-full h-12 justify-start px-3 rounded-2xl hover:bg-gray-50 text-gray-700 font-bold group text-sm"
                       >
                         <SettingsIcon className="w-4 h-4 mr-3 text-gray-400 group-hover:text-indigo-600 transition-colors" /> 프로필 수정
                       </Button>
                       <Button 
                         variant="ghost" 
                         onClick={handleRefresh}
                         disabled={isRefreshing}
                         className="w-full h-12 justify-start px-3 rounded-2xl hover:bg-gray-50 text-gray-700 font-bold group text-sm"
                       >
                         <RefreshCw className={`w-4 h-4 mr-3 text-gray-400 group-hover:text-indigo-600 transition-colors ${isRefreshing ? 'animate-spin' : ''}`} /> 데이터 새로고침
                       </Button>
                       {currentUser?.role === 'admin' && (
                         <Button 
                           variant="ghost" 
                           onClick={() => startNavigation('/admin', navigate)}
                           className="w-full h-12 justify-start px-3 rounded-2xl hover:bg-gray-50 text-indigo-600 font-bold group text-sm"
                         >
                           <ShieldCheck className="w-4 h-4 mr-3" /> 관리자 도구
                         </Button>
                       )}
                       <div className="h-px bg-gray-100 my-1 mx-2" />
                       <Button 
                         variant="ghost" 
                         onClick={api.logout}
                         className="w-full h-12 justify-start px-3 rounded-2xl hover:bg-red-50 text-red-500 font-bold group text-sm"
                       >
                         <LogOut className="w-4 h-4 mr-3" /> 로그아웃
                       </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">{currentUser?.name}님,</h2>
          <p className="text-gray-500 font-medium">오늘도 부대를 위해 수고하십니다.</p>
        </div>

        <div className="space-y-6">
          {/* Month Navigator */}
          <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
            <button onClick={previousMonth} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 active:scale-95 transition-all"><ChevronLeft className="w-6 h-6" /></button>
            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{currentDate.getFullYear()}년</span>
              <span className="text-lg font-bold text-gray-900">{currentDate.getMonth() + 1}월</span>
            </div>
            <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 active:scale-95 transition-all"><ChevronRight className="w-6 h-6" /></button>
          </div>

          {/* Calendar Card */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardContent className="p-4 min-h-[340px] flex flex-col">
              <div className="grid grid-cols-7 mb-4">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                  <span key={i} className={`text-[10px] font-black text-center uppercase tracking-widest ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{day}</span>
                ))}
              </div>
              <div className="relative flex-1">
                <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                      key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
                      initial={{ x: direction > 0 ? 50 : -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: direction > 0 ? -50 : 50, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      className="grid grid-cols-7 gap-1.5"
                    >
                      {(() => {
                        const today = new Date();
                        const todayDate = today.getDate();
                        const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
                        return daysInMonthList.map((day, index) => (
                          <CalendarDay
                            key={index}
                            index={index}
                            day={day}
                            duty={day ? dutyMap.get(day) : null}
                            isSelected={selectedDate === day}
                            isToday={isCurrentMonth && day === todayDate}
                            isHoliday={day ? holidaySet.has(day) : false}
                            onClick={handleCalendarDayClick}
                          />
                        ));
                      })()}
                    </motion.div>
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Info */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
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
                (() => {
                  const selectedDuty = dutyMap.get(selectedDate);
                  return selectedDuty ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">{selectedDuty.userName.charAt(0)}</div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium">근무자</p>
                            <p className="text-sm font-bold text-gray-900">{selectedDuty.userName}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">예상 수당</p>
                          <p className="text-sm font-black text-indigo-600">
                            {selectedDuty.type === 'weekend' 
                              ? dutyPrices.weekend.toLocaleString() 
                              : dutyPrices.weekday.toLocaleString()}원
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {selectedDuty.userId === currentUser?.id && <Badge className="bg-indigo-500 text-white rounded-lg px-2 py-0.5 text-[10px]">내 당직</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedDuty.userId === currentUser?.id && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="rounded-xl text-xs h-8"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  fromDate: String(selectedDate),
                                  year: String(currentDate.getFullYear()),
                                  month: String(currentDate.getMonth() + 1),
                                });
                                startNavigation(`/swap-requests?${params.toString()}`, navigate);
                              }}
                            >
                              <ArrowLeftRight className="w-3 h-3 mr-1" />
                              교환 요청
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : <div className="py-4 text-center"><p className="text-sm text-gray-400">배정된 당직이 없습니다.</p></div>
                })()
              ) : <p className="text-sm text-center text-gray-400 py-4 font-medium">캘린더에서 날짜를 터치하여 정보를 확인하세요.</p>}
            </CardContent>
          </Card>

          {/* Monthly Settlement Card */}
          <Card className="border-none shadow-xl rounded-3xl bg-indigo-600 overflow-hidden text-white relative">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Wallet className="w-20 h-20 rotate-12" />
            </div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base font-bold tracking-tight">월간 당직비 결산</h3>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-white/70 font-medium">
                  {currentDate.getMonth() + 1}월 정산 (평일 { (dutyPrices.weekday / 10000).toFixed(1) }, 주말 { (dutyPrices.weekend / 10000).toFixed(1) })
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black">{myMonthlyStats.total.toLocaleString()}원</span>
                  <span className="text-xs font-bold text-white/80">지급예정</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/60 uppercase">평일 근무</span>
                    <span className="text-sm font-black">{myMonthlyStats.weekday}회</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/60 uppercase">주말 근무</span>
                    <span className="text-sm font-black">{myMonthlyStats.weekend}회</span>
                  </div>
                </div>
                <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Total {myMonthlyStats.weekday + myMonthlyStats.weekend}회
                </div>
              </div>
              <p className="mt-4 text-[10px] font-bold text-white/50 bg-black/10 p-2 rounded-xl text-center">
                {currentDate.getMonth() + 1}월에는 평일 {myMonthlyStats.weekday}회, 주말 {myMonthlyStats.weekend}회 총 {myMonthlyStats.total.toLocaleString()}원 지급예정
              </p>
            </CardContent>
          </Card>

          {/* Quick Actions (Admin Only) */}
          {currentUser?.role === 'admin' && (
            <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-700 h-14 rounded-2xl shadow-xl shadow-indigo-100 font-bold text-white" onClick={() => startNavigation('/admin', navigate)}>
              <SettingsIcon className="w-5 h-5 mr-2" />당직 자동 생성 도구
            </Button>
          )}
        </div>
      </div>

    </div>
    </PullToRefresh>

    {/* Mobile Bottom Navigation */}
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white backdrop-blur-md border-t border-gray-100 px-6 pt-2 flex items-center justify-between max-w-lg mx-auto w-full rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] nav-bottom-safe" style={{ minHeight: '80px' }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center justify-center space-y-1.5 flex-1 transition-all text-indigo-600 active:scale-90">
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-tight">당직일정</span>
        </button>
        <button onClick={() => startNavigation('/swap-requests', navigate)} className="flex flex-col items-center justify-center space-y-1.5 text-gray-400 hover:text-indigo-500 active:scale-90 transition-all flex-1 relative">
          <div className="relative">
            <ArrowLeftRight className="w-6 h-6" />
            {hasPendingSwaps && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />}
          </div>
          <span className="text-[10px] font-black uppercase tracking-tight">당직교환</span>
        </button>
        {currentUser?.role === 'admin' && (
          <button onClick={() => startNavigation('/admin', navigate)} className="flex flex-col items-center justify-center space-y-1.5 text-gray-400 hover:text-indigo-500 active:scale-90 transition-all flex-1">
            <SettingsIcon className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-tight">관리도구</span>
          </button>
        )}
      </nav>

      {/* iOS Safe Area Bottom Fill — prevents scrolled content from showing below nav */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />

      <ConfirmDialog 
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState({ ...confirmState, open })}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
        variant={confirmState.variant}
      />
    </>
  );
}