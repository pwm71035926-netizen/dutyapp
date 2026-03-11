import { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { NavigationContext } from '../context/NavigationContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { CalendarDays, User as UserIcon, Lock, ShieldCheck } from 'lucide-react';

const SECURITY_QUESTIONS = [
  "가장 기억에 남는 선생님 성함은?",
  "태어난 고향은 어디입니까?",
  "가장 좋아하는 음식은?",
  "반려동물의 이름은 무엇입니까?",
  "처음으로 가본 해외 여행지는?",
];

export default function Signup() {
  const navigate = useNavigate();
  const { startNavigation } = useContext(NavigationContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.signup({
        username,
        password,
        name,
        role,
        securityQuestion,
        securityAnswer
      });
      toast.success('회원가입 성공! 로그인해주세요.');
      startNavigation('/', navigate);
    } catch (error: any) {
      toast.error(error.message || '회원가입 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 pt-14 select-none overflow-y-auto">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white safe-top-spacer" />

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
        <Card className="border-none shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[40px] overflow-hidden bg-white/80 backdrop-blur-xl border border-white">
          <CardHeader className="space-y-1 text-center bg-transparent pb-2 pt-10">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-indigo-600 rounded-[28px] shadow-2xl shadow-indigo-100 relative">
                <CalendarDays className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-gray-900 tracking-tighter mb-1">신규 대원 등록</CardTitle>
            <CardDescription className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">공병반 대원 가입</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10 pt-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 ml-1">
                    <UserIcon className="w-3 h-3" /> 아이디
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="아이디"
                    className="h-12 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:border-indigo-500/50 transition-all text-sm text-gray-900"
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
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 ml-1">
                    성함
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="이름"
                    className="h-12 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:border-indigo-500/50 transition-all text-sm text-gray-900"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 ml-1">
                  <Lock className="w-3 h-3" /> 비밀번호
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="6자 이상"
                  className="h-12 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:border-indigo-500/50 transition-all text-sm text-gray-900"
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
                    setPassword(value);
                  }}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-100 mt-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 ml-1 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> 비밀번호 찾기 질문
                </Label>
                <div className="space-y-3">
                  <Select value={securityQuestion} onValueChange={setSecurityQuestion}>
                    <SelectTrigger className="h-12 rounded-2xl border-gray-100 bg-gray-50 text-sm text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-white border-gray-100 text-gray-900 shadow-2xl">
                      {SECURITY_QUESTIONS.map((q) => (
                        <SelectItem key={q} value={q} className="rounded-lg">
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="answer"
                    type="text"
                    placeholder="보안 답변"
                    className="h-12 rounded-2xl border-gray-100 bg-gray-50 text-sm text-gray-900"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">계정 권한</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-12 rounded-2xl border-gray-100 bg-gray-50 text-sm text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white border-gray-100 text-gray-900 shadow-2xl">
                    <SelectItem value="user" className="rounded-lg">일반사용자</SelectItem>
                    <SelectItem value="admin" className="rounded-lg">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black text-base shadow-2xl shadow-indigo-100 transition-all active:scale-[0.98] tracking-widest mt-4 text-white" disabled={loading}>
                {loading ? '등록 중...' : '가입하기'}
              </Button>
            </form>
            <div className="mt-8 text-center">
              <button
                onClick={() => startNavigation('/', navigate)}
                className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors"
              >
                이미 계정이 있습니까? 로그인
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}