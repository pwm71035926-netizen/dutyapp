import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { NavigationContext } from '../context/NavigationContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

import { toast } from 'sonner';
import { 
  ArrowLeft, 
  CalendarPlus, 

  Info, 

  Users, 
  ShieldCheck, 
  Trash2, 
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  X,
  Wallet,
  Settings as SettingsIcon,

  CalendarDays,
  Save,
  Loader2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { ConfirmDialog } from '../components/ui/confirm-dialog';

import { Badge } from '../components/ui/badge';

interface User {
  id: string;
  username?: string;
  email?: string;
  name: string;
  role: string;
  serviceNumber?: string;
}

export default function GenerateSchedule() {
  const navigate = useNavigate();
  const { startNavigation } = useContext(NavigationContext);
  const [activeTab, setActiveTab] = useState<'schedule' | 'users' | 'settings' | 'duty-edit'>('schedule');
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  
  // States for ordered sequences
  const [weekdaySequence, setWeekdaySequence] = useState<string[]>([]);
  const [weekendSequence, setWeekendSequence] = useState<string[]>([]);
  
  // States for starting person selection
  const [weekdayStartUserId, setWeekdayStartUserId] = useState<string>('');
  const [weekendStartUserId, setWeekendStartUserId] = useState<string>('');
  
  // Friday as weekend toggle (default: true = 금요일을 주말근무로 편성)
  const [fridayAsWeekend, setFridayAsWeekend] = useState<boolean>(true);
  
  // States for exclusion periods
  const [exclusions, setExclusions] = useState<{userId: string, startDate: string, endDate: string}[]>([]);
  const [newExclusion, setNewExclusion] = useState({ 
    userId: '', 
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1,
    startDay: new Date().getDate(),
    endYear: new Date().getFullYear(),
    endMonth: new Date().getMonth() + 1,
    endDay: new Date().getDate()
  });

  // States for custom holidays
  const [customHolidays, setCustomHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate()
  });
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // State for editing service number
  const [editingServiceNumber, setEditingServiceNumber] = useState<{userId: string, value: string} | null>(null);

  // States for duty prices
  const [dutyPrices, setDutyPrices] = useState({ weekday: 30000, weekend: 100000 });
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Duty edit states
  const [editYear, setEditYear] = useState(new Date().getFullYear());
  const [editMonth, setEditMonth] = useState(new Date().getMonth() + 1);
  const [editDuties, setEditDuties] = useState<any[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [selectedEditDay, setSelectedEditDay] = useState<number | null>(null);
  const [editHasChanges, setEditHasChanges] = useState(false);

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

  useEffect(() => {
    loadData();
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const prices = await api.getDutyPrices();
      setDutyPrices(prices);
    } catch (error) {
      console.error('Failed to load prices:', error);
    }
  };

  const handleUpdatePrices = async () => {
    if (!token) return;
    setIsUpdatingPrices(true);
    try {
      await api.updateDutyPrices(token, dutyPrices.weekday, dutyPrices.weekend);
      toast.success('당직비 단가가 수정되었습니다.');
    } catch (error: any) {
      toast.error(error.message || '단가 수정 실패');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const loadData = async () => {
    try {
      const session = await api.getSession();
      if (!session) {
        startNavigation('/', navigate);
        return;
      }

      setToken(session.access_token);
      const { user } = await api.getCurrentUser(session.access_token);
      setCurrentUser(user);
      
      if (user.role !== 'admin') {
        toast.error('관리자만 접근할 수 있습니다.');
        startNavigation('/dashboard', navigate);
        return;
      }

      const { users: allUsers } = await api.getUsers(session.access_token);
      // 군번 순 정렬 로직 (연도-순번)
      const sortedUsers = [...allUsers].sort((a, b) => {
        if (!a.serviceNumber) return 1;
        if (!b.serviceNumber) return -1;
        
        const [yearA, seqA] = a.serviceNumber.split('-').map(Number);
        const [yearB, seqB] = b.serviceNumber.split('-').map(Number);
        
        if (yearA !== yearB) return yearA - yearB;
        return seqA - seqB;
      });
      setUsers(sortedUsers);

      // 모든 사용자를 자동으로 평일/주말 순번에 포함
      const allIds = sortedUsers.map(u => u.id);
      setWeekdaySequence(sortByServiceNumberFromList(allIds, 'asc', sortedUsers));
      setWeekendSequence(sortByServiceNumberFromList(allIds, 'asc', sortedUsers));
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('데이터를 불러오지 못했습니다.');
      startNavigation('/dashboard', navigate);
    }
  };

  // Helper: sort user IDs by service number using a provided user list
  const sortByServiceNumberFromList = (userIds: string[], direction: 'asc' | 'desc', userList: User[]): string[] => {
    return [...userIds].sort((a, b) => {
      const userA = userList.find(u => u.id === a);
      const userB = userList.find(u => u.id === b);
      if (!userA?.serviceNumber) return 1;
      if (!userB?.serviceNumber) return -1;
      const [yearA, seqA] = userA.serviceNumber.split('-').map(Number);
      const [yearB, seqB] = userB.serviceNumber.split('-').map(Number);
      const cmp = yearA !== yearB ? yearA - yearB : seqA - seqB;
      return direction === 'asc' ? cmp : -cmp;
    });
  };

  const handleSaveServiceNumber = async () => {
    if (!token || !editingServiceNumber) return;
    setActionLoading(editingServiceNumber.userId);
    try {
      await api.updateUserServiceNumber(token, editingServiceNumber.userId, editingServiceNumber.value);
      toast.success('군번이 수정되었습니다.');
      setEditingServiceNumber(null);
      const { users: allUsers } = await api.getUsers(token);
      const sortedUsers = [...allUsers].sort((a: User, b: User) => {
        if (!a.serviceNumber) return 1;
        if (!b.serviceNumber) return -1;
        const [yearA, seqA] = a.serviceNumber.split('-').map(Number);
        const [yearB, seqB] = b.serviceNumber.split('-').map(Number);
        if (yearA !== yearB) return yearA - yearB;
        return seqA - seqB;
      });
      setUsers(sortedUsers);
    } catch (error: any) {
      toast.error(error.message || '군번 수정 실패');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    if (!token) return;
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const title = newRole === 'admin' ? '관리자 지정' : '관리자 해제';
    const description = newRole === 'admin' 
      ? '해당 사용자를 관리자로 지정하시겠습니까? 모든 관리 권한이 부여됩니다.' 
      : '해당 사용자의 관리자 권한을 해제하시겠습니까?';
    
    setConfirmState({
      open: true,
      title,
      description,
      variant: 'default',
      onConfirm: async () => {
        setActionLoading(userId);
        try {
          await api.updateUserRole(token, userId, newRole);
          toast.success('권한이 변경되었습니다.');
          const { users: allUsers } = await api.getUsers(token);
          setUsers(allUsers);
        } catch (error: any) {
          toast.error(error.message || '권한 변경 실패');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) return;
    if (userId === currentUser?.id) {
      toast.error('자기 자신은 삭제할 수 없습니다.');
      return;
    }

    setConfirmState({
      open: true,
      title: '사용자 삭제',
      description: '정말로 이 사용자를 삭제하시겠습니까? 관련 데이터는 유지되지만 로그인이 불가능해집니다.',
      variant: 'destructive',
      onConfirm: async () => {
        setActionLoading(userId);
        try {
          await api.deleteUser(token, userId);
          toast.success('사용자가 삭제되었습니다.');
          const { users: allUsers } = await api.getUsers(token);
          setUsers(allUsers);
        } catch (error: any) {
          toast.error(error.message || '삭제 실패');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleBulkDeleteNonAdmins = async () => {
    if (!token) return;
    
    const nonAdmins = users.filter(u => u.role !== 'admin');
    if (nonAdmins.length === 0) {
      toast.info('삭제할 일반 사용자가 없습니다.');
      return;
    }

    setConfirmState({
      open: true,
      title: '일반 사용자 일괄 삭제',
      description: `관리자를 제외한 모든 사용자(${nonAdmins.length}명)를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 일반사용자는 즉시 로그인이 차단됩니다.`,
      variant: 'destructive',
      onConfirm: async () => {
        setLoading(true);
        try {
          const result = await api.bulkDeleteNonAdmins(token);
          toast.success(result.message);
          const { users: allUsers } = await api.getUsers(token);
          setUsers(allUsers);
        } catch (error: any) {
          toast.error(error.message || '일괄 삭제 실패');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Helper: sort user IDs by service number
  const sortByServiceNumber = (userIds: string[], direction: 'asc' | 'desc'): string[] => {
    return [...userIds].sort((a, b) => {
      const userA = users.find(u => u.id === a);
      const userB = users.find(u => u.id === b);
      if (!userA?.serviceNumber) return 1;
      if (!userB?.serviceNumber) return -1;
      const [yearA, seqA] = userA.serviceNumber.split('-').map(Number);
      const [yearB, seqB] = userB.serviceNumber.split('-').map(Number);
      const cmp = yearA !== yearB ? yearA - yearB : seqA - seqB;
      return direction === 'asc' ? cmp : -cmp;
    });
  };

  // Helper: rotate array so startId is first
  const rotateSequence = (sortedIds: string[], startId: string): string[] => {
    if (!startId || !sortedIds.includes(startId)) return sortedIds;
    const idx = sortedIds.indexOf(startId);
    return [...sortedIds.slice(idx), ...sortedIds.slice(0, idx)];
  };

  // Get the final ordered sequence for weekday (asc sorted, rotated by start user)
  const getWeekdayFinalSequence = (): string[] => {
    const sorted = sortByServiceNumber(weekdaySequence, 'asc');
    return rotateSequence(sorted, weekdayStartUserId);
  };

  // Get the final ordered sequence for weekend (asc sorted, rotated by start user)
  const getWeekendFinalSequence = (): string[] => {
    const sorted = sortByServiceNumber(weekendSequence, 'asc');
    return rotateSequence(sorted, weekendStartUserId);
  };

  const handleGenerate = async () => {
    if (weekdaySequence.length === 0 || weekendSequence.length === 0) {
      toast.error('평일과 주말 당직자를 최소 1명 이상 선택하세요.');
      return;
    }

    if (!token) return;

    setLoading(true);
    try {
      const finalWeekday = getWeekdayFinalSequence();
      const finalWeekend = getWeekendFinalSequence();
      await api.generateDuties(token, year, month, finalWeekday, finalWeekend, exclusions, customHolidays, fridayAsWeekend);
      toast.success('당직 일정이 성공적으로 생성되었습니다!');
      startNavigation('/dashboard', navigate);
    } catch (error: any) {
      console.error('Failed to generate duties:', error);
      toast.error(error.message || '일정 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const addExclusion = () => {
    if (!newExclusion.userId) {
      toast.error('대상자를 선택하세요.');
      return;
    }
    
    const startDate = `${newExclusion.startYear}-${String(newExclusion.startMonth).padStart(2, '0')}-${String(newExclusion.startDay).padStart(2, '0')}`;
    const endDate = `${newExclusion.endYear}-${String(newExclusion.endMonth).padStart(2, '0')}-${String(newExclusion.endDay).padStart(2, '0')}`;

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('종료일이 시작일보다 빠를 수 없습니다.');
      return;
    }
    setExclusions([...exclusions, { userId: newExclusion.userId, startDate, endDate }]);
    // Reset to current date
    const now = new Date();
    setNewExclusion({ 
      ...newExclusion,
      userId: '',
      startYear: now.getFullYear(),
      startMonth: now.getMonth() + 1,
      startDay: now.getDate(),
      endYear: now.getFullYear(),
      endMonth: now.getMonth() + 1,
      endDay: now.getDate()
    });
    toast.success('예외 기간이 추가되었습니다.');
  };

  const removeExclusion = (index: number) => {
    setExclusions(exclusions.filter((_, i) => i !== index));
  };

  const addCustomHoliday = () => {
    const dateStr = `${newHoliday.year}-${String(newHoliday.month).padStart(2, '0')}-${String(newHoliday.day).padStart(2, '0')}`;
    if (customHolidays.includes(dateStr)) {
      toast.error('이미 등록된 공휴일입니다.');
      return;
    }
    setCustomHolidays([...customHolidays, dateStr].sort());
    toast.success('전투휴무(공휴일)가 추가되었습니다.');
  };

  const removeCustomHoliday = (date: string) => {
    setCustomHolidays(customHolidays.filter(d => d !== date));
  };

  // Duty edit functions
  const loadEditDuties = async (y: number, m: number) => {
    if (!token) return;
    setEditLoading(true);
    try {
      const { duties: d } = await api.getDuties(token, y, m);
      setEditDuties(d || []);
      setEditHasChanges(false);
      setSelectedEditDay(null);
    } catch {
      setEditDuties([]);
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'duty-edit' && token) {
      loadEditDuties(editYear, editMonth);
    }
  }, [activeTab, editYear, editMonth, token]);

  const handleEditDutyChange = (day: number, userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    setEditDuties(prev => {
      const existing = prev.find(d => d.date === day);
      if (existing) {
        return prev.map(d => d.date === day ? { ...d, userId: user.id, userName: user.name } : d);
      } else {
        const dayOfWeek = new Date(editYear, editMonth - 1, day).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        return [...prev, { date: day, userId: user.id, userName: user.name, type: isWeekend ? 'weekend' : 'weekday' }];
      }
    });
    setEditHasChanges(true);
  };

  const handleRemoveDuty = (day: number) => {
    setEditDuties(prev => prev.filter(d => d.date !== day));
    setEditHasChanges(true);
  };

  const handleSaveEditDuties = async () => {
    if (!token) return;
    setEditSaving(true);
    try {
      await api.saveDuties(token, editYear, editMonth, editDuties);
      toast.success('당직 일정이 저장되었습니다!');
      setEditHasChanges(false);
      setSelectedEditDay(null);
    } catch (error: any) {
      toast.error(error.message || '저장 실패');
    } finally {
      setEditSaving(false);
    }
  };

  const getEditCalendarDays = () => {
    const firstDay = new Date(editYear, editMonth - 1, 1);
    const lastDay = new Date(editYear, editMonth, 0);
    const totalDays = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const result: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) result.push(null);
    for (let i = 1; i <= totalDays; i++) result.push(i);
    return result;
  };

  const editDutyMap = new Map<number, any>();
  editDuties.forEach(d => editDutyMap.set(d.date, d));

  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

  const DateSelector = ({ label, year, month, day, onYearChange, onMonthChange, onDayChange }: any) => {
    const days = getDaysInMonth(year, month);
    return (
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</Label>
        <div className="grid grid-cols-3 gap-2">
          <select 
            value={year}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="h-11 px-2 rounded-xl border border-gray-100 bg-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select 
            value={month}
            onChange={(e) => onMonthChange(parseInt(e.target.value))}
            className="h-11 px-2 rounded-xl border border-gray-100 bg-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          <select 
            value={day}
            onChange={(e) => onDayChange(parseInt(e.target.value))}
            className="h-11 px-2 rounded-xl border border-gray-100 bg-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {Array.from({length: days}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}일</option>)}
          </select>
        </div>
      </div>
    );
  };

  const getUserById = (id: string) => users.find(u => u.id === id);

  return (
    <div className="min-h-screen bg-gray-50 content-bottom-safe">
      {/* iOS/Android Status Bar Safe Area */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white safe-top-spacer" />

      <header className="sticky top-safe z-30 bg-white/80 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" onClick={() => startNavigation('/dashboard', navigate)} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-indigo-600 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">시스템 관리</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Tab Selector */}
        <div className="grid grid-cols-4 p-1 bg-white rounded-2xl shadow-sm border border-gray-100 gap-0.5">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              activeTab === 'schedule' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <CalendarPlus className="w-4 h-4" />
              일정생성
            </div>
          </button>
          <button
            onClick={() => setActiveTab('duty-edit')}
            className={`py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              activeTab === 'duty-edit' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <CalendarDays className="w-4 h-4" />
              당직수정
            </div>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              activeTab === 'users' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <Users className="w-4 h-4" />
              사용자
            </div>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              activeTab === 'settings' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <SettingsIcon className="w-4 h-4" />
              설정
            </div>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'settings' ? (
             <motion.div
               key="settings-tab"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="space-y-6"
             >
               <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                 <CardHeader className="p-5 pb-2">
                   <CardTitle className="text-base font-bold flex items-center gap-2">
                     <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                     당직비 단가 설정
                   </CardTitle>
                   <CardDescription className="text-xs">대시보드에서 정산 시 사용되는 근무별 단가를 설정합니다.</CardDescription>
                 </CardHeader>
                 <CardContent className="p-5 pt-4 space-y-6">
                   <div className="grid grid-cols-1 gap-6">
                     <div className="space-y-2">
                       <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">평일 근무 단가 (원)</Label>
                       <div className="relative">
                         <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                           <Wallet className="w-4 h-4" />
                         </div>
                         <Input 
                           type="number" 
                           value={dutyPrices.weekday} 
                           onChange={(e) => setDutyPrices({ ...dutyPrices, weekday: parseInt(e.target.value) || 0 })}
                           className="h-12 pl-11 rounded-xl border-gray-100 bg-gray-50 font-bold focus:bg-white transition-all"
                           placeholder="30,000"
                         />
                       </div>
                     </div>
                     <div className="space-y-2">
                       <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">주말 근무 단가 (원)</Label>
                       <div className="relative">
                         <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                           <Wallet className="w-4 h-4" />
                         </div>
                         <Input 
                           type="number" 
                           value={dutyPrices.weekend} 
                           onChange={(e) => setDutyPrices({ ...dutyPrices, weekend: parseInt(e.target.value) || 0 })}
                           className="h-12 pl-11 rounded-xl border-gray-100 bg-gray-50 font-bold focus:bg-white transition-all"
                           placeholder="100,000"
                         />
                       </div>
                     </div>
                   </div>
                   
                   <Button 
                     onClick={handleUpdatePrices}
                     disabled={isUpdatingPrices}
                     className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-lg shadow-indigo-100"
                   >
                     {isUpdatingPrices ? '저장 중...' : '단가 설정 저장'}
                   </Button>
                   
                   <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                     <p className="text-[11px] text-amber-700 leading-relaxed flex gap-2">
                       <Info className="w-3 h-3 shrink-0 mt-0.5" />
                       수정된 단가는 대시보드 정산 칸에 즉시 반영되며, 이미 진행된 근무와 향후 예정된 근무 모두에 공통 적용됩니다.
                     </p>
                   </div>
                 </CardContent>
               </Card>

               {/* App Data Reset */}
               <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                 <CardHeader className="p-5 pb-2">
                   <CardTitle className="text-base font-bold flex items-center gap-2">
                     <div className="w-1 h-4 bg-red-500 rounded-full" />
                     앱 데이터 초기화
                   </CardTitle>
                   <CardDescription className="text-xs">모든 로컬 캐시와 데이터를 삭제하고 앱을 초기 상태로 되돌립니다.</CardDescription>
                 </CardHeader>
                 <CardContent className="p-5 pt-4 space-y-4">
                   <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                     <p className="text-[11px] text-red-600 leading-relaxed flex gap-2">
                       <Info className="w-3 h-3 shrink-0 mt-0.5" />
                       초기화 시 로컬 저장소, 세션, 캐시, 서비스 워커가 모두 삭제됩니다. 서버 데이터는 영향받지 않습니다.
                     </p>
                   </div>
                   <Button
                     variant="outline"
                     onClick={async () => {
                       if (confirm('모든 로컬 캐시와 데이터를 삭제하고 앱을 초기화하시겠습니까?')) {
                         localStorage.clear();
                         sessionStorage.clear();
                         const cacheNames = await caches.keys();
                         await Promise.all(cacheNames.map(name => caches.delete(name)));
                         const registrations = await navigator.serviceWorker.getRegistrations();
                         for (let registration of registrations) await registration.unregister();
                         toast.success('초기화되었습니다.');
                         setTimeout(() => window.location.reload(), 1000);
                       }
                     }}
                     className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-bold"
                   >
                     <Trash2 className="w-4 h-4 mr-2" />
                     앱 데이터 초기화
                   </Button>
                 </CardContent>
               </Card>
             </motion.div>
          ) : activeTab === 'schedule' ? (
            <motion.div
              key="schedule-tab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              {/* Date Selection Card */}
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    대상 기간 설정
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">년도</Label>
                      <select 
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="w-full h-11 px-3 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      >
                        {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}년</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">월</Label>
                      <select 
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="w-full h-11 px-3 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      >
                        {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Friday Weekend Toggle */}
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-xl">
                        <CalendarDays className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">금요일 주말근무 편성</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {fridayAsWeekend ? '금요일이 주말 순번으로 배정됩니다' : '금요일이 평일 순번으로 배정됩니다'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={fridayAsWeekend}
                      onClick={() => setFridayAsWeekend(!fridayAsWeekend)}
                      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        fridayAsWeekend ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                          fridayAsWeekend ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </label>
                </CardContent>
              </Card>

              {/* Custom Holidays Card */}
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <div className="w-1 h-4 bg-red-500 rounded-full" />
                    전투휴무 및 임시공휴일 지정
                  </CardTitle>
                  <CardDescription className="text-xs">국가 공휴일 외에 부대 자체 휴무일을 추가합니다.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-2 space-y-4">
                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                    <DateSelector 
                      label="휴무 날짜 선택"
                      year={newHoliday.year}
                      month={newHoliday.month}
                      day={newHoliday.day}
                      onYearChange={(v: number) => setNewHoliday({ ...newHoliday, year: v })}
                      onMonthChange={(v: number) => setNewHoliday({ ...newHoliday, month: v, day: Math.min(newHoliday.day, getDaysInMonth(newHoliday.year, v)) })}
                      onDayChange={(v: number) => setNewHoliday({ ...newHoliday, day: v })}
                    />
                    <Button 
                      variant="outline" 
                      onClick={addCustomHoliday}
                      className="w-full h-11 rounded-xl font-bold border-red-100 text-red-600 hover:bg-red-50"
                    >
                      휴무일(공휴일) 추가
                    </Button>
                  </div>

                  {customHolidays.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {customHolidays.map((date) => (
                        <div key={date} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-full">
                          <span className="text-xs font-bold text-red-600">{date}</span>
                          <button onClick={() => removeCustomHoliday(date)} className="text-red-400 hover:text-red-600">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Exclusion Periods Card */}
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <div className="w-1 h-4 bg-orange-500 rounded-full" />
                    당직 제외 기간 설정 (교육/휴가 등)
                  </CardTitle>
                  <CardDescription className="text-xs">해당 기간 동안은 순번에서 자동으로 제외됩니다.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-2 space-y-4">
                  <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">대상자</Label>
                      <select 
                        value={newExclusion.userId}
                        onChange={(e) => setNewExclusion({ ...newExclusion, userId: e.target.value })}
                        className="w-full h-11 px-3 rounded-xl border border-gray-100 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">대상 대원 선택</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} {u.serviceNumber ? `(${u.serviceNumber})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <DateSelector 
                        label="시작일"
                        year={newExclusion.startYear}
                        month={newExclusion.startMonth}
                        day={newExclusion.startDay}
                        onYearChange={(v: number) => setNewExclusion({ ...newExclusion, startYear: v })}
                        onMonthChange={(v: number) => setNewExclusion({ ...newExclusion, startMonth: v, startDay: Math.min(newExclusion.startDay, getDaysInMonth(newExclusion.startYear, v)) })}
                        onDayChange={(v: number) => setNewExclusion({ ...newExclusion, startDay: v })}
                      />
                      <DateSelector 
                        label="종료일"
                        year={newExclusion.endYear}
                        month={newExclusion.endMonth}
                        day={newExclusion.endDay}
                        onYearChange={(v: number) => setNewExclusion({ ...newExclusion, endYear: v })}
                        onMonthChange={(v: number) => setNewExclusion({ ...newExclusion, endMonth: v, endDay: Math.min(newExclusion.endDay, getDaysInMonth(newExclusion.endYear, v)) })}
                        onDayChange={(v: number) => setNewExclusion({ ...newExclusion, endDay: v })}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={addExclusion}
                      className="w-full h-11 rounded-xl font-bold border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                    >
                      제외 기간 추가
                    </Button>
                  </div>

                  {exclusions.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">설정된 제외 목록</Label>
                      {exclusions.map((ex, i) => {
                        const user = getUserById(ex.userId);
                        return (
                          <div key={i} className="flex items-center justify-between p-3 bg-orange-50/50 border border-orange-100 rounded-xl">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-700">{user?.name}</span>
                              <span className="text-[10px] text-gray-400">{ex.startDate} ~ {ex.endDate}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeExclusion(i)}
                              className="w-8 h-8 text-red-400 hover:text-red-600 rounded-full"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weekday Sequence Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-500 rounded-full" />
                    평일 당직 순번
                  </h3>
                  <span className="text-xs font-medium text-gray-400">{weekdaySequence.length}명</span>
                </div>
                
                <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                   <CardContent className="p-4 space-y-4">
                     <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 hidden">
                       <p className="text-[10px] text-blue-600 font-bold mb-1">자동 정렬: 군번 낮은 순 → 높은 순 (오름차순)</p>
                       <p className="text-[10px] text-blue-500/70">모든 대원이 자동으로 포함되며 군번 기준으로 정렬됩니다.</p>
                     </div>

                     {/* Starting person selector */}
                     {weekdaySequence.length > 0 && (
                       <div className="space-y-1.5">
                         <Label className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                           {month}월 첫 평일 시작 인원 선택
                         </Label>
                         <select
                           value={weekdayStartUserId}
                           onChange={(e) => setWeekdayStartUserId(e.target.value)}
                           className="w-full h-11 px-3 rounded-xl border border-blue-100 bg-blue-50/30 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                         >
                           <option value="">순번 1번부터 시작 (기본)</option>
                           {sortByServiceNumber(weekdaySequence, 'asc').map((id) => {
                             const user = getUserById(id);
                             return (
                               <option key={id} value={id}>
                                 {user?.name} {user?.serviceNumber ? `(${user.serviceNumber})` : ''}
                               </option>
                             );
                           })}
                         </select>
                       </div>
                     )}

                     {/* Auto-sorted sequence flow display (reflects starting person rotation) */}
                     {weekdaySequence.length > 0 && (
                       <div className="p-3 bg-gray-50 rounded-xl">
                         <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                           <CalendarDays className="w-3 h-3" />
                           배정 순서 미리보기
                         </div>
                         <div className="flex flex-wrap items-center gap-1">
                           {getWeekdayFinalSequence().map((id, idx, arr) => {
                             const user = getUserById(id);
                             return (
                               <span key={id} className="inline-flex items-center">
                                 <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                                   idx === 0 
                                     ? 'bg-blue-600 text-white' 
                                     : 'bg-blue-100 text-blue-700'
                                 }`}>
                                   {user?.name}
                                 </span>
                                 {idx < arr.length - 1 && (
                                   <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5 shrink-0" />
                                 )}
                               </span>
                             );
                           })}
                         </div>
                       </div>
                     )}
                   </CardContent>
                </Card>
              </div>

              {/* Weekend Sequence Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-1 h-4 bg-red-500 rounded-full" />
                    주말 당직 순번
                  </h3>
                  <span className="text-xs font-medium text-gray-400">{weekendSequence.length}명</span>
                </div>
                
                <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                   <CardContent className="p-4 space-y-4">
                     <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 hidden">
                       <p className="text-[10px] text-red-600 font-bold mb-1">자동 정렬: 군번 낮은 순 → 높은 순 (오름차순)</p>
                       <p className="text-[10px] text-red-500/70">모든 대원이 자동으로 포함되며 군번 기준으로 정렬됩니다.</p>
                     </div>

                     {/* Starting person selector */}
                     {weekendSequence.length > 0 && (
                       <div className="space-y-1.5">
                         <Label className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                           {month}월 첫 주말 시작 인원 선택
                         </Label>
                         <select
                           value={weekendStartUserId}
                           onChange={(e) => setWeekendStartUserId(e.target.value)}
                           className="w-full h-11 px-3 rounded-xl border border-red-100 bg-red-50/30 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none transition-all"
                         >
                           <option value="">순번 1번부터 시작 (기본)</option>
                           {sortByServiceNumber(weekendSequence, 'asc').map((id) => {
                             const user = getUserById(id);
                             return (
                               <option key={id} value={id}>
                                 {user?.name} {user?.serviceNumber ? `(${user.serviceNumber})` : ''}
                               </option>
                             );
                           })}
                         </select>
                       </div>
                     )}

                     {/* Auto-sorted sequence flow display (reflects starting person rotation) */}
                     {weekendSequence.length > 0 && (
                       <div className="p-3 bg-gray-50 rounded-xl">
                         <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                           <CalendarDays className="w-3 h-3" />
                           배정 순서 미리보기
                         </div>
                         <div className="flex flex-wrap items-center gap-1">
                           {getWeekendFinalSequence().map((id, idx, arr) => {
                             const user = getUserById(id);
                             return (
                               <span key={id} className="inline-flex items-center">
                                 <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                                   idx === 0 
                                     ? 'bg-red-600 text-white' 
                                     : 'bg-red-100 text-red-700'
                                 }`}>
                                   {user?.name}
                                 </span>
                                 {idx < arr.length - 1 && (
                                   <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5 shrink-0" />
                                 )}
                               </span>
                             );
                           })}
                         </div>
                       </div>
                     )}
                   </CardContent>
                </Card>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  시작 인원을 선택하면 해당 인원부터 순환 배정되며, 순번 미리보기가 즉시 반영됩니다.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button 
                  onClick={handleGenerate} 
                  disabled={loading || weekdaySequence.length === 0 || weekendSequence.length === 0}
                  className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold text-base shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      일정 생성 중...
                    </div>
                  ) : '일정 자동 생성 시작'}
                </Button>
              </div>
            </motion.div>
          ) : activeTab === 'duty-edit' ? (
            <motion.div
              key="duty-edit-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              {/* Calendar Card */}
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                      당직 일정 수정
                    </CardTitle>
                    <div className="flex items-center gap-0.5 bg-gray-50 rounded-xl px-1 py-0.5 border border-gray-100">
                      <button
                        onClick={() => {
                          const prev = editMonth === 1 ? 12 : editMonth - 1;
                          const prevYear = editMonth === 1 ? editYear - 1 : editYear;
                          setEditMonth(prev);
                          setEditYear(prevYear);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white active:scale-90 transition-all"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-500" />
                      </button>
                      <span className="text-xs font-black text-indigo-600 min-w-[60px] text-center tabular-nums">
                        {editYear}.{String(editMonth).padStart(2, '0')}
                      </span>
                      <button
                        onClick={() => {
                          const next = editMonth === 12 ? 1 : editMonth + 1;
                          const nextYear = editMonth === 12 ? editYear + 1 : editYear;
                          setEditMonth(next);
                          setEditYear(nextYear);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white active:scale-90 transition-all"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1">날짜를 터치하여 당직자를 변경합니다.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  {editLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-7 mb-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                          <span key={i} className={`text-[9px] font-black text-center uppercase tracking-widest ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {getEditCalendarDays().map((day, index) => {
                          if (!day) return <div key={index} className="aspect-square" />;
                          const duty = editDutyMap.get(day);
                          const isSelected = selectedEditDay === day;
                          const dayOfWeek = (new Date(editYear, editMonth - 1, 1).getDay() + (day - 1)) % 7;
                          const today = new Date();
                          const isToday = day === today.getDate() && editMonth === today.getMonth() + 1 && editYear === today.getFullYear();
                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedEditDay(isSelected ? null : day)}
                              className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative cursor-pointer active:scale-90 select-none ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-300'
                                  : duty
                                    ? 'bg-indigo-50 ring-1 ring-indigo-100 hover:ring-indigo-300'
                                    : isToday
                                      ? 'bg-gray-50 ring-1 ring-gray-200'
                                      : 'hover:bg-gray-50'
                              }`}
                            >
                              <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</span>
                              {duty && (
                                <span className={`text-[7px] font-bold truncate max-w-full px-0.5 leading-tight mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-indigo-600'}`}>
                                  {duty.userName?.length > 2 ? duty.userName.slice(0, 2) : duty.userName}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 bg-indigo-50 rounded ring-1 ring-indigo-100" />
                          <span className="text-[9px] font-bold text-gray-400">배정됨</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 bg-indigo-600 rounded" />
                          <span className="text-[9px] font-bold text-gray-400">선택됨</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 bg-white rounded border border-gray-200" />
                          <span className="text-[9px] font-bold text-gray-400">미배정</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* User selector for selected day */}
              <AnimatePresence>
                {selectedEditDay !== null && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-none shadow-lg rounded-2xl overflow-hidden bg-white ring-2 ring-indigo-100">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">{selectedEditDay}</div>
                            <div>
                              <p className="text-sm font-bold">{editMonth}월 {selectedEditDay}일 당직자 변경</p>
                              {editDutyMap.get(selectedEditDay) && (
                                <p className="text-[10px] text-gray-400 font-medium mt-0.5">현재: <span className="text-indigo-600 font-bold">{editDutyMap.get(selectedEditDay)?.userName}</span></p>
                              )}
                            </div>
                          </CardTitle>
                          <Button variant="ghost" size="icon" className="rounded-full text-gray-400" onClick={() => setSelectedEditDay(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="flex flex-wrap gap-2">
                          {users.map(user => {
                            const isCurrentDuty = editDutyMap.get(selectedEditDay!)?.userId === user.id;
                            return (
                              <button
                                key={user.id}
                                onClick={() => handleEditDutyChange(selectedEditDay!, user.id)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                  isCurrentDuty
                                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 shadow-md'
                                    : 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-100'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  {isCurrentDuty && <Check className="w-3 h-3" />}
                                  {user.name}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {editDutyMap.get(selectedEditDay!) && (
                          <button
                            onClick={() => handleRemoveDuty(selectedEditDay!)}
                            className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            이 날 당직 제거
                          </button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {editHasChanges && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Button
                    onClick={handleSaveEditDuties}
                    disabled={editSaving}
                    className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold text-base shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                  >
                    {editSaving ? (
                      <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />저장 중...</div>
                    ) : (
                      <div className="flex items-center gap-2"><Save className="w-4 h-4" />변경사항 저장</div>
                    )}
                  </Button>
                </motion.div>
              )}

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  날짜를 선택한 후 원하는 대원을 터치하면 해당 날의 당직자가 즉시 변경됩니다. 변경 후 반드시 <strong>변경사항 저장</strong>을 눌러주세요.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                  등록된 계정 목록
                </h3>
                <span className="text-xs font-medium text-gray-400">총 {users.length}명</span>
              </div>

              <div className="space-y-3">
                {users.map((user) => (
                  <Card key={user.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">{user.name}</p>
                              {user.role === 'admin' && (
                                <Badge className="bg-indigo-600 text-[10px] px-1.5 py-0 h-4">관리자</Badge>
                              )}
                              {user.id === currentUser?.id && (
                                <span className="text-[10px] text-indigo-500 font-bold">(나)</span>
                              )}
                            </div>
                            <p className="text-[10px] text-indigo-600/80 tracking-tighter leading-none mb-1">{user.serviceNumber || '군번 미등록'}</p>
                            <p className="text-[10px] text-gray-400 font-medium">@{user.username || user.email?.split('@')[0]}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                           <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-xl bg-white text-gray-400 hover:bg-gray-100">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xs w-[85vw] rounded-3xl p-6 top-[50%]">
                              <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-center">계정 관리</DialogTitle>
                                <DialogDescription className="text-center">
                                  {user.name} ({user.role === 'admin' ? '관리자' : '일반사용자'})
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex flex-col gap-3 py-4">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">군번</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      value={editingServiceNumber?.userId === user.id ? editingServiceNumber.value : (user.serviceNumber || '')}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        let formatted = val;
                                        if (val.length > 2) {
                                          formatted = val.slice(0, 2) + '-' + val.slice(2, 8);
                                        }
                                        setEditingServiceNumber({ userId: user.id, value: formatted });
                                      }}
                                      onFocus={() => {
                                        if (!editingServiceNumber || editingServiceNumber.userId !== user.id) {
                                          setEditingServiceNumber({ userId: user.id, value: user.serviceNumber || '' });
                                        }
                                      }}
                                      className="h-10 rounded-xl border-gray-100 bg-gray-50 font-mono text-sm flex-1"
                                      placeholder="00-000000"
                                    />
                                    <Button
                                      size="sm"
                                      className="h-10 rounded-xl bg-indigo-600 text-white px-3"
                                      onClick={handleSaveServiceNumber}
                                      disabled={actionLoading === user.id || !editingServiceNumber || editingServiceNumber.userId !== user.id}
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="h-px bg-gray-100" />
                                <Button 
                                  variant="outline" 
                                  className="h-12 rounded-xl font-bold flex items-center justify-start px-4 gap-3 border-gray-100"
                                  onClick={() => handleRoleChange(user.id, user.role)}
                                  disabled={actionLoading === user.id}
                                >
                                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                                  {user.role === 'admin' ? '일반사용자로 변경' : '관리자로 권한 부여'}
                                </Button>
                                {user.id !== currentUser?.id && (
                                  <Button 
                                    variant="destructive" 
                                    className="h-12 rounded-xl font-bold flex items-center justify-start px-4 gap-3 bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none"
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={actionLoading === user.id}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    계정 삭제
                                  </Button>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 mt-6">
                <h4 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  보안 안내
                </h4>
                <ul className="space-y-1.5">
                  <li className="text-xs text-indigo-700/80 leading-relaxed list-disc ml-4">관리자는 다른 사용자의 권한을 조정하거나 계정을 삭제할 수 있습니다.</li>
                  <li className="text-xs text-indigo-700/80 leading-relaxed list-disc ml-4">계정 삭제 시 해당 사용자는 시스템에 더 이상 로그인할 수 없습니다.</li>
                  <li className="text-xs text-indigo-700/80 leading-relaxed list-disc ml-4">최소 1명의 관리자 계정은 유지되어야 합니다.</li>
                </ul>
                
                <div className="mt-6 pt-6 border-t border-indigo-200/50">
                  <Button 
                    variant="destructive" 
                    className="w-full h-12 rounded-xl bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 transition-colors font-bold shadow-none"
                    onClick={handleBulkDeleteNonAdmins}
                    disabled={loading || users.filter(u => u.role !== 'admin').length === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    관리자 제 모든 계정 일괄 삭제
                  </Button>
                  <p className="text-[10px] text-red-400 mt-2 text-center font-medium">* 이 작업은 되돌릴 수 없으니 주의하십시오.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ConfirmDialog 
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState({ ...confirmState, open })}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
        variant={confirmState.variant}
      />
    </div>
  );
}
