import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { NavigationContext } from '../context/NavigationContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  CalendarPlus, 
  GripVertical, 
  Info, 
  User as UserIcon, 
  Users, 
  ShieldCheck, 
  Trash2, 
  MoreVertical,
  ChevronRight,
  ShieldAlert,
  X,
  Wallet,
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
  const [activeTab, setActiveTab] = useState<'schedule' | 'users' | 'settings'>('schedule');
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  
  // States for ordered sequences
  const [weekdaySequence, setWeekdaySequence] = useState<string[]>([]);
  const [weekendSequence, setWeekendSequence] = useState<string[]>([]);
  
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
  
  // States for duty prices
  const [dutyPrices, setDutyPrices] = useState({ weekday: 30000, weekend: 100000 });
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

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
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('데이터를 불러오지 못했습니다.');
      startNavigation('/dashboard', navigate);
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
      description: `관리자를 제외한 모든 사용자(${nonAdmins.length}명)를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 일반 대원은 즉시 로그인이 차단됩니다.`,
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

  const toggleWeekdayUser = (userId: string) => {
    if (weekdaySequence.includes(userId)) {
      setWeekdaySequence(weekdaySequence.filter(id => id !== userId));
    } else {
      setWeekdaySequence([...weekdaySequence, userId]);
    }
  };

  const toggleWeekendUser = (userId: string) => {
    if (weekendSequence.includes(userId)) {
      setWeekendSequence(weekendSequence.filter(id => id !== userId));
    } else {
      setWeekendSequence([...weekendSequence, userId]);
    }
  };

  const handleGenerate = async () => {
    if (weekdaySequence.length === 0 || weekendSequence.length === 0) {
      toast.error('평일과 주말 당직자를 최소 1명 이상 선택하세요.');
      return;
    }

    if (!token) return;

    setLoading(true);
    try {
      await api.generateDuties(token, year, month, weekdaySequence, weekendSequence, exclusions, customHolidays);
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* iOS/Android Status Bar Safe Area */}
      <div className="sticky top-0 left-0 right-0 z-50 bg-white h-10 w-full" />

      <header className="sticky top-10 z-30 bg-white/80 backdrop-blur-md border-b px-4 py-3">
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
        <div className="flex p-1 bg-white rounded-2xl shadow-sm border border-gray-100">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'schedule' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CalendarPlus className="w-4 h-4" />
              일정 생성
            </div>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'users' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4" />
              사용자 관리
            </div>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'settings' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              환경 설정
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
                  <span className="text-xs font-medium text-gray-400">{weekdaySequence.length}명 선택됨</span>
                </div>
                
                <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                   <CardContent className="p-4 space-y-4">
                     <div className="flex flex-wrap gap-2">
                       {users.map((user) => (
                         <button
                           key={`select-weekday-${user.id}`}
                           onClick={() => toggleWeekdayUser(user.id)}
                           className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                             weekdaySequence.includes(user.id)
                               ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                               : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                           }`}
                         >
                           {user.name}
                           {user.serviceNumber && <span className="ml-1 opacity-60 font-mono">({user.serviceNumber})</span>}
                         </button>
                       ))}
                     </div>

                     {weekdaySequence.length > 0 && (
                       <div className="pt-4 border-t border-gray-50">
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">
                            <GripVertical className="w-3 h-3" />
                            드래그하여 순서 조정
                          </div>
                          <Reorder.Group 
                            axis="y" 
                            values={weekdaySequence} 
                            onReorder={setWeekdaySequence}
                            className="space-y-2"
                          >
                            {weekdaySequence.map((id) => {
                              const user = getUserById(id);
                              return (
                                <Reorder.Item
                                  key={id}
                                  value={id}
                                  className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm cursor-grab active:cursor-grabbing"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                      <UserIcon className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">{user?.name}</span>
                                  </div>
                                  <GripVertical className="w-4 h-4 text-gray-300" />
                                </Reorder.Item>
                              );
                            })}
                          </Reorder.Group>
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
                  <span className="text-xs font-medium text-gray-400">{weekendSequence.length}명 선택됨</span>
                </div>
                
                <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                   <CardContent className="p-4 space-y-4">
                     <div className="flex flex-wrap gap-2">
                       {users.map((user) => (
                         <button
                           key={`select-weekend-${user.id}`}
                           onClick={() => toggleWeekendUser(user.id)}
                           className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                             weekendSequence.includes(user.id)
                               ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                               : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                           }`}
                         >
                           {user.name}
                           {user.serviceNumber && <span className="ml-1 opacity-60 font-mono">({user.serviceNumber})</span>}
                         </button>
                       ))}
                     </div>

                     {weekendSequence.length > 0 && (
                       <div className="pt-4 border-t border-gray-50">
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">
                            <GripVertical className="w-3 h-3" />
                            드래그하여 순서 조정
                          </div>
                          <Reorder.Group 
                            axis="y" 
                            values={weekendSequence} 
                            onReorder={setWeekendSequence}
                            className="space-y-2"
                          >
                            {weekendSequence.map((id) => {
                              const user = getUserById(id);
                              return (
                                <Reorder.Item
                                  key={id}
                                  value={id}
                                  className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm cursor-grab active:cursor-grabbing"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                                      <UserIcon className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">{user?.name}</span>
                                  </div>
                                  <GripVertical className="w-4 h-4 text-gray-300" />
                                </Reorder.Item>
                              );
                            })}
                          </Reorder.Group>
                       </div>
                     )}
                   </CardContent>
                </Card>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  선택된 순서대로 당직이 순환 배정됩니다. 첫 번째 사람이 첫 번째 당직 날짜(평일/주말 구분)를 맡게 됩니다.
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
                            <p className="text-[10px] font-bold text-indigo-600/80 tracking-tighter leading-none mb-1">{user.serviceNumber || '군번 미등록'}</p>
                            <p className="text-[10px] text-gray-400 font-medium">@{user.username || user.email?.split('@')[0]}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                           <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-xl text-gray-400">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xs w-[85vw] rounded-3xl p-6 top-[40%]">
                              <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-center">계정 관리</DialogTitle>
                                <DialogDescription className="text-center">
                                  {user.name} ({user.role === 'admin' ? '관리자' : '일반'})
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex flex-col gap-3 py-4">
                                <Button 
                                  variant="outline" 
                                  className="h-12 rounded-xl font-bold flex items-center justify-start px-4 gap-3 border-gray-100"
                                  onClick={() => handleRoleChange(user.id, user.role)}
                                  disabled={actionLoading === user.id}
                                >
                                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                                  {user.role === 'admin' ? '일반 계정으로 변경' : '관리자로 권한 부여'}
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
                    관리자 제외 모든 계정 일괄 삭제
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
