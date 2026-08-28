import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const keyboardComponent = await readFile('apps/terminal-app/src/components/KeyboardSafeScrollView.js', 'utf8');
const manifest = await readFile('apps/terminal-app/android/app/src/main/AndroidManifest.xml', 'utf8');
const protectedScreens = [
  'LoginScreen.js',
  'CustomerAccountsScreen.js',
  'CatalogSendScreen.js',
  'ProductLookupScreen.js',
  'FieldTestScreen.js',
  'ReceiptCollectScreen.js',
  'SettingsScreen.js',
  'NewSaleScreen.js',
];

assert.match(manifest, /windowSoftInputMode="adjustResize"/, 'Android window must resize above the software keyboard');
assert.match(keyboardComponent, /Keyboard\.addListener/, 'Keyboard visibility events must be observed');
assert.match(keyboardComponent, /currentlyFocusedInput/, 'The focused text input must be detected');
assert.match(keyboardComponent, /scrollResponderScrollNativeHandleToKeyboard/, 'Native focused-input keyboard scrolling must be used');
assert.match(keyboardComponent, /KeyboardSafeTextInput/, 'Text inputs must report their native focus target');
assert.match(keyboardComponent, /measureInWindow/, 'The focused input position must be measured');
assert.match(keyboardComponent, /UIManager\.measure/, 'Native input position must be measured even when Android keyboard events are incomplete');
assert.match(keyboardComponent, /scrollView\.scrollTo/, 'Covered input must be scrolled above the keyboard');
assert.match(keyboardComponent, /keyboardHeight \+ keyboardGap/, 'Android must keep enough scroll space above the keyboard');
assert.match(keyboardComponent, /automaticallyAdjustKeyboardInsets/, 'Native keyboard insets must be enabled');

for (const screenName of protectedScreens) {
  const source = await readFile(`apps/terminal-app/src/screens/${screenName}`, 'utf8');
  assert.match(source, /KeyboardSafeScrollView/, `${screenName} must use the shared keyboard-safe scroll behavior`);
  assert.match(source, /KeyboardSafeTextInput/, `${screenName} text inputs must report focus to the shared keyboard behavior`);
}

const whatsapp = await readFile('apps/terminal-app/src/screens/WhatsAppCrmScreen.js', 'utf8');
assert.match(whatsapp, /KeyboardAvoidingView/, 'WhatsApp reply input must stay above the keyboard');

console.log(`PASS terminal keyboard visibility smoke (${protectedScreens.length + 1} screens)`);
