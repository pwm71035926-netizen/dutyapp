import { useState, useEffect, useContext, useMemo, memo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { NavigationContext } from '../context/NavigationContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  MessageSquare,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  Repeat2,
  Info,
  ChevronDown,
  CheckCircle2,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SwapRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  year: number;
  month: number;
  date: number;
  fromDate?: number;
  toDate?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
}

interface User {
  id: string;
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

// Mini calendar day component for swap target date selection
const SwapCalendarDay = memo(({
  day,
  duty,
  isMyDuty,
  isSelected,
  isFromDate,
  isToday,
  isHoliday,
  onClick,
  index,
}: {
  day: number | null;
  duty: Duty | null;
  isMyDuty: boolean;
  isSelected: boolean;
  isFromDate: boolean;
  isToday: boolean;
  isHoliday: boolean;
  onClick: (day: number) => void;
  index: number;
}) => {
  if (!day) return <div className="aspect-square invisible" />;

  return (
    <div
      className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative cursor-pointer active:scale-90 select-none ${
        isFromDate
          ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 ring-2 ring-orange-300'
          : isSelected
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
            : isMyDuty
              ? 'bg-orange-50 ring-1 ring-orange-200'
              : isToday
                ? 'bg-indigo-50 ring-1 ring-indigo-200'
                : duty
                  ? 'hover:bg-gray-50'
                  : 'opacity-40'
      }`}
      onClick={() => {
        if (duty && !isFromDate && !isMyDuty) onClick(day);
      }}
    >
      <span
        className={`text-[11px] font-bold ${
          isFromDate || isSelected
            ? 'text-white'
            : (index % 7 === 0 || isHoliday)
              ? 'text-red-500'
              : index % 7 === 6
                ? 'text-blue-500'
                : 'text-gray-700'
        }`}
      >
        {day}
      </span>
      {duty && !isFromDate && !isSelected && (
        <div
          className={`w-1 h-1 rounded-full mt-0.5 ${
            isMyDuty ? 'bg-orange-500' : 'bg-gray-300'
          }`}
        />
      )}
    </div>
  );
});

export default function SwapRequests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { startNavigation } = useContext(NavigationContext);

  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Ref for auto-scroll to Step 3
  const step3Ref = useRef<HTMLDivElement>(null);

  // Main view tab
  const [mainTab, setMainTab] = useState<'create' | 'history'>('create');
  // History sub-tab
  const [historyTab, setHistoryTab] = useState<'received' | 'sent'>('received');

  // Swap creation states
  const paramFromDate = searchParams.get('fromDate');
  const paramYear = searchParams.get('year');
  const paramMonth = searchParams.get('month');

  const now = new Date();
  const [swapYear, setSwapYear] = useState(paramYear ? parseInt(paramYear) : now.getFullYear());
  const [swapMonth, setSwapMonth] = useState(paramMonth ? parseInt(paramMonth) : now.getMonth() + 1);
  const [fromDate, setFromDate] = useState<number | null>(paramFromDate ? parseInt(paramFromDate) : null);
  const [toDate, setToDate] = useState<number | null>(null);

  // Confirmation dialog
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
    variant: 'default',
  });

  // Auto-switch to create tab if coming from dashboard with params
  useEffect(() => {
    if (paramFromDate) {
      setMainTab('create');
    }
  }, [paramFromDate]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (token) {
      loadDuties(swapYear, swapMonth);
    }
  }, [swapYear, swapMonth, token]);

  // Auto-scroll to Step 3 when toDate is selected
  useEffect(() => {
    if (toDate && fromDate) {
      setTimeout(() => {
        step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [toDate, fromDate]);

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

      const [reqRes, dutyRes] = await Promise.all([
        api.getSwapRequests(session.access_token),
        api.getDuties(
          session.access_token,
          paramYear ? parseInt(paramYear) : now.getFullYear(),
          paramMonth ? parseInt(paramMonth) : now.getMonth() + 1,
        ),
      ]);

      setRequests(reqRes.requests || []);
      setDuties(dutyRes.duties || []);
    } catch (error: any) {
      console.error('Failed to load swap requests:', error);
      toast.error('교환 요청을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadDuties = async (year: number, month: number) => {
    if (!token) return;
    try {
      const { duties: d } = await api.getDuties(token, year, month);
      setDuties(d || []);
    } catch {
      setDuties([]);
    }
  };

  const handleRespond = async (requestId: string, action: 'approve' | 'reject' | 'cancel') => {
    if (!token) return;
    try {
      // Use v2 endpoint for requests with fromDate/toDate, fallback to v1
      const req = requests.find(r => r.id === requestId);
      if (req?.fromDate && req?.toDate) {
        await api.respondToSwapRequestV2(token, requestId, action);
      } else {
        await api.respondToSwapRequest(token, requestId, action);
      }
      if (action === 'cancel') toast.success('요청을 취소했습니다.');
      else toast.success(action === 'approve' ? '교환이 승인되었습니다!' : '요청을 거절했습니다.');
      loadData();
    } catch (error: any) {
      toast.error(error.message || '요청 처리 실패');
    }
  };

  const handleCreateSwap = async () => {
    if (!token || !fromDate || !toDate) return;

    setSending(true);
    try {
      await api.createSwapRequestV2(token, swapYear, swapMonth, fromDate, toDate);
      toast.success('교환 요청을 보냈습니다!');
      setToDate(null);
      loadData();
      // Switch to sent tab to see the request
      setMainTab('history');
      setHistoryTab('sent');
    } catch (error: any) {
      toast.error(error.message || '교환 요청 실패');
    } finally {
      setSending(false);
    }
  };

  // Memoized values
  const dutyMap = useMemo(() => {
    const map = new Map<number, Duty>();
    duties.forEach((d) => map.set(d.date, d));
    return map;
  }, [duties]);

  const daysInMonthList = useMemo(() => {
    const firstDay = new Date(swapYear, swapMonth - 1, 1);
    const lastDay = new Date(swapYear, swapMonth, 0);
    const totalDays = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const result: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) result.push(null);
    for (let i = 1; i <= totalDays; i++) result.push(i);
    return result;
  }, [swapYear, swapMonth]);

  const myDutyDates = useMemo(() => {
    if (!currentUser) return new Set<number>();
    return new Set(duties.filter((d) => d.userId === currentUser.id).map((d) => d.date));
  }, [duties, currentUser]);

  const fromDuty = fromDate ? dutyMap.get(fromDate) : null;
  const toDuty = toDate ? dutyMap.get(toDate) : null;

  // Memoized callback for SwapCalendarDay onClick
  const handleToDateSelect = useCallback((day: number) => {
    setToDate(day);
  }, []);

  // Memoize holiday set for current swap month
  const swapHolidaySet = useMemo(() => {
    const solarHolidays = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];
    const lunarHolidays = [
      '2025-01-28','2025-01-29','2025-01-30','2025-03-03','2025-05-06','2025-10-05','2025-10-06','2025-10-07','2025-10-08',
      '2026-02-16','2026-02-17','2026-02-18','2026-03-02','2026-05-24','2026-05-25','2026-06-03','2026-08-17','2026-09-24','2026-09-25','2026-09-26','2026-10-05'
    ];
    const set = new Set<number>();
    const daysInMonth = new Date(swapYear, swapMonth, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const mmdd = `${String(swapMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const fullDate = `${swapYear}-${mmdd}`;
      const duty = duties.find(du => du.date === d);
      if (solarHolidays.includes(mmdd) || lunarHolidays.includes(fullDate) || duty?.isHoliday) {
        set.add(d);
      }
    }
    return set;
  }, [swapYear, swapMonth, duties]);

  const sortedRequests = [...requests].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const sentRequests = sortedRequests.filter((r) => r.fromUserId === currentUser?.id);
  const receivedRequests = sortedRequests.filter((r) => r.toUserId === currentUser?.id);
  const pendingReceivedCount = receivedRequests.filter((r) => r.status === 'pending').length;
  const pendingSentCount = sentRequests.filter((r) => r.status === 'pending').length;

  // Categorized lists for clean display
  const pendingReceived = receivedRequests.filter(r => r.status === 'pending');
  const pendingSent = sentRequests.filter(r => r.status === 'pending');
  const pastReceived = receivedRequests.filter(r => r.status !== 'pending');
  const pastSent = sentRequests.filter(r => r.status !== 'pending');

  // Expand/collapse for past items
  const [showPastItems, setShowPastItems] = useState(false);
  const [pastItemsLimit, setPastItemsLimit] = useState(10);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Clock className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4 opacity-40" />
          <p className="text-gray-400 font-bold uppercase tracking-tight text-[10px]">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 content-bottom-safe select-none touch-pan-y">
      {/* Status Bar Safe Area */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white safe-top-spacer" />

      <header className="sticky top-safe z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => startNavigation('/dashboard', navigate)}
              className="rounded-full text-gray-900 active:scale-90 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-600 rounded-lg">
                <ArrowLeftRight className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black text-gray-900 tracking-tight">당직 교환</h1>
            </div>
          </div>
          {pendingReceivedCount > 0 && (
            <Badge className="bg-red-500 text-white rounded-full px-2.5 py-0.5 text-[10px] font-black animate-pulse">
              {pendingReceivedCount}건 대기
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Main Tab Switcher */}
        <div className="flex p-1 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <button
            onClick={() => setMainTab('create')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${
              mainTab === 'create'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Repeat2 className="w-3.5 h-3.5" />
              새 교환 요청
            </div>
          </button>
          <button
            onClick={() => setMainTab('history')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all relative ${
              mainTab === 'history'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              요청 내역
            </div>
            {pendingReceivedCount > 0 && mainTab !== 'history' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full ring-2 ring-white font-black">
                {pendingReceivedCount}
              </span>
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mainTab === 'create' ? (
            <motion.div
              key="create-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Step 1: My Duty (From Date) */}
              <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center text-white text-[10px] font-black">1</div>
                      <CardTitle className="text-sm font-bold">내 당직일 선택</CardTitle>
                    </div>
                    {/* Month navigation in Step 1 */}
                    {!fromDate && (
                      <div className="flex items-center gap-0.5 bg-gray-50 rounded-xl px-1 py-0.5 border border-gray-100">
                        <button
                          onClick={() => {
                            const prev = swapMonth === 1 ? 12 : swapMonth - 1;
                            const prevYear = swapMonth === 1 ? swapYear - 1 : swapYear;
                            setSwapMonth(prev);
                            setSwapYear(prevYear);
                            setFromDate(null);
                            setToDate(null);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white active:scale-90 transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 text-gray-500" />
                        </button>
                        <span className="text-xs font-black text-orange-600 min-w-[56px] text-center tabular-nums">
                          {swapYear}.{String(swapMonth).padStart(2, '0')}
                        </span>
                        <button
                          onClick={() => {
                            const next = swapMonth === 12 ? 1 : swapMonth + 1;
                            const nextYear = swapMonth === 12 ? swapYear + 1 : swapYear;
                            setSwapMonth(next);
                            setSwapYear(nextYear);
                            setFromDate(null);
                            setToDate(null);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white active:scale-90 transition-all"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  {fromDate && fromDuty ? (
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-2xl border border-orange-100">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-lg">
                          {fromDate}
                        </div>
                        <div>
                          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">내 당직일</p>
                          <p className="text-sm font-bold text-gray-900">
                            {swapYear}년 {swapMonth}월 {fromDate}일 ({fromDuty.type === 'weekend' ? '주말' : '평일'})
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-orange-400 hover:text-orange-600 hover:bg-orange-100"
                        onClick={() => {
                          setFromDate(null);
                          setToDate(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400 font-medium">아래 캘린더에서 교환할 내 당직일을 선택하세요.</p>
                      {/* My duty dates as chips */}
                      <div className="flex flex-wrap gap-2">
                        {duties
                          .filter((d) => d.userId === currentUser?.id)
                          .sort((a, b) => a.date - b.date)
                          .map((d) => (
                            <button
                              key={d.date}
                              onClick={() => {
                                setFromDate(d.date);
                                setToDate(null);
                              }}
                              className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs font-bold text-orange-700 hover:bg-orange-100 active:scale-95 transition-all"
                            >
                              {swapMonth}/{d.date}일
                            </button>
                          ))}
                        {duties.filter((d) => d.userId === currentUser?.id).length === 0 && (
                          <p className="text-xs text-gray-400 py-4 text-center w-full">이 달에 배정된 당직이 없습니다.</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 2: Target Date Calendar */}
              {fromDate && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black">2</div>
                          <CardTitle className="text-sm font-bold">교환할 날짜 선택</CardTitle>
                        </div>
                        {/* Month navigation */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const prev = swapMonth === 1 ? 12 : swapMonth - 1;
                              const prevYear = swapMonth === 1 ? swapYear - 1 : swapYear;
                              setSwapMonth(prev);
                              setSwapYear(prevYear);
                              setToDate(null);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                          >
                            <ChevronLeft className="w-4 h-4 text-gray-400" />
                          </button>
                          <span className="text-xs font-black text-indigo-600 min-w-[60px] text-center">
                            {swapYear}/{swapMonth}월
                          </span>
                          <button
                            onClick={() => {
                              const next = swapMonth === 12 ? 1 : swapMonth + 1;
                              const nextYear = swapMonth === 12 ? swapYear + 1 : swapYear;
                              setSwapMonth(next);
                              setSwapYear(nextYear);
                              setToDate(null);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 mb-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                          <span
                            key={i}
                            className={`text-[9px] font-black text-center uppercase tracking-widest ${
                              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                            }`}
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {daysInMonthList.map((day, index) => (
                          <SwapCalendarDay
                            key={index}
                            index={index}
                            day={day}
                            duty={day ? dutyMap.get(day) || null : null}
                            isMyDuty={day ? myDutyDates.has(day) : false}
                            isSelected={toDate === day}
                            isFromDate={fromDate === day}
                            isToday={
                              day === now.getDate() &&
                              swapMonth === now.getMonth() + 1 &&
                              swapYear === now.getFullYear()
                            }
                            isHoliday={day ? swapHolidaySet.has(day) : false}
                            onClick={handleToDateSelect}
                          />
                        ))}
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 bg-orange-500 rounded" />
                          <span className="text-[9px] font-bold text-gray-400">내 당직</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 bg-indigo-600 rounded" />
                          <span className="text-[9px] font-bold text-gray-400">교환 대상</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 bg-gray-200 rounded" />
                          <span className="text-[9px] font-bold text-gray-400">다른 사람</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Step 3: Swap Preview & Confirm */}
              {fromDate && toDate && toDuty && fromDuty && (
                <motion.div ref={step3Ref} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border border-indigo-100">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black">3</div>
                        <CardTitle className="text-sm font-bold">교환 내용 확인</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-4">
                      {/* Swap visualization */}
                      <div className="flex items-center gap-3">
                        {/* From */}
                        <div className="flex-1 p-3 bg-orange-50 rounded-2xl border border-orange-100 text-center">
                          <p className="text-[9px] font-black text-orange-500 uppercase tracking-wider mb-1">내 당직</p>
                          <p className="text-lg font-black text-gray-900">{swapMonth}/{fromDate}일</p>
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mx-auto mt-2 text-orange-600 text-xs font-black">
                            {currentUser?.name.charAt(0)}
                          </div>
                          <p className="text-[10px] font-bold text-gray-500 mt-1">{currentUser?.name}</p>
                        </div>

                        {/* Arrow */}
                        <div className="flex flex-col items-center gap-1">
                          <ArrowLeftRight className="w-5 h-5 text-indigo-500" />
                          <span className="text-[8px] font-black text-indigo-400 uppercase">교환</span>
                        </div>

                        {/* To */}
                        <div className="flex-1 p-3 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mb-1">상대 당직</p>
                          <p className="text-lg font-black text-gray-900">{swapMonth}/{toDate}일</p>
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mt-2 text-indigo-600 text-xs font-black">
                            {toDuty.userName.charAt(0)}
                          </div>
                          <p className="text-[10px] font-bold text-gray-500 mt-1">{toDuty.userName}</p>
                        </div>
                      </div>

                      {/* Info notice */}
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                          교환 요청을 보내면 <strong>{toDuty.userName}</strong>님의 승인이 필요합니다.
                          승인 시 두 날짜의 당직이 서로 교환됩니다.
                        </p>
                      </div>

                      <Button
                        onClick={handleCreateSwap}
                        disabled={sending}
                        className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all"
                      >
                        {sending ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            전송 중...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            교환 요청 보내기
                          </div>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Guidance for empty state */}
              {!fromDate && duties.filter(d => d.userId === currentUser?.id).length > 0 && (
                <div className="flex items-start gap-2 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    교환하고 싶은 <strong>내 당직일</strong>을 먼저 선택하세요.
                    그런 다음 교환할 <strong>상대방의 당직일</strong>을 캘린더에서 선택하면 자동으로 교환 요청이 준비됩니다.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 pb-4"
            >
              {/* History sub-tabs */}
              <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => { setHistoryTab('received'); setShowPastItems(false); }}
                  className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-tight transition-all relative ${
                    historyTab === 'received'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400'
                  }`}
                >
                  받은 요청
                  {pendingReceivedCount > 0 && (
                    <span className="absolute -top-1.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full ring-2 ring-gray-100 font-black">
                      {pendingReceivedCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setHistoryTab('sent'); setShowPastItems(false); }}
                  className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-tight transition-all relative ${
                    historyTab === 'sent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                  }`}
                >
                  보낸 요청
                  {pendingSentCount > 0 && (
                    <span className="absolute -top-1.5 -right-0.5 w-4 h-4 bg-indigo-500 text-white text-[9px] flex items-center justify-center rounded-full ring-2 ring-gray-100 font-black">
                      {pendingSentCount}
                    </span>
                  )}
                </button>
              </div>

              {(() => {
                const pendingList = historyTab === 'received' ? pendingReceived : pendingSent;
                const pastList = historyTab === 'received' ? pastReceived : pastSent;

                return (
                  <div className="space-y-4">
                    {/* Pending Section - Blue Highlighted */}
                    {pendingList.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                            승인 대기 중 · {pendingList.length}건
                          </p>
                        </div>
                        {pendingList.map((request, idx) => (
                          <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            key={request.id}
                          >
                            <Card className="border-none shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700 ring-1 ring-indigo-500/20">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm bg-white/20 text-white backdrop-blur-sm">
                                      {historyTab === 'received'
                                        ? request.fromUserName.charAt(0)
                                        : request.toUserName.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-indigo-200 font-black uppercase tracking-tight">
                                        {historyTab === 'received' ? '보낸 이' : '받는 이'}
                                      </p>
                                      <p className="text-sm font-black text-white">
                                        {historyTab === 'received' ? request.fromUserName : request.toUserName}
                                      </p>
                                    </div>
                                  </div>
                                  <Badge className="rounded-full text-[9px] px-2.5 py-1 font-black uppercase bg-white/20 text-white backdrop-blur-sm border-none">
                                    <Clock className="w-2.5 h-2.5 mr-1" />
                                    대기 중
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-white/10 backdrop-blur-sm rounded-xl mb-3">
                                  <div className="flex-1 text-center">
                                    <p className="text-[9px] font-bold text-indigo-200 uppercase">
                                      {request.fromDate ? request.fromUserName : '요청자'}
                                    </p>
                                    <p className="text-sm font-black text-white">
                                      {request.month}/{request.fromDate || request.date}일
                                    </p>
                                  </div>
                                  <ArrowLeftRight className="w-4 h-4 text-indigo-200 shrink-0" />
                                  <div className="flex-1 text-center">
                                    <p className="text-[9px] font-bold text-indigo-200 uppercase">
                                      {request.toDate ? request.toUserName : '대상자'}
                                    </p>
                                    <p className="text-sm font-black text-white">
                                      {request.toDate ? `${request.month}/${request.toDate}일` : '-'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <p className="text-[9px] text-indigo-300 uppercase tracking-wider font-bold">
                                    {new Date(request.createdAt).toLocaleDateString('ko-KR')}
                                  </p>

                                  {historyTab === 'received' && (
                                    <div className="flex gap-2">
                                      <Button
                                        variant="ghost"
                                        className="h-9 rounded-xl text-white hover:bg-white/10 font-black text-xs px-3 border border-white/20 active:scale-95 transition-all"
                                        onClick={() => handleRespond(request.id, 'reject')}
                                      >
                                        <X className="w-3 h-3 mr-1" /> 거절
                                      </Button>
                                      <Button
                                        className="h-9 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-xs px-4 shadow-lg active:scale-95 transition-all"
                                        onClick={() => handleRespond(request.id, 'approve')}
                                      >
                                        <Check className="w-3 h-3 mr-1" /> 승인
                                      </Button>
                                    </div>
                                  )}

                                  {historyTab === 'sent' && (
                                    <Button
                                      variant="ghost"
                                      className="h-9 rounded-xl text-white/80 hover:bg-white/10 font-black text-xs px-3 border border-white/20 active:scale-95 transition-all"
                                      onClick={() => {
                                        setConfirmState({
                                          open: true,
                                          title: '교환 요청 취소',
                                          description: '이 교환 요청을 취소하시겠습니까?',
                                          variant: 'destructive',
                                          onConfirm: () => handleRespond(request.id, 'cancel'),
                                        });
                                      }}
                                    >
                                      요청 취소
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Only pending empty but has past */}
                    {pendingList.length === 0 && pastList.length > 0 && (
                      <div className="py-6 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-1.5 text-green-300" />
                        <p className="text-xs font-bold tracking-tight text-gray-400">
                          대기 중인 요청이 없습니다
                        </p>
                      </div>
                    )}

                    {/* Past Items - Collapsible (includes approved swaps) */}
                    {pastList.length > 0 && (
                      <div className="space-y-3">
                        <button
                          onClick={() => { setShowPastItems(!showPastItems); setPastItemsLimit(10); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-[0.99] transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-gray-400" />
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                              처리 완료 · {pastList.length}건
                            </p>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showPastItems ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                          {showPastItems && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              {(() => {
                                const hasMore = pastList.length > pastItemsLimit;
                                const visibleItems = pastList.slice(0, pastItemsLimit);

                                return (
                                  <div className="space-y-2">
                                    {visibleItems.map((request, idx) => {
                                      const isApproved = request.status === 'approved';

                                      return (
                                        <motion.div
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: idx * 0.03 }}
                                          key={request.id}
                                        >
                                          <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                                            isApproved
                                              ? 'bg-green-50/60 border-green-100'
                                              : 'bg-red-50/60 border-red-100'
                                          }`}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                                              isApproved
                                                ? 'bg-green-600'
                                                : 'bg-red-500'
                                            }`}>
                                              {isApproved
                                                ? <Check className="w-3.5 h-3.5 text-white" />
                                                : <X className="w-3.5 h-3.5 text-white" />
                                              }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <p className="text-xs font-bold text-gray-700 truncate">
                                                  {historyTab === 'received' ? request.fromUserName : request.toUserName}
                                                </p>
                                                <span className="text-[9px] text-gray-400">·</span>
                                                <p className="text-[9px] font-bold text-gray-400">
                                                  {request.month}/{request.fromDate || request.date}일 ↔ {request.toDate ? `${request.month}/${request.toDate}일` : '-'}
                                                </p>
                                              </div>
                                              <p className="text-[9px] text-gray-400 font-medium mt-0.5">
                                                {new Date(request.createdAt).toLocaleDateString('ko-KR')}
                                              </p>
                                            </div>
                                            <Badge className={`rounded-full text-[8px] px-1.5 py-0.5 font-black shrink-0 border-none ${
                                              isApproved
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-600'
                                            }`}>
                                              {isApproved ? '승인완료' : request.status === 'cancelled' ? '취소' : '거절완료'}
                                            </Badge>
                                          </div>
                                        </motion.div>
                                      );
                                    })}

                                    {/* Load more button */}
                                    {hasMore && (
                                      <button
                                        onClick={() => setPastItemsLimit(prev => prev + 10)}
                                        className="w-full py-3 bg-white rounded-xl border border-gray-100 shadow-sm text-[11px] font-black text-indigo-600 uppercase tracking-wider hover:bg-indigo-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                                      >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                        더보기 ({pastList.length - pastItemsLimit}건 남음)
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Empty state - no items at all */}
                    {pendingList.length === 0 && pastList.length === 0 && (
                      <div className="py-20 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
                        <MessageSquare className="w-14 h-14 mx-auto mb-3 opacity-10" />
                        <p className="text-sm font-bold tracking-tight">
                          {historyTab === 'received' ? '받은 교환 요청이 없습니다.' : '보낸 교환 요청이 없습니다.'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white backdrop-blur-xl border-t border-gray-100 px-6 pt-2 flex items-center justify-between max-w-lg mx-auto w-full rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] nav-bottom-safe"
        style={{ minHeight: '80px' }}
      >
        <button
          onClick={() => startNavigation('/dashboard', navigate)}
          className="flex flex-col items-center justify-center space-y-1.5 text-gray-400 hover:text-indigo-600 transition-all active:scale-90 flex-1"
        >
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-tight">당직일정</span>
        </button>
        <button className="flex flex-col items-center justify-center space-y-1.5 text-indigo-600 flex-1 relative active:scale-90 transition-all">
          <div className="relative">
            <ArrowLeftRight className="w-6 h-6" />
            {pendingReceivedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-black uppercase tracking-tight">당직교환</span>
        </button>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => startNavigation('/admin', navigate)}
            className="flex flex-col items-center justify-center space-y-1.5 text-gray-400 hover:text-indigo-600 transition-all active:scale-90 flex-1"
          >
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
    </div>
  );
}