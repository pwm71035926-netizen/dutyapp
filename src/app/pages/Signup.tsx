import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { CalendarDays, User as UserIcon, Lock, HelpCircle, ShieldCheck } from 'lucide-react';

const SECURITY_QUESTIONS = [
  "가장 기억에 남는 선생님 성함은?",
  "태어난 고향은 어디인가요?",
  "가장 좋아하는 음식은?",
  "첫 번째 반려동물의 이름은?",
  "학창 시절 별명은 무엇인가요?",
  "아버지의 성함은?",
  "어머니의 성함은?"
];

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.signup(username, password, name, role, securityQuestion, securityAnswer);
      toast.success('회원가입 성공! 로그인해주세요.');
      navigate('/');
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || '회원가입 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 pt-14 flex-col">
      {/* iOS/Android Status Bar Safe Area */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white h-10 w-full" />

      <div className="w-full max-w-md">
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="space-y-1 text-center bg-white pb-2 pt-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                <CalendarDays className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">회원가입</CardTitle>
            <CardDescription className="text-gray-500">새로운 계정을 만드세요</CardDescription>
          </CardHeader>
          <CardContent className="bg-white px-8 pb-8 pt-4">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" /> 아이디
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  className="h-12 rounded-xl border-gray-100 bg-gray-50 focus:ring-indigo-500"
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
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-gray-500">이름</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="이름을 입력하세요"
                  className="h-12 rounded-xl border-gray-100 bg-gray-50"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> 비밀번호
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요 (6자 이상)"
                  className="h-12 rounded-xl border-gray-100 bg-gray-50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-50 mt-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> 비밀번호 찾기 설정
                </Label>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="question" className="text-[10px] font-bold text-gray-400">보안 질문</Label>
                    <Select value={securityQuestion} onValueChange={setSecurityQuestion}>
                      <SelectTrigger className="h-11 rounded-xl border-gray-100 bg-gray-50 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-gray-100 shadow-xl">
                        {SECURITY_QUESTIONS.map((q) => (
                          <SelectItem key={q} value={q} className="rounded-lg">
                            {q}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="answer" className="text-[10px] font-bold text-gray-400">답변</Label>
                    <Input
                      id="answer"
                      type="text"
                      placeholder="비밀번호 분실 시 사용할 답변"
                      className="h-11 rounded-xl border-gray-100 bg-gray-50 text-sm"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-xs font-bold uppercase tracking-wider text-gray-500">역할</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-12 rounded-xl border-gray-100 bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-gray-100 shadow-xl">
                    <SelectItem value="user" className="rounded-lg">일반 사용자</SelectItem>
                    <SelectItem value="admin" className="rounded-lg">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold mt-4 shadow-lg shadow-indigo-100" disabled={loading}>
                {loading ? '가입 중...' : '회원가입'}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              <p className="text-gray-500">이미 계정이 있으신가요?</p>
              <button
                onClick={() => navigate('/')}
                className="mt-1 text-indigo-600 hover:underline font-bold"
              >
                로그인 페이지로 돌아가기
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
