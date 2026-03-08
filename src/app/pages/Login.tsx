import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { CalendarDays, User as UserIcon, Lock, ShieldQuestion, HelpCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Reset Password State
  const [resetUsername, setResetUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: username, 2: answer/new pass
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await api.login(username, password);
      
      if (result.session?.access_token) {
        try {
          await api.getCurrentUser(result.session.access_token);
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 pt-14">
      {/* iOS/Android Status Bar Safe Area */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white h-10 w-full" />

      <div className="w-full max-w-md">
        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="space-y-1 text-center bg-white pb-2 pt-10">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-100">
                <CalendarDays className="w-10 h-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-gray-900 tracking-tight">공병반 당직 관리 시스템</CardTitle>
            <CardDescription className="text-gray-500 font-medium">서비스를 이용하려면 로그인하세요</CardDescription>
          </CardHeader>
          <CardContent className="bg-white px-8 pb-8 pt-6">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 ml-1">
                  <UserIcon className="w-4 h-4" /> 아이디
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all text-base"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  lang="en"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                   <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                     <Lock className="w-4 h-4" /> 비밀번호
                   </Label>
                   <Dialog open={isResetDialogOpen} onOpenChange={(open) => {
                     setIsResetDialogOpen(open);
                     if (!open) { setResetStep(1); setResetUsername(''); setSecurityAnswer(''); setNewPassword(''); }
                   }}>
                     <DialogTrigger asChild>
                       <button type="button" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">비밀번호 찾기</button>
                     </DialogTrigger>
                     <DialogContent className="sm:max-w-md w-[95vw] rounded-3xl p-6">
                       <DialogHeader>
                         <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <ShieldQuestion className="w-6 h-6 text-indigo-600" />
                            비밀번호 재설정
                         </DialogTitle>
                         <DialogDescription>
                            가입 시 설정한 보안 질문에 답하여 비밀번호를 다시 설정합니다.
                         </DialogDescription>
                       </DialogHeader>
                       
                       <div className="py-4 space-y-4">
                         {resetStep === 1 ? (
                           <div className="space-y-2">
                             <Label htmlFor="reset-id" className="text-xs font-bold text-gray-500">가입한 아이디</Label>
                             <Input 
                               id="reset-id" 
                               value={resetUsername} 
                               onChange={(e) => setResetUsername(e.target.value)} 
                               placeholder="아이디를 입력하세요"
                               className="h-12 rounded-xl"
                               autoCapitalize="none"
                               autoCorrect="off"
                               spellCheck={false}
                               lang="en"
                             />
                           </div>
                         ) : (
                           <>
                             <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 mb-4">
                                <p className="text-[10px] uppercase font-black text-indigo-400 mb-1">보안 질문</p>
                                <p className="text-sm font-bold text-indigo-900">{securityQuestion}</p>
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="reset-answer" className="text-xs font-bold text-gray-500">답변</Label>
                               <Input 
                                 id="reset-answer" 
                                 value={securityAnswer} 
                                 onChange={(e) => setSecurityAnswer(e.target.value)} 
                                 placeholder="보안 답변을 입력하세요"
                                 className="h-12 rounded-xl"
                               />
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="new-password" className="text-xs font-bold text-gray-500">새 비밀번호</Label>
                               <Input 
                                 id="new-password" 
                                 type="password"
                                 value={newPassword} 
                                 onChange={(e) => setNewPassword(e.target.value)} 
                                 placeholder="6자 이상의 새 비밀번호"
                                 className="h-12 rounded-xl"
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
                             className="h-12 rounded-xl bg-indigo-600 font-bold px-6"
                             disabled={resetLoading}
                           >
                             질문 가져오기
                           </Button>
                         ) : (
                           <Button 
                             onClick={handleResetPassword} 
                             className="h-12 rounded-xl bg-indigo-600 font-bold px-6"
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
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all text-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold text-lg shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]" disabled={loading}>
                {loading ? '로그인 중...' : '로그인'}
              </Button>
            </form>
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-400 font-medium">계정이 없으신가요?</p>
              <button
                onClick={() => navigate('/signup')}
                className="mt-2 h-12 w-full rounded-2xl border border-gray-100 text-indigo-600 hover:bg-indigo-50 font-bold transition-colors"
              >
                공병반이라면 회원가입
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
