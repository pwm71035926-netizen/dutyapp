import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

// Global Error Handler
app.onError((err, c) => {
  console.error('[GlobalError]', err);
  const status = (err as any).status || 500;
  const message = err.message.includes('<!DOCTYPE html>') 
    ? '서버 통신 중 오류가 발생했습니다. (Supabase Gateway Error)' 
    : err.message;
    
  return c.json({ 
    error: message,
    stack: Deno.env.get('DENO_REGION') ? undefined : err.stack
  }, status);
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

// Helper function to verify user
async function verifyUser(req: any) {
  let token = req.header('x-user-token');
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader) token = authHeader.replace('Bearer ', '');
  }
  
  if (!token || token === 'undefined' || token === 'null' || token === supabaseAnonKey) return null;

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (err) {
    return null;
  }
}

// Health check
app.get('/make-server-a032f464/health', (c) => c.json({ status: 'ok' }));

// 회원가입
app.post('/make-server-a032f464/signup', async (c) => {
  try {
    const body = await c.req.json();
    console.log('Signup payload:', JSON.stringify(body));
    
    let { username, password, name, role = 'user', securityQuestion, securityAnswer, serviceNumber } = body;
    
    // Defensive check: if username is an object, try to extract string
    if (username && typeof username === 'object') {
      console.log('Warning: username is an object', username);
      username = username.username || String(username);
    }

    if (!username || typeof username !== 'string') {
      return c.json({ error: '올바른 아이디를 입력해주세요.' }, 400);
    }

    // Convert username to internal email
    const email = `${username.trim()}@internal.app`;

    // 1. 먼저 KV에 해당 아이디가 있는지 확인 (정상적인 중복 체크)
    const allUsersKV = await kv.getByPrefix('user:');
    const existingKVUser = allUsersKV.find((u: any) => u.username === username);

    if (existingKVUser) {
      return c.json({ error: '이미 사용 중인 아이디입니다.' }, 400);
    }

    // 2. Auth 생성을 시도
    let { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        username,
        name, 
        role, 
        securityQuestion, 
        securityAnswer,
        serviceNumber
      },
      email_confirm: true,
    });

    // 3. 만약 Auth에 이미 존재한다고 하면 (Ghost User 현상)
    if (error && error.message.includes('already been registered')) {
      console.log(`Ghost user detected for ${username}. Cleaning up...`);
      
      // Auth에서 해당 이메일의 유저를 찾아서 삭제 시도
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError && listData?.users) {
        const ghostUser = listData.users.find(u => u.email === email);
        if (ghostUser) {
          await supabaseAdmin.auth.admin.deleteUser(ghostUser.id);
          console.log(`Stale Auth user ${ghostUser.id} deleted.`);
          
          // 삭제 후 다시 생성 시도
          const retry = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            user_metadata: { username, name, role, securityQuestion, securityAnswer, serviceNumber },
            email_confirm: true,
          });
          data = retry.data;
          error = retry.error;
        }
      }
    }

    if (error) {
      console.error(`Signup error for ${email}: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    if (!data?.user) {
      return c.json({ error: '사용자 생성에 실패했습니다.' }, 500);
    }

    const userData = { id: data.user.id, username, name, role, serviceNumber };
    await kv.set(`user:${data.user.id}`, userData);
    
    return c.json({ success: true, user: userData });
  } catch (error: any) {
    console.error('Signup crash:', error);
    return c.json({ error: error.message }, 500);
  }
});

// 비밀번호 찾기: 질문 조회
app.post('/make-server-a032f464/get-security-question', async (c) => {
  try {
    const { username } = await c.req.json();
    const email = `${username}@internal.app`;
    
    // We need to find the user by email/username
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    
    const user = users.find(u => u.email === email || u.user_metadata?.username === username);
    if (!user) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);
    
    return c.json({ 
      question: user.user_metadata?.securityQuestion || '보안 질문이 설정되지 않았습니다.'
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 비밀번호 찾기: 재설정
app.post('/make-server-a032f464/reset-password', async (c) => {
  try {
    const { username, securityAnswer, newPassword } = await c.req.json();
    const email = `${username}@internal.app`;
    
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    
    const user = users.find(u => u.email === email || u.user_metadata?.username === username);
    if (!user) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);
    
    if (user.user_metadata?.securityAnswer !== securityAnswer) {
      return c.json({ error: '보안 답변이 일치하지 않습니다.' }, 400);
    }
    
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    
    if (updateError) throw updateError;
    
    return c.json({ success: true, message: '비밀번호가 성공적으로 재설정되었습니다.' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 사용자 목록
app.get('/make-server-a032f464/users', async (c) => {
  const user = await verifyUser(c.req);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ users: await kv.getByPrefix('user:') });
});

// 내 정보
app.get('/make-server-a032f464/me', async (c) => {
  const user = await verifyUser(c.req);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const userData = await kv.get(`user:${user.id}`);
  if (!userData) {
    const username = user.user_metadata?.username || user.email?.split('@')[0];
    const fallback = { 
      id: user.id, 
      username, 
      name: user.user_metadata?.name || username, 
      role: user.user_metadata?.role || 'user' 
    };
    await kv.set(`user:${user.id}`, fallback);
    return c.json({ user: fallback });
  }
  return c.json({ user: userData });
});

// 당직 일정 조회
app.get('/make-server-a032f464/duties/:year/:month', async (c) => {
  const user = await verifyUser(c.req);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { year, month } = c.req.param();
  return c.json({ duties: (await kv.get(`duties:${year}-${month}`)) || [] });
});

// 당직 저장
app.post('/make-server-a032f464/duties', async (c) => {
  const user = await verifyUser(c.req);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const userData = await kv.get(`user:${user.id}`);
  if (userData?.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  const { year, month, duties } = await c.req.json();
  await kv.set(`duties:${year}-${month}`, duties);
  return c.json({ success: true });
});

// Korean Holidays Helper (2025-2026)
function isKoreanHoliday(year: number, month: number, day: number) {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // Fixed Solar Holidays
  const solarHolidays = [
    '01-01', // New Year
    '03-01', // March 1st
    '05-05', // Children's Day
    '06-06', // Memorial Day
    '08-15', // Liberation Day
    '10-03', // National Foundation Day
    '10-09', // Hangeul Day
    '12-25', // Christmas
  ];
  
  if (solarHolidays.includes(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)) return true;

  // 2025 Lunar/Alternative Holidays
  const holidays2025 = [
    '2025-01-28', '2025-01-29', '2025-01-30', // Seollal
    '2025-03-03', // Alt for Mar 1
    '2025-05-06', // Alt for Buddha's B-day
    '2025-10-05', '2025-10-06', '2025-10-07', // Chuseok
    '2025-10-08', // Alt for Chuseok
  ];

  // 2026 Lunar/Alternative Holidays
  const holidays2026 = [
    '2026-02-16', '2026-02-17', '2026-02-18', // Seollal
    '2026-03-02', // Alt for Mar 1
    '2026-05-24', // Buddha's B-day
    '2026-05-25', // Alt for Buddha's B-day
    '2026-06-03', // Local Election
    '2026-08-17', // Alt for Liberation Day
    '2026-09-24', '2026-09-25', '2026-09-26', // Chuseok
    '2026-10-05', // Alt for Foundation Day
  ];

  if (year === 2025 && holidays2025.includes(dateStr)) return true;
  if (year === 2026 && holidays2026.includes(dateStr)) return true;

  return false;
}

// 자동 생성
app.post('/make-server-a032f464/duties/generate', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userData = await kv.get(`user:${user.id}`);
    if (userData?.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

    const { year, month, weekdayUsers, weekendUsers, exclusions = [], customHolidays = [] } = await c.req.json();
    
    const allUserData = await kv.getByPrefix('user:');
    const userMap = new Map(allUserData.map(u => [u.id, u]));

    const daysInMonth = new Date(year, month, 0).getDate();
    const duties = [];
    
    // Carry-over pointer logic: Load last indices from KV
    const lastPointers = await kv.get('duty-pointers') || { wdIdx: 0, weIdx: 0 };
    let wdIdx = lastPointers.wdIdx || 0;
    let weIdx = lastPointers.weIdx || 0;

    // Helper to check if a date is a custom holiday
    const isCustomHoliday = (dateObj: Date) => {
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      return customHolidays.includes(dateStr);
    };

    // Helper to check if user is excluded on a specific date
    const isExcluded = (userId: string, dateObj: Date) => {
      return exclusions.some((ex: any) => {
        if (ex.userId !== userId) return false;
        const start = new Date(ex.startDate);
        const end = new Date(ex.endDate);
        const current = new Date(dateObj);
        current.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return current >= start && current <= end;
      });
    };

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isOfficialHoliday = isKoreanHoliday(year, month, d);
      const isCustomHoli = isCustomHoliday(date);
      const isHoliday = isOfficialHoliday || isCustomHoli;
      const isWE = isWeekend || isHoliday;
      
      const sequence = isWE ? weekendUsers : weekdayUsers;
      let ptr = isWE ? weIdx : wdIdx;
      
      if (sequence.length === 0) {
        duties.push({ date: d, userId: '', userName: '미지정', type: isWE ? 'weekend' : 'weekday', isHoliday });
        continue;
      }

      // Find first available person in sequence
      let attempts = 0;
      let selectedUid = sequence[ptr % sequence.length];
      
      while (isExcluded(selectedUid, date) && attempts < sequence.length) {
        ptr++;
        selectedUid = sequence[ptr % sequence.length];
        attempts++;
      }

      // Update global pointer for next day
      if (isWE) weIdx = ptr + 1;
      else wdIdx = ptr + 1;

      const uInfo = userMap.get(selectedUid);
      duties.push({ 
        date: d, 
        userId: selectedUid, 
        userName: uInfo?.name || 'Unknown', 
        type: isWE ? 'weekend' : 'weekday',
        isHoliday: isHoliday
      });
    }

    // Save current pointers to KV for next month's generation
    await kv.set('duty-pointers', { wdIdx, weIdx });
    await kv.set(`duties:${year}-${month}`, duties);
    return c.json({ success: true, duties });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 교환 요청
app.post('/make-server-a032f464/swap-requests', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { toUserId, year, month, date } = await c.req.json();
    const [uFrom, uTo] = await kv.mget([`user:${user.id}`, `user:${toUserId}`]);
    
    if (!uFrom || !uTo) return c.json({ error: 'User not found' }, 404);

    const rid = `${Date.now()}-${user.id}`;
    const req = { 
      id: rid, 
      fromUserId: user.id, 
      fromUserName: uFrom.name, 
      toUserId, 
      toUserName: uTo.name, 
      year, 
      month, 
      date, 
      status: 'pending', 
      createdAt: new Date().toISOString() 
    };
    await kv.set(`swap-request:${rid}`, req);

    const notifs = (await kv.get(`notifications:${toUserId}`)) || [];
    notifs.push({ 
      id: Date.now(), 
      message: `${uFrom.name}님의 교환 요청: ${year}/${month}/${date}`, 
      type: 'swap-request', 
      requestId: rid, 
      read: false, 
      createdAt: new Date().toISOString() 
    });
    await kv.set(`notifications:${toUserId}`, notifs);

    return c.json({ success: true, request: req });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 요청 목록
app.get('/make-server-a032f464/swap-requests', async (c) => {
  const user = await verifyUser(c.req);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const all = await kv.getByPrefix('swap-request:');
  return c.json({ requests: all.filter(r => r.fromUserId === user.id || r.toUserId === user.id) });
});

// 요청 처리
app.post('/make-server-a032f464/swap-requests/:requestId/:action', async (c) => {
  const user = await verifyUser(c.req);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { requestId, action } = c.req.param();
  const req = await kv.get(`swap-request:${requestId}`);
  if (!req) return c.json({ error: 'Request not found' }, 404);

  // 취소 처리 (보낸 사람만 가능)
  if (action === 'cancel') {
    if (req.fromUserId !== user.id) return c.json({ error: '보낸 사람만 취소할 수 있습니다.' }, 403);
    if (req.status !== 'pending') return c.json({ error: '대기 중인 요청만 취소할 수 있습니다.' }, 400);
    
    req.status = 'cancelled';
    await kv.set(`swap-request:${requestId}`, req);
    
    // 받는 사람에게 취소 알림 추가
    const targetNotifs = (await kv.get(`notifications:${req.toUserId}`)) || [];
    targetNotifs.push({
      id: Date.now(),
      message: `${req.fromUserName}님이 교환 요청을 취소했습니다.`,
      type: 'swap-cancelled',
      requestId: requestId,
      read: false,
      createdAt: new Date().toISOString()
    });
    await kv.set(`notifications:${req.toUserId}`, targetNotifs);
    
    return c.json({ success: true, request: req });
  }

  // 승인/거절 처리 (받는 사람만 가능)
  if (req.toUserId !== user.id) return c.json({ error: '받는 사람만 처리할 수 있습니다.' }, 403);
  if (req.status !== 'pending') return c.json({ error: '이미 처리된 요청입니다.' }, 400);

  if (action === 'approve') {
    const ds = await kv.get(`duties:${req.year}-${req.month}`);
    if (!ds) return c.json({ error: '당직 일정을 찾을 수 없습니다.' }, 404);
    
    const updated = ds.map((d: any) => {
      if (d.date === req.date) {
        if (d.userId === req.fromUserId) return { ...d, userId: req.toUserId, userName: req.toUserName };
        if (d.userId === req.toUserId) return { ...d, userId: req.fromUserId, userName: req.fromUserName };
      }
      return d;
    });
    await kv.set(`duties:${req.year}-${req.month}`, updated);
    req.status = 'approved';
  } else {
    req.status = 'rejected';
  }

  await kv.set(`swap-request:${requestId}`, req);
  const notifs = (await kv.get(`notifications:${req.fromUserId}`)) || [];
  notifs.push({ id: Date.now(), message: `교환 요청이 ${action === 'approve' ? '승인' : '거절'}되었습니다.`, type: 'swap-response', read: false, createdAt: new Date().toISOString() });
  await kv.set(`notifications:${req.fromUserId}`, notifs);

  return c.json({ success: true, request: req });
});

// 알림
app.get('/make-server-a032f464/notifications', async (c) => {
  const user = await verifyUser(c.req);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ notifications: (await kv.get(`notifications:${user.id}`)) || [] });
});

app.post('/make-server-a032f464/notifications/:id/read', async (c) => {
  const user = await verifyUser(c.req);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const nid = parseInt(c.req.param('id'));
  const ns = (await kv.get(`notifications:${user.id}`)) || [];
  await kv.set(`notifications:${user.id}`, ns.map(n => n.id === nid ? { ...n, read: true } : n));
  return c.json({ success: true });
});

// 알림 삭제 (전체 또는 선택)
app.post('/make-server-a032f464/notifications/delete', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { ids, all } = await c.req.json();
    let ns = (await kv.get(`notifications:${user.id}`)) || [];
    
    if (all) {
      ns = [];
    } else if (ids && Array.isArray(ids)) {
      ns = ns.filter((n: any) => !ids.includes(n.id));
    }
    
    await kv.set(`notifications:${user.id}`, ns);
    return c.json({ success: true, notifications: ns });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 사용자 역할 변경
app.post('/make-server-a032f464/users/:userId/role', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userData = await kv.get(`user:${user.id}`);
    if (userData?.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

    const targetUserId = c.req.param('userId');
    const { role } = await c.req.json();

    const targetUser = await kv.get(`user:${targetUserId}`);
    if (!targetUser) return c.json({ error: 'User not found' }, 404);

    // Update Auth metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      user_metadata: { ...targetUser, role }
    });
    if (authError) throw authError;

    // Update KV
    const updatedUser = { ...targetUser, role };
    await kv.set(`user:${targetUserId}`, updatedUser);

    return c.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 프로필 수정 (이름, 비밀번호, 군번)
app.post('/make-server-a032f464/me/update', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { name, password, serviceNumber } = await c.req.json();
    const userData = await kv.get(`user:${user.id}`);
    
    if (!userData) return c.json({ error: 'User not found' }, 404);

    const updateData: any = {
      user_metadata: { ...user.user_metadata, name, serviceNumber }
    };
    
    if (password) {
      updateData.password = password;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, updateData);
    if (authError) throw authError;

    const updatedUser = { ...userData, name, serviceNumber };
    await kv.set(`user:${user.id}`, updatedUser);

    return c.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 사용자 삭제
app.delete('/make-server-a032f464/users/:userId', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userData = await kv.get(`user:${user.id}`);
    if (userData?.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

    const targetUserId = c.req.param('userId');
    if (targetUserId === user.id) return c.json({ error: '자기 자신은 삭제할 수 없습니다.' }, 400);

    // Delete from Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (authError) throw authError;

    // Delete from KV
    await kv.del(`user:${targetUserId}`);
    await kv.del(`notifications:${targetUserId}`);
    
    // Note: Swap requests and duties where this user is mentioned are not deleted
    // but they will show as "Unknown" or similar in UI.

    return c.json({ success: true, message: '사용자가 성공적으로 삭제되었습니다.' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 관리자 제외 모든 사용자 일괄 삭제
app.post('/make-server-a032f464/users/bulk-delete-non-admins', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userData = await kv.get(`user:${user.id}`);
    if (userData?.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

    const allUsers = await kv.getByPrefix('user:');
    const nonAdminUsers = allUsers.filter(u => u.role !== 'admin');
    
    if (nonAdminUsers.length === 0) {
      return c.json({ success: true, message: '삭제할 일반 사용자가 없습니다.', count: 0 });
    }

    const deletePromises = nonAdminUsers.map(async (u) => {
      try {
        await supabaseAdmin.auth.admin.deleteUser(u.id);
        await kv.del(`user:${u.id}`);
        await kv.del(`notifications:${u.id}`);
        return { id: u.id, success: true };
      } catch (e) {
        console.error(`Failed to delete user ${u.id}:`, e);
        return { id: u.id, success: false, error: e };
      }
    });

    const results = await Promise.all(deletePromises);
    const successCount = results.filter(r => r.success).length;

    return c.json({ 
      success: true, 
      message: `${successCount}명의 일반 사용자가 삭제되었습니다.`,
      count: successCount
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 당직 알림 생성 (실제 배정된 당직 정보 기반)
app.post('/make-server-a032f464/create-duty-notifications', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const duties = (await kv.get(`duties:${year}-${month}`)) || [];

    if (duties.length === 0) return c.json({ message: 'No duties found' });

    // 당직자별로 그룹화하여 알림 생성
    const userDuties = new Map();
    duties.forEach((d: any) => {
      if (!userDuties.has(d.userId)) userDuties.set(d.userId, []);
      userDuties.get(d.userId).push(d.date);
    });

    for (const [userId, dates] of userDuties.entries()) {
      const ns = (await kv.get(`notifications:${userId}`)) || [];
      const dateStr = dates.sort((a: number, b: number) => a - b).join(', ');
      ns.push({
        id: Date.now() + Math.random(),
        message: `${month}월 당직이 배정되었습니다: ${dateStr}일`,
        type: 'duty-assigned',
        read: false,
        createdAt: new Date().toISOString()
      });
      await kv.set(`notifications:${userId}`, ns);
    }

    return c.json({ success: true, message: '당직 알림이 생성되었습니다.' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 당직비 단가 조회
app.get('/make-server-a032f464/settings/duty-prices', async (c) => {
  const prices = await kv.get('settings:duty-prices');
  return c.json(prices || { weekday: 30000, weekend: 100000 });
});

// 당직비 단가 수정
app.post('/make-server-a032f464/settings/duty-prices', async (c) => {
  try {
    const user = await verifyUser(c.req);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userData = await kv.get(`user:${user.id}`);
    if (userData?.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

    const { weekday, weekend } = await c.req.json();
    await kv.set('settings:duty-prices', { weekday: Number(weekday), weekend: Number(weekend) });
    
    return c.json({ success: true, message: '단가가 수정되었습니다.' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);
