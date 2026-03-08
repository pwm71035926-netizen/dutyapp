import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { CalendarDays, User as UserIcon, Lock, ShieldQuestion, HelpCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  
  // Reset Password State
  const [resetUsername, setResetUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: username, 2: answer/new pass
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const session = await api.getSession();
      if (session?.access_token) {
        // If we have a session, try to get the user to verify it's valid
        await api.getCurrentUser(session.access_token);
        navigate('/dashboard');
      }
    } catch (error) {
      // Session invalid or expired
      console.log('No valid session found');
    } finally {
      setCheckingSession(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await api.login(username, password);
      
      if (result.session?.access_token) {
        try {
          await api.getCurrentUser(result.session.access_token);
          
          // Save remember preference if needed (though Supabase persists by default, 
          // we can handle specific logic here if we wanted to clear it on logout)
          localStorage.setItem('gongdang_remember_me', rememberMe ? 'true' : 'false');
          
          toast.success('로그인 성공!');
          navigate('/dashboard');
        } catch (tokenError: any) {
          console.error('Token validation failed:', tokenError);
          toast.error('인증에 실패했습니다. 다시 시도해주세요.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetSecurityQuestion = async () => {
    if (!resetUsername) {
      toast.error('아이디를 입력하세요.');
      return;
    }
    setResetLoading(true);
    try {
      const { question } = await api.getSecurityQuestion(resetUsername);
      setSecurityQuestion(question);
      setResetStep(2);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!securityAnswer || !newPassword) {
      toast.error('보안 답변과 새 비밀번호를 입력하세요.');
      return;
    }
    setResetLoading(true);
    try {
      await api.resetPassword(resetUsername, securityAnswer, newPassword);
      toast.success('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인하세요.');
      setIsResetDialogOpen(false);
      setResetStep(1);
      setResetUsername('');
      setSecurityAnswer('');
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResetLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 opacity-20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 pt-14 select-none overflow-hidden">
      {/* iOS/Android Status Bar Safe Area */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white h-12 w-full pt-safe" />

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
        <Card className="border-none shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[40px] overflow-hidden bg-white/80 backdrop-blur-xl border border-white">
          <CardHeader className="space-y-1 text-center bg-transparent pb-2 pt-12">
            <div className="flex justify-center mb-8">
              <div className="p-5 bg-indigo-600 rounded-[32px] shadow-2xl shadow-indigo-100 relative">
                <CalendarDays className="w-10 h-10 text-white" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-black text-gray-900 tracking-tighter mb-1">공병반 당직 관리</CardTitle>
            <CardDescription className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">공당 모바일 서비스</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10 pt-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 ml-1">
                  <UserIcon className="w-3.5 h-3.5" /> 아이디
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:border-indigo-500/50 transition-all text-base text-gray-900"
                  value={username}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
                    setUsername(value);
                  }}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  lang="en"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                   <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                     <Lock className="w-3.5 h-3.5" /> 비밀번호
                   </Label>
                   <Dialog open={isResetDialogOpen} onOpenChange={(open) => {
                     setIsResetDialogOpen(open);
                     if (!open) { setResetStep(1); setResetUsername(''); setSecurityAnswer(''); setNewPassword(''); }
                   }}>
                     <DialogTrigger asChild>
                       <button type="button" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors">비밀번호 찾기</button>
                     </DialogTrigger>
                     <DialogContent className="sm:max-w-md w-[95vw] rounded-[32px] p-6 bg-white border border-gray-100 shadow-2xl">
                       <DialogHeader>
                         <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
                            <ShieldQuestion className="w-6 h-6 text-indigo-600" />
                            비밀번호 찾기
                         </DialogTitle>
                         <DialogDescription className="text-gray-500">
                            보안 질문에 답하여 비밀번호를 초기화합니다.
                         </DialogDescription>
                       </DialogHeader>
                       
                       <div className="py-6 space-y-4">
                         {resetStep === 1 ? (
                           <div className="space-y-2">
                             <Label htmlFor="reset-id" className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">아이디</Label>
                             <Input 
                               id="reset-id" 
                               value={resetUsername} 
                               onChange={(e) => {
                                 const value = e.target.value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
                                 setResetUsername(value);
                               }} 
                               placeholder="아이디를 입력하세요"
                               className="h-14 rounded-2xl bg-gray-50 border-gray-100 text-gray-900"
                               autoCapitalize="none"
                               autoCorrect="off"
                               spellCheck={false}
                               lang="en"
                             />
                           </div>
                         ) : (
                           <>
                             <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 mb-4">
                                <p className="text-[10px] uppercase font-black text-indigo-400 mb-1 tracking-widest">보안 질문</p>
                                <p className="text-sm font-bold text-indigo-900">{securityQuestion}</p>
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="reset-answer" className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">답변</Label>
                               <Input 
                                 id="reset-answer" 
                                 value={securityAnswer} 
                                 onChange={(e) => setSecurityAnswer(e.target.value)} 
                                 placeholder="답변 입력"
                                 className="h-14 rounded-2xl bg-gray-50 border-gray-100 text-gray-900"
                               />
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="new-password" className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">새 비밀번호</Label>
                               <Input 
                                 id="new-password" 
                                 type="password"
                                 value={newPassword} 
                                 onChange={(e) => {
                                   const value = e.target.value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
                                   setNewPassword(value);
                                 }} 
                                 placeholder="6자 이상"
                                 className="h-14 rounded-2xl bg-gray-50 border-gray-100 text-gray-900"
                                 minLength={6}
                               />
                             </div>
                           </>
                         )}
                       </div>
                       
                       <DialogFooter className="flex gap-2 sm:justify-end">
                         {resetStep === 1 ? (
                           <Button 
                             onClick={handleGetSecurityQuestion} 
                             className="h-14 w-full rounded-2xl bg-indigo-600 font-black tracking-widest text-white"
                             disabled={resetLoading}
                           >
                             질문 확인
                           </Button>
                         ) : (
                           <Button 
                             onClick={handleResetPassword} 
                             className="h-14 w-full rounded-2xl bg-indigo-600 font-black tracking-widest text-white"
                             disabled={resetLoading}
                           >
                             비밀번호 변경
                           </Button>
                         )}
                       </DialogFooter>
                     </DialogContent>
                   </Dialog>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:border-indigo-500/50 transition-all text-base text-gray-900"
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
                    setPassword(value);
                  }}
                  required
                />
              </div>
              <div className="flex items-center space-x-2 ml-1">
                <Checkbox 
                  id="remember-me" 
                  checked={rememberMe} 
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="w-5 h-5 rounded-md border-gray-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <Label htmlFor="remember-me" className="text-xs font-bold text-gray-500 cursor-pointer select-none">자동 로그인</Label>
              </div>
              <Button type="submit" className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black text-lg shadow-2xl shadow-indigo-100 transition-all active:scale-[0.98] tracking-widest text-white" disabled={loading}>
                {loading ? '로그인 중...' : '로그인'}
              </Button>
            </form>
            <div className="mt-10 text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">또는 아래 버튼으로 시작하세요</p>
              <button
                onClick={() => navigate('/signup')}
                className="h-14 w-full rounded-2xl border border-gray-100 bg-white text-indigo-600 hover:bg-gray-50 font-bold transition-all active:scale-95 shadow-sm"
              >
                회원가입
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
