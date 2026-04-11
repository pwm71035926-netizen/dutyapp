import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// Singleton Supabase client
const getSupabaseClient = () => {
  if (typeof window === 'undefined') {
    return createClient(`https://${projectId}.supabase.co`, publicAnonKey);
  }

  const global = window as any;
  if (!global.__supabaseInstance) {
    global.__supabaseInstance = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      }
    );
  }
  return global.__supabaseInstance;
};

export const supabase = getSupabaseClient();

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a032f464`;

export const api = {
  async healthCheck() {
    const response = await fetch(`${API_BASE_URL}/health`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
    return response.json();
  },

  async signup(data: { username: string; password?: string; name: string; role: string; securityQuestion: string; securityAnswer: string; serviceNumber?: string }) {
    const { username, password, name, role, securityQuestion, securityAnswer, serviceNumber } = data;
    
    // Ensure username is a string
    const stringUsername = typeof username === 'string' ? username : (username as any).username;

    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ 
        username: stringUsername, 
        password, 
        name, 
        role, 
        securityQuestion, 
        securityAnswer,
        serviceNumber 
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    return response.json();
  },

  async login(username: string, password: string) {
    const email = `${username}@internal.app`;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async getSecurityQuestion(username: string) {
    const response = await fetch(`${API_BASE_URL}/get-security-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '질문을 가져오는데 실패했습니다.');
    }

    return response.json();
  },

  async resetPassword(username: string, securityAnswer: string, newPassword: string) {
    const response = await fetch(`${API_BASE_URL}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ username, securityAnswer, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '비밀번호 재설정에 실패했습니다.');
    }

    return response.json();
  },

  async logout() {
    await supabase.auth.signOut();
    localStorage.clear();
    if (window.location) window.location.href = '/';
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getCurrentUser(token: string) {
    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user');
    }

    return response.json();
  },

  async getUsers(token: string) {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get users');
    }

    return response.json();
  },

  async getDuties(token: string, year: number, month: number) {
    const response = await fetch(`${API_BASE_URL}/duties/${year}/${month}`, {
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get duties');
    }

    return response.json();
  },

  async saveDuties(token: string, year: number, month: number, duties: any[]) {
    const response = await fetch(`${API_BASE_URL}/duties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify({ year, month, duties }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save duties');
    }

    return response.json();
  },

  async generateDuties(token: string, year: number, month: number, weekdayUsers: string[], weekendUsers: string[], exclusions: { userId: string, startDate: string, endDate: string }[] = [], customHolidays: string[] = [], fridayAsWeekend: boolean = true, combatRestDays: string[] = []) {
    const response = await fetch(`${API_BASE_URL}/duties/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify({ year, month, weekdayUsers, weekendUsers, exclusions, customHolidays, fridayAsWeekend, combatRestDays }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate duties');
    }

    return response.json();
  },

  async createSwapRequest(token: string, toUserId: string, year: number, month: number, date: number) {
    const response = await fetch(`${API_BASE_URL}/swap-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify({ toUserId, year, month, date }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create swap request');
    }

    return response.json();
  },

  async getSwapRequests(token: string) {
    const response = await fetch(`${API_BASE_URL}/swap-requests`, {
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get swap requests');
    }

    return response.json();
  },

  async respondToSwapRequest(token: string, requestId: string, action: 'approve' | 'reject' | 'cancel') {
    const response = await fetch(`${API_BASE_URL}/swap-requests/${requestId}/${action}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to respond to swap request');
    }

    return response.json();
  },

  async getNotifications(token: string) {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get notifications');
    }

    return response.json();
  },

  async markNotificationAsRead(token: string, notificationId: number) {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to mark notification as read');
    }

    return response.json();
  },

  async deleteNotifications(token: string, ids: number[] = [], all: boolean = false) {
    const response = await fetch(`${API_BASE_URL}/notifications/delete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
      body: JSON.stringify({ ids, all }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete notifications');
    }

    return response.json();
  },

  async createDutyNotifications(token: string) {
    const response = await fetch(`${API_BASE_URL}/create-duty-notifications`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create duty notifications');
    }

    return response.json();
  },
  
  async updateUserRole(token: string, userId: string, role: 'admin' | 'user') {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '역할 변경 실패');
    }

    return response.json();
  },

  async updateMe(token: string, data: { name: string, password?: string, serviceNumber?: string }) {
    const response = await fetch(`${API_BASE_URL}/me/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '프로필 수정 실패');
    }

    return response.json();
  },

  async updateUserServiceNumber(token: string, userId: string, serviceNumber: string) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/service-number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify({ serviceNumber }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '군번 수정 실패');
    }

    return response.json();
  },

  async deleteUser(token: string, userId: string) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '사용자 삭제 실패');
    }

    return response.json();
  },

  async bulkDeleteNonAdmins(token: string) {
    const response = await fetch(`${API_BASE_URL}/users/bulk-delete-non-admins`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '일괄 삭제 실패');
    }

    return response.json();
  },

  async getDutyPrices() {
    const response = await fetch(`${API_BASE_URL}/settings/duty-prices`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    if (!response.ok) throw new Error('단가 정보를 가져오는데 실패했습니다.');
    return response.json();
  },

  async updateDutyPrices(token: string, weekday: number, weekend: number) {
    const response = await fetch(`${API_BASE_URL}/settings/duty-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify({ weekday, weekend }),
    });
    if (!response.ok) throw new Error('단가 수정 실패');
    return response.json();
  },

  async createSwapRequestV2(token: string, fromYear: number, fromMonth: number, fromDate: number, toYear: number, toMonth: number, toDate: number, mode: 'mutual' | 'oneway' = 'mutual') {
    const response = await fetch(`${API_BASE_URL}/swap-requests-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify({ fromYear, fromMonth, fromDate, toYear, toMonth, toDate, mode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '교환 요청 생성 실패');
    }

    return response.json();
  },

  async createOnewaySwap(token: string, toYear: number, toMonth: number, toDate: number) {
    const response = await fetch(`${API_BASE_URL}/swap-requests-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
      body: JSON.stringify({ toYear, toMonth, toDate, mode: 'oneway' }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '대리근무 요청 생성 실패');
    }

    return response.json();
  },

  async respondToSwapRequestV2(token: string, requestId: string, action: 'approve' | 'reject' | 'cancel') {
    const response = await fetch(`${API_BASE_URL}/swap-requests-v2/${requestId}/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'x-user-token': token
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '요청 처리 실패');
    }

    return response.json();
  },
};