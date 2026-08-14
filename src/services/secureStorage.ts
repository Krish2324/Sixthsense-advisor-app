import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = '__6th_sense_advisor_token';
const PSYCHIC_KEY = '__6th_sense_advisor_profile';

export const setSecureItem = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.error(`Error saving secure item ${key}:`, error);
    await AsyncStorage.setItem(key, value);
  }
};

export const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    } else {
      const val = await SecureStore.getItemAsync(key);
      return val || await AsyncStorage.getItem(key);
    }
  } catch (error) {
    console.error(`Error getting secure item ${key}:`, error);
    return await AsyncStorage.getItem(key);
  }
};

export const removeSecureItem = async (key: string): Promise<void> => {
  try {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(key);
    }
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing secure item ${key}:`, error);
    await AsyncStorage.removeItem(key);
  }
};

export const saveAuthData = async (token: string, psychicUser: any): Promise<void> => {
  // Strip PII fields before saving (ADV-019)
  const sanitizedUser = { ...psychicUser };
  delete sanitizedUser.ssn;
  delete sanitizedUser.tax_id;

  await setSecureItem(TOKEN_KEY, token);
  await setSecureItem(PSYCHIC_KEY, JSON.stringify(sanitizedUser));
};

export const getAuthData = async (): Promise<{ token: string | null; psychic: any | null }> => {
  const token = await getSecureItem(TOKEN_KEY);
  const userStr = await getSecureItem(PSYCHIC_KEY);
  const psychic = userStr ? JSON.parse(userStr) : null;
  return { token, psychic };
};

export const clearAuthData = async (): Promise<void> => {
  await removeSecureItem(TOKEN_KEY);
  await removeSecureItem(PSYCHIC_KEY);
};
