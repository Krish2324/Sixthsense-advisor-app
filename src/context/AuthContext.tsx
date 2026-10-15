import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { saveAuthData, getAuthData, clearAuthData, setSecureItem } from '../services/secureStorage';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || (Constants as any).appOwnership === 'expo';

let Notifications: any = null;
if (!isExpoGo && Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log('expo-notifications not available');
  }
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.sixthsensepsychics.com';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 mins inactivity auto-logout (ADV-014)

// Register push token with backend
async function registerPushToken(userId: string) {
  if (Platform.OS === 'web' || isExpoGo || !Notifications) return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await fetch(`${BACKEND_URL}/api/push/register-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        platform: Platform.OS,
        device_token: tokenResp.data,
      }),
    });
    console.log('Advisor push token registered successfully');
  } catch (error) {
    console.error('Failed to register advisor push token:', error);
  }
}

export interface Psychic {
  id: string;
  email: string;
  name: string;
  bio?: string;
  phone?: string;
  country?: string;
  profile_picture?: string;
  specialties: string[];
  years_experience: number;
  chat_rate: number;
  phone_rate: number;
  video_rate: number;
  online_status: string;
  total_earnings: number;
  average_rating: number;
  total_reviews: number;
  total_readings: number;
  status: string; // pending, approved, suspended
}

interface AuthContextType {
  psychic: Psychic | null;
  user: Psychic | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Psychic>) => void;
  resetInactivityTimer: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [psychic, setPsychic] = useState<Psychic | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = useRef<any>(null);

  // ADV-014: Automatic 15-minute token expiration & session inactivity auto-logout
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (psychic) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('🔒 15-minute inactivity limit reached in Advisor App. Logging out...');
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    loadStoredAuth();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (psychic) resetInactivityTimer();
  }, [psychic]);

  const loadStoredAuth = async () => {
    try {
      const authData = await getAuthData();
      if (authData.psychic) {
        setPsychic(authData.psychic);
        if (authData.psychic.id) {
          registerPushToken(authData.psychic.id);
        }
      }
      if (authData.token) setToken(authData.token);
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/psychic/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.psychic) {
        const accessToken = data.access_token || 'mock_psychic_jwt_token';
        setPsychic(data.psychic);
        setToken(accessToken);
        await saveAuthData(accessToken, data.psychic);
        resetInactivityTimer();
        if (data.psychic.id) {
          registerPushToken(data.psychic.id);
        }
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const logout = async () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setPsychic(null);
    setToken(null);
    await clearAuthData();
  };

  const updateProfile = async (data: Partial<Psychic>) => {
    if (psychic) {
      const updated = { ...psychic, ...data };
      setPsychic(updated);
      setSecureItem('__6th_sense_advisor_profile', JSON.stringify(updated));

      // Also update the backend
      try {
        const psychicId = psychic.id || psychic.email || '';
        const response = await fetch(`${BACKEND_URL}/api/psychic-portal/settings/${encodeURIComponent(psychicId)}?email=${encodeURIComponent(psychic.email || '')}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          console.error('Failed to update profile on backend');
        } else {
          console.log('Profile updated on backend successfully');
        }
      } catch (error) {
        console.error('Error updating profile:', error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        psychic,
        user: psychic,
        token,
        isLoading,
        isAuthenticated: !!psychic,
        login,
        logout,
        updateProfile,
        resetInactivityTimer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
