import { useEffect } from 'react';
import { AppState } from 'react-native';

// Android may restore the IME for a still-focused scanner field on resume.
// Release only that field in background, then focus it with its soft-input policy.
export function useScannerResumeFocus(inputRef, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    let restore = false, timer;
    const subscription = AppState.addEventListener('change', state => {
      clearTimeout(timer);
      if (state !== 'active') {
        restore = restore || Boolean(inputRef.current?.isFocused());
        if (restore) inputRef.current?.blur();
      } else if (restore) {
        restore = false;
        timer = setTimeout(() => inputRef.current?.focus(), 150);
      }
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [inputRef, enabled]);
}
