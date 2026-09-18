import { UserProfile, AuthProvider } from '../types';
import { signOutFirebase } from './firebaseClient';
import { cloudSyncService } from './cloudSyncService';

const SESSION_KEY = 'zad_active_session_v1';
const PHONE_USERS_KEY = 'zad_registered_phone_accounts_v1';
const USER_PROFILES_KEY = 'zad_custom_user_profiles_v1';

interface StoredPhoneAccount {
  id: string;
  phone: string;
  passwordHash: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export const authService = {
  // 1. جلب الجلسة النشطة من التخزين المحلي
  getActiveSession(): UserProfile | null {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (!data) return null;
      return JSON.parse(data) as UserProfile;
    } catch {
      return null;
    }
  },

  // 2. حفظ وتحديث الجلسة النشطة
  setActiveSession(user: UserProfile): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      const mapStr = localStorage.getItem(USER_PROFILES_KEY);
      const map: Record<string, UserProfile> = mapStr ? JSON.parse(mapStr) : {};
      map[user.id] = user;
      localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(map));
    } catch (e) {
      console.error('Failed to save session', e);
    }
  },

  // 3. تسجيل الخروج ومسح الجلسة والربط مع Firebase
  logout(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
      signOutFirebase();
    } catch (e) {
      console.error('Failed to clear session', e);
    }
  },

  // 4. إنشاء حساب جديد برقم الهاتف وكلمة المرور (دون الحاجة لرمز OTP)
  async registerWithPhone(
    name: string,
    phone: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'الاسم إلزامي لإنشاء الحساب.' };
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 6) {
      return { success: false, error: 'يرجى إدخال رقم هاتف صحيح (٦ أرقام على الأقل).' };
    }

    if (!password || password.length < 4) {
      return { success: false, error: 'كلمة المرور يجب ألا تقل عن ٤ خانات.' };
    }

    try {
      const accountsJson = localStorage.getItem(PHONE_USERS_KEY);
      const accounts: StoredPhoneAccount[] = accountsJson ? JSON.parse(accountsJson) : [];

      const existingAccount = accounts.find((a) => a.phone === cleanPhone);
      if (existingAccount) {
        return {
          success: false,
          error: 'رقم الهاتف هذا مسجل مسبقاً، يمكنك تسجيل الدخول بكلمة المرور الخاصة به.',
        };
      }

      const newId = `phone_user_${cleanPhone}`;
      const newAccount: StoredPhoneAccount = {
        id: newId,
        name: trimmedName,
        phone: cleanPhone,
        passwordHash: password,
        createdAt: new Date().toISOString(),
      };

      accounts.push(newAccount);
      localStorage.setItem(PHONE_USERS_KEY, JSON.stringify(accounts));

      const userProfile: UserProfile = {
        id: newId,
        name: trimmedName,
        phone: cleanPhone,
        provider: 'phone',
        joinedAt: newAccount.createdAt,
      };

      this.setActiveSession(userProfile);
      return { success: true, user: userProfile };
    } catch (err) {
      return { success: false, error: 'حدث خطأ أثناء إنشاء الحساب: ' + String(err) };
    }
  },

  // 5. تسجيل دخول مستخدم قديم برقم الهاتف وكلمة المرور
  async loginWithPhone(
    phone: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string; isNewAccount?: boolean }> {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 6) {
      return { success: false, error: 'يرجى إدخال رقم هاتف صحيح.' };
    }
    if (!password) {
      return { success: false, error: 'يرجى إدخال كلمة المرور.' };
    }

    try {
      const accountsJson = localStorage.getItem(PHONE_USERS_KEY);
      const accounts: StoredPhoneAccount[] = accountsJson ? JSON.parse(accountsJson) : [];

      const existingAccount = accounts.find((a) => a.phone === cleanPhone);

      if (!existingAccount) {
        return {
          success: false,
          error: 'رقم الهاتف غير مسجل مسبقاً، يرجى اختيار تبويب "تسجيل جديد" لإدخال الاسم وإنشاء الحساب.',
        };
      }

      if (existingAccount.passwordHash !== password) {
        return { success: false, error: 'كلمة المرور غير صحيحة لهذا الحساب.' };
      }

      const mapStr = localStorage.getItem(USER_PROFILES_KEY);
      const map: Record<string, UserProfile> = mapStr ? JSON.parse(mapStr) : {};
      const cachedProfile = map[existingAccount.id];

      const userProfile: UserProfile = cachedProfile || {
        id: existingAccount.id,
        name: existingAccount.name || `مستخدم ${cleanPhone.slice(-4)}`,
        phone: existingAccount.phone,
        avatarUrl: existingAccount.avatarUrl,
        provider: 'phone',
        joinedAt: existingAccount.createdAt,
      };

      this.setActiveSession(userProfile);
      return { success: true, user: userProfile, isNewAccount: false };
    } catch (err) {
      return { success: false, error: 'حدث خطأ أثناء تسجيل الدخول: ' + String(err) };
    }
  },

  // 6. ربط وتسجيل دخول مستخدم Google مع Firebase UID
  loginWithGoogleUser(userData: {
    id: string; // Firebase UID
    name?: string;
    email?: string;
    avatarUrl?: string;
  }): UserProfile {
    const userId = userData.id.startsWith('google_') ? userData.id : userData.id;

    const mapStr = localStorage.getItem(USER_PROFILES_KEY);
    const map: Record<string, UserProfile> = mapStr ? JSON.parse(mapStr) : {};
    const existing = map[userId] || (userData.id.startsWith('google_') ? undefined : map[`google_${userData.id}`]);

    const extractedName = (userData.name || '').trim() || (existing ? existing.name : '');

    const userProfile: UserProfile = {
      id: userId,
      name: extractedName || 'عضو SDA (Google)',
      email: userData.email,
      googleEmail: userData.email,
      avatarUrl: userData.avatarUrl || existing?.avatarUrl,
      phone: existing?.phone,
      googleLinked: true,
      provider: 'google',
      joinedAt: existing?.joinedAt || new Date().toISOString(),
    };

    this.setActiveSession(userProfile);
    return userProfile;
  },

  // 7. ربط وتسجيل دخول مستخدم Facebook
  loginWithFacebookUser(userData: {
    id: string; // Firebase UID
    name?: string;
    email?: string;
    avatarUrl?: string;
  }): UserProfile {
    const userId = userData.id.startsWith('fb_') ? userData.id : userData.id;
    const mapStr = localStorage.getItem(USER_PROFILES_KEY);
    const map: Record<string, UserProfile> = mapStr ? JSON.parse(mapStr) : {};
    const existing = map[userId] || (userData.id.startsWith('fb_') ? undefined : map[`fb_${userData.id}`]);

    const extractedName = (userData.name || '').trim() || (existing ? existing.name : '');

    const userProfile: UserProfile = {
      id: userId,
      name: extractedName || 'عضو SDA (Facebook)',
      email: userData.email,
      facebookName: userData.name,
      avatarUrl: userData.avatarUrl || existing?.avatarUrl,
      phone: existing?.phone,
      facebookLinked: true,
      provider: 'facebook',
      joinedAt: existing?.joinedAt || new Date().toISOString(),
    };

    this.setActiveSession(userProfile);
    return userProfile;
  },

  // 8. الدخول كـ "ضيف"
  loginAsGuest(): UserProfile {
    const guestUser: UserProfile = {
      id: 'guest_sda_user',
      name: 'ضيف زاد الروح',
      provider: 'guest',
      joinedAt: new Date().toISOString(),
    };
    this.setActiveSession(guestUser);
    return guestUser;
  },

  // 9. تعديل الملف الشخصي (الاسم، الصورة، الهاتف) مع الحفاظ على موضع القراءة 100%
  updateUserProfile(
    userId: string,
    updates: { name?: string; phone?: string; avatarUrl?: string }
  ): UserProfile | null {
    if (!userId || userId === 'guest_sda_user') return null;

    const current = this.getActiveSession();
    if (!current || current.id !== userId) return null;

    const updatedUser: UserProfile = {
      ...current,
      name: updates.name !== undefined && updates.name.trim() ? updates.name.trim() : current.name,
      phone: updates.phone !== undefined ? updates.phone.trim() : current.phone,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl,
    };

    this.setActiveSession(updatedUser);

    if (userId && userId !== 'guest_sda_user' && current.provider !== 'guest') {
      cloudSyncService.saveToCloud(userId, 'profile', updatedUser);
    }

    if (current.provider === 'phone') {
      try {
        const accountsJson = localStorage.getItem(PHONE_USERS_KEY);
        if (accountsJson) {
          const accounts: StoredPhoneAccount[] = JSON.parse(accountsJson);
          const idx = accounts.findIndex((a) => a.id === userId);
          if (idx !== -1) {
            accounts[idx].name = updatedUser.name;
            if (updatedUser.avatarUrl) accounts[idx].avatarUrl = updatedUser.avatarUrl;
            localStorage.setItem(PHONE_USERS_KEY, JSON.stringify(accounts));
          }
        }
      } catch (e) {
        console.error('Failed to sync phone account changes', e);
      }
    }

    return updatedUser;
  },
};
