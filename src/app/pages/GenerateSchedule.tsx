import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
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
  ShieldAlert
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

import { Badge } from '../components/ui/badge';

interface User {
  id: string;
  username?: string;
  email?: string;
  name: string;
  role: string;
}

export default function GenerateSchedule() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'schedule' | 'users'>('schedule');
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  
  // States for ordered sequences
  const [weekdaySequence, setWeekdaySequence] = useState<string[]>([]);
  const [weekendSequence, setWeekendSequence] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const session = await api.getSession();
      if (!session) {
        navigate('/');
        return;
      }

      setToken(session.access_token);
      const { user } = await api.getCurrentUser(session.access_token);
      setCurrentUser(user);
      
      if (user.role !== 'admin') {
        toast.error('관리자만 접근할 수 있습니다.');
        navigate('/dashboard');
        return;
      }

      const { users: allUsers } = await api.getUsers(session.access_token);
      setUsers(allUsers);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('데이터를 불러오지 못했습니다.');
      navigate('/dashboard');
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    if (!token) return;
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const confirmMsg = newRole === 'admin' 
      ? '해당 사용자를 관리자로 지정하시겠습니까?' 
      : '해당 사용자의 관리자 권한을 해제하시겠습니까?';
    
    if (!confirm(confirmMsg)) return;

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
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) return;
    if (userId === currentUser?.id) {
      toast.error('자기 자신은 삭제할 수 없습니다.');
      return;
    }

    if (!confirm('정말로 이 사용자를 삭제하시겠습니까? 관련 데이터는 유지되지만 로그인이 불가능해집니다.')) return;

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
  };

  const handleBulkDeleteNonAdmins = async () => {
    if (!token) return;
    
    const nonAdmins = users.filter(u => u.role !== 'admin');
    if (nonAdmins.length === 0) {
      toast.info('삭제할 일반 사용자가 없습니다.');
      return;
    }

    if (!confirm(`관리자를 제외한 모든 사용자(${nonAdmins.length}명)를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 일반 대원은 즉시 로그인이 차단됩니다.`)) return;

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
      await api.generateDuties(token, year, month, weekdaySequence, weekendSequence);
      toast.success('당직 일정이 성공적으로 생성되었습니다!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to generate duties:', error);
      toast.error(error.message || '일정 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const getUserById = (id: string) => users.find(u => u.id === id);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* iOS/Android Status Bar Safe Area */}
      <div className="sticky top-0 left-0 right-0 z-50 bg-white h-10 w-full" />

      <header className="sticky top-10 z-30 bg-white/80 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full">
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
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'schedule' ? (
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
                      <Label htmlFor="year" className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">년도</Label>
                      <Input
                        id="year"
                        type="number"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="rounded-xl border-gray-100 bg-gray-50 h-11 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="month" className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">월</Label>
                      <Input
                        id="month"
                        type="number"
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="rounded-xl border-gray-100 bg-gray-50 h-11 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
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
                           className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                             weekdaySequence.includes(user.id)
                               ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                               : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                           }`}
                         >
                           {user.name}
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
                           className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                             weekendSequence.includes(user.id)
                               ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                               : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                           }`}
                         >
                           {user.name}
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
                            <p className="text-xs text-gray-400">{user.username || user.email?.split('@')[0]}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                           <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-xl text-gray-400">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xs w-[85vw] rounded-3xl p-6">
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
    </div>
  );
}
