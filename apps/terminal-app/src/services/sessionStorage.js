import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const secureKeys = new Set(['accessToken', 'refreshToken']);

async function secureSet(key, value) {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function secureGet(key) {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;
  } catch {
    // Expo web/dev fallback.
  }

  return AsyncStorage.getItem(key);
}

async function secureDelete(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Expo web/dev fallback.
  }

  await AsyncStorage.removeItem(key);
}

export async function setStoredValue(key, value) {
  if (secureKeys.has(key)) {
    return secureSet(key, value);
  }

  return AsyncStorage.setItem(key, value);
}

export async function getStoredValue(key) {
  if (secureKeys.has(key)) {
    return secureGet(key);
  }

  return AsyncStorage.getItem(key);
}

export async function removeStoredValue(key) {
  if (secureKeys.has(key)) {
    return secureDelete(key);
  }

  return AsyncStorage.removeItem(key);
}
