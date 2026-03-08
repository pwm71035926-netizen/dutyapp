import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Check, 
  X, 
  Clock, 
  ArrowRight, 
  MessageSquare, 
  Calendar as CalendarIcon, 
  Settings, 
  LogOut,
  User as UserIcon,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

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
  createdAt: string;
}

interface User {
  id: string;
  role: string;
}

export default function SwapRequests() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'received' | 'sent'>('received');

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

      const { requests: loadedRequests } = await api.getSwapRequests(session.access_token);
      setRequests(loadedRequests || []);
    } catch (error: any) {
      console.error('Failed to load swap requests:', error);
      toast.error('교환 요청을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (requestId: string, action: 'approve' | 'reject') => {
    if (!token) return;

    try {
      await api.respondToSwapRequest(token, requestId, action);
      toast.success(action === 'approve' ? '요청을 승인했습니다.' : '요청을 거절했습니다.');
      loadData();
    } catch (error: any) {
      console.error('Failed to respond to swap request:', error);
      toast.error(error.message || '응답 처리 실패');
    }
  };

  const handleLogout = async () => {
    await api.logout();
    navigate('/');
  };

  const sentRequests = requests.filter((r) => r.fromUserId === currentUser?.id);
  const receivedRequests = requests.filter((r) => r.toUserId === currentUser?.id);
  const pendingReceivedCount = receivedRequests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Clock className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">교환 요청 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  const activeList = tab === 'received' ? receivedRequests : sentRequests;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* iOS/Android Status Bar Safe Area */}
      <div className="sticky top-0 left-0 right-0 z-50 bg-white h-10 w-full" />

      <header className="sticky top-10 z-30 bg-white/80 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">당직 교환</h1>
          </div>
          <Badge variant="outline" className="rounded-full border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-3">
            {activeList.length}건
          </Badge>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Tab Switcher */}
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => setTab('received')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative ${
              tab === 'received' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            받은 요청
            {pendingReceivedCount > 0 && (
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === 'sent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            보낸 요청
          </button>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {activeList.length === 0 ? (
            <div className="py-20 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
               <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-10" />
               <p className="text-sm font-medium">{tab === 'received' ? '받은 요청이 없습니다.' : '보낸 요청이 없습니다.'}</p>
            </div>
          ) : (
            activeList.map((request, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={request.id}
              >
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          tab === 'received' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'
                        }`}>
                          {tab === 'received' ? request.fromUserName.charAt(0) : request.toUserName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">
                            {tab === 'received' ? '보낸 사람' : '받는 사람'}
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {tab === 'received' ? request.fromUserName : request.toUserName}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={request.status === 'pending' ? 'secondary' : request.status === 'approved' ? 'default' : 'destructive'}
                        className="rounded-lg text-[10px] px-2"
                      >
                        {request.status === 'pending' ? '대기 중' : request.status === 'approved' ? '승인됨' : '거절됨'}
                      </Badge>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-gray-700">
                          {request.year}년 {request.month}월 {request.date}일 당직
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>

                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-4">
                      요청일: {new Date(request.createdAt).toLocaleDateString('ko-KR')}
                    </p>

                    {tab === 'received' && request.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold"
                          onClick={() => handleRespond(request.id, 'approve')}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          승인
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-11 rounded-xl text-red-500 hover:bg-red-50 font-bold border border-red-100"
                          onClick={() => handleRespond(request.id, 'reject')}
                        >
                          <X className="w-4 h-4 mr-2" />
                          거절
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t px-6 py-2 flex items-center justify-between max-w-lg mx-auto w-full h-16 rounded-t-3xl shadow-2xl">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex flex-col items-center justify-center space-y-1 text-gray-400 hover:text-indigo-500 transition-colors flex-1"
        >
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">일정</span>
        </button>
        <button 
          onClick={() => navigate('/swap-requests')}
          className="flex flex-col items-center justify-center space-y-1 text-indigo-600 flex-1 relative"
        >
          <div className="relative">
            <MessageSquare className="w-6 h-6" />
            {pendingReceivedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">교환</span>
        </button>
        {currentUser?.role === 'admin' && (
          <button 
            onClick={() => navigate('/generate')}
            className="flex flex-col items-center justify-center space-y-1 text-gray-400 hover:text-indigo-500 transition-colors flex-1"
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">관리</span>
          </button>
        )}
        <button 
          onClick={handleLogout}
          className="flex flex-col items-center justify-center space-y-1 text-gray-400 hover:text-red-500 transition-colors flex-1"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">로그아웃</span>
        </button>
      </nav>
    </div>
  );
}
