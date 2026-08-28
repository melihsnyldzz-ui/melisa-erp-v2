import {
  createContext,
  forwardRef,
  useContext,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  findNodeHandle,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  UIManager,
} from 'react-native';

const keyboardGap = 18;
const KeyboardScrollContext = createContext(null);

export const KeyboardSafeTextInput = forwardRef(function KeyboardSafeTextInput({ onFocus, ...props }, forwardedRef) {
  const requestReveal = useContext(KeyboardScrollContext);

  return (
    <TextInput
      {...props}
      ref={forwardedRef}
      onFocus={(event) => {
        requestReveal?.(event.nativeEvent?.target);
        onFocus?.(event);
      }}
    />
  );
});

export const KeyboardSafeScrollView = forwardRef(function KeyboardSafeScrollView({
  children,
  contentContainerStyle,
  keyboardDismissMode = Platform.OS === 'ios' ? 'interactive' : 'on-drag',
  keyboardShouldPersistTaps = 'handled',
  onScroll,
  onTouchEnd,
  scrollEventThrottle = 16,
  ...props
}, forwardedRef) {
  const scrollRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const keyboardTopRef = useRef(null);
  const focusedInputHandleRef = useRef(null);
  const revealTimerRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useImperativeHandle(forwardedRef, () => scrollRef.current);

  const revealFocusedInput = useCallback((delay = 80, inputHandle = focusedInputHandleRef.current) => {
    clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      const focusedInput = TextInput.State.currentlyFocusedInput?.();
      const keyboardTop = keyboardTopRef.current;
      const scrollView = scrollRef.current;
      if (!scrollView || (!focusedInput && !inputHandle)) return;

      const focusedInputHandle = inputHandle || findNodeHandle(focusedInput);
      if (focusedInputHandle && Number.isFinite(keyboardTop) && scrollView.scrollTo) {
        UIManager.measure(focusedInputHandle, (_x, _y, _width, inputHeight, _pageX, inputY) => {
          const overlap = inputY + inputHeight + keyboardGap - keyboardTop;
          if (overlap <= 0) return;
          scrollView.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + overlap),
            animated: true,
          });
        });
        return;
      }

      const scrollResponder = scrollView.getScrollResponder?.();
      if (focusedInputHandle && scrollResponder?.scrollResponderScrollNativeHandleToKeyboard) {
        scrollResponder.scrollResponderScrollNativeHandleToKeyboard(
          focusedInputHandle,
          keyboardGap,
          true,
        );
        return;
      }

      if (!focusedInput.measureInWindow || !scrollView.scrollTo || !Number.isFinite(keyboardTop)) return;

      focusedInput.measureInWindow((_x, inputY, _width, inputHeight) => {
        const overlap = inputY + inputHeight + keyboardGap - keyboardTop;
        if (overlap <= 0) return;
        scrollView.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + overlap),
          animated: true,
        });
      });
    }, delay);
  }, []);

  const requestReveal = useCallback((inputHandle) => {
    focusedInputHandleRef.current = inputHandle || null;
    if (Platform.OS === 'android' && !Number.isFinite(keyboardTopRef.current)) {
      const screenHeight = Dimensions.get('screen').height;
      const estimatedKeyboardHeight = Math.round(screenHeight * 0.48);
      keyboardTopRef.current = screenHeight - estimatedKeyboardHeight;
      setKeyboardHeight(estimatedKeyboardHeight);
    }
    revealFocusedInput(420, inputHandle);
  }, [revealFocusedInput]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const coordinates = event?.endCoordinates;
      const keyboardHeightValue = Number(coordinates?.height || 0);
      const keyboardTopCandidates = [
        Number(coordinates?.screenY),
        Dimensions.get('screen').height - keyboardHeightValue,
        Dimensions.get('window').height,
      ].filter((value) => Number.isFinite(value) && value > 0);
      keyboardTopRef.current = keyboardTopCandidates.length
        ? Math.min(...keyboardTopCandidates)
        : null;
      setKeyboardHeight(keyboardHeightValue);
      revealFocusedInput(160);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardTopRef.current = null;
      setKeyboardHeight(0);
      clearTimeout(revealTimerRef.current);
    });

    return () => {
      clearTimeout(revealTimerRef.current);
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [revealFocusedInput]);

  return (
    <KeyboardScrollContext.Provider value={requestReveal}>
      <ScrollView
        {...props}
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          contentContainerStyle,
          Platform.OS === 'android' && keyboardHeight > 0
            ? { paddingBottom: keyboardHeight + keyboardGap }
            : null,
        ]}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onScroll={(event) => {
          scrollOffsetRef.current = Number(event.nativeEvent?.contentOffset?.y || 0);
          onScroll?.(event);
        }}
        onTouchEnd={(event) => {
          onTouchEnd?.(event);
          if (keyboardTopRef.current !== null) revealFocusedInput(120);
        }}
        scrollEventThrottle={scrollEventThrottle}
      >
        {children}
      </ScrollView>
    </KeyboardScrollContext.Provider>
  );
});
