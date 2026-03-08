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
  ChevronRight,
  ArrowLeftRight
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

  const sentRequests = requests.filter((r) => r.fromUserId === currentUser?.id);
  const receivedRequests = requests.filter((r) => r.toUserId === currentUser?.id);
  const pendingReceivedCount = receivedRequests.filter(r => r.status === 'pending').length;

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

  const activeList = tab === 'received' ? receivedRequests : sentRequests;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 select-none touch-pan-y">
      {/* iOS/Android Status Bar Safe Area */}
      <div className="sticky top-0 left-0 right-0 z-50 bg-white h-12 w-full pt-safe" />

      <header className="sticky top-12 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full text-gray-900 active:scale-90 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">당직 교환</h1>
          </div>
          <Badge variant="outline" className="rounded-full border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-tight px-3 bg-white">
            {activeList.length}개 요청
          </Badge>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Tab Switcher */}
        <div className="flex p-1.5 bg-white backdrop-blur-md rounded-2xl border border-gray-100 shadow-sm">
          <button
            onClick={() => setTab('received')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all relative ${
              tab === 'received' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            받은 요청
            {pendingReceivedCount > 0 && (
               <span className="absolute -top-2 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full animate-pulse ring-2 ring-white font-black shadow-lg">
                 {pendingReceivedCount}
               </span>
            )}
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${
              tab === 'sent' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            보낸 요청
          </button>
        </div>

        {/* Requests List */}
        <div className="space-y-6">
          {activeList.length === 0 ? (
            <div className="py-32 text-center text-gray-400 bg-white rounded-[32px] border border-dashed border-gray-200 shadow-sm">
               <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-10" />
               <p className="text-sm font-bold tracking-tight">{tab === 'received' ? '받은 교환 요청이 없습니다.' : '보낸 교환 요청이 없습니다.'}</p>
            </div>
          ) : (
            activeList.map((request, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={request.id}
              >
                <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-white border border-gray-50">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center font-black text-lg ${
                          tab === 'received' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'bg-orange-50 text-orange-600 shadow-sm'
                        }`}>
                          {tab === 'received' ? request.fromUserName.charAt(0) : request.toUserName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-tight mb-0.5">
                            {tab === 'received' ? '보낸 이' : '받는 이'}
                          </p>
                          <p className="text-base font-black text-gray-900 tracking-tight">
                            {tab === 'received' ? request.fromUserName : request.toUserName}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={request.status === 'pending' ? 'secondary' : request.status === 'approved' ? 'default' : 'destructive'}
                        className={`rounded-full text-[10px] px-3 py-1 font-black uppercase tracking-tight ${
                           request.status === 'pending' ? 'bg-gray-100 text-gray-500' : 
                           request.status === 'approved' ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 
                           'bg-red-600 text-white shadow-lg shadow-red-100'
                        }`}
                      >
                        {request.status === 'pending' ? '대기 중' : request.status === 'approved' ? '승인됨' : '거절됨'}
                      </Badge>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between mb-6 border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                           <CalendarIcon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-black text-gray-700 tracking-tight">
                          {request.year}년 {request.month}월 {request.date}일 당직
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300" />
                    </div>

                    <div className="flex items-center justify-between">
                       <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">
                         {new Date(request.createdAt).toLocaleDateString('ko-KR')}
                       </p>
                       
                       {tab === 'received' && request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            className="h-10 rounded-xl text-red-500 hover:bg-red-50 font-black text-xs px-4 border border-red-100 active:scale-95 transition-all"
                            onClick={() => handleRespond(request.id, 'reject')}
                          >
                            <X className="w-3.5 h-3.5 mr-2" /> 거절
                          </Button>
                          <Button
                            className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs px-6 shadow-xl shadow-indigo-100 active:scale-95 transition-all text-white"
                            onClick={() => handleRespond(request.id, 'approve')}
                          >
                            <Check className="w-3.5 h-3.5 mr-2" /> 승인
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-6 py-2 flex items-center justify-between max-w-lg mx-auto w-full h-20 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-safe">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex flex-col items-center justify-center space-y-1.5 text-gray-400 hover:text-indigo-600 transition-all active:scale-90 flex-1"
        >
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-tight">당직일정</span>
        </button>
        <button 
          className="flex flex-col items-center justify-center space-y-1.5 text-indigo-600 flex-1 relative active:scale-90 transition-all"
        >
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
            onClick={() => navigate('/generate')}
            className="flex flex-col items-center justify-center space-y-1.5 text-gray-400 hover:text-indigo-600 transition-all active:scale-90 flex-1"
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-tight">관리도구</span>
          </button>
        )}
      </nav>
    </div>
  );
}
