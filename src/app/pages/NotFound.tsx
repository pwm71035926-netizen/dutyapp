import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { CalendarDays, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-100">
        <CalendarDays className="w-10 h-10 text-indigo-600" />
      </div>
      <h1 className="text-6xl font-black text-gray-900 tracking-tighter mb-2">404</h1>
      <p className="text-lg font-bold text-gray-500 mb-1">페이지를 찾을 수 없습니다</p>
      <p className="text-sm text-gray-400 mb-8">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      <Button
        onClick={() => navigate('/')}
        className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-xl shadow-indigo-100"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        로그인 화면으로 돌아가기
      </Button>
    </div>
  );
}
