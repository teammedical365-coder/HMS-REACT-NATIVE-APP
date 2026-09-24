import { Alert, Platform } from 'react-native';
import Toast from 'react-native-toast-message';

// Basic wrapper to mimic react-hot-toast API
export const toast = {
  success: (message) => Toast.show({ type: 'success', text1: 'Success', text2: message }),
  error: (message) => Toast.show({ type: 'error', text1: 'Error', text2: message }),
  custom: (message) => Toast.show({ type: 'info', text1: 'Info', text2: message }),
  dismiss: () => Toast.hide(),
};

export const Toaster = () => null; 

/**
 * Native confirmation toast popup using React Native Alert / Web window.confirm.
 */
export const confirmToast = (message, options = {}) => {
  return new Promise((resolve) => {
    const onConfirmCb = typeof options === 'function' ? options : options.onConfirm;
    const confirmLabel = (typeof options === 'object' && options.confirmText) || 'Confirm';
    const cancelLabel = (typeof options === 'object' && options.cancelText) || 'Cancel';
    const title = (typeof options === 'object' && options.title) || 'Please Confirm';

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const fullMsg = title ? `${title}\n\n${message}` : message;
      const ok = window.confirm(fullMsg);
      if (ok) {
        if (onConfirmCb) onConfirmCb();
        resolve(true);
      } else {
        if (typeof options === 'object' && options.onCancel) options.onCancel();
        resolve(false);
      }
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { 
          text: cancelLabel, 
          style: 'cancel', 
          onPress: () => {
            if (typeof options === 'object' && options.onCancel) options.onCancel();
            resolve(false);
          }
        },
        { 
          text: confirmLabel, 
          style: 'destructive', 
          onPress: () => {
            if (onConfirmCb) onConfirmCb();
            resolve(true);
          }
        }
      ]
    );
  });
};

/**
 * Native prompt popup using React Native Alert.prompt.
 */
export const promptToast = (message, options = {}) => {
  return new Promise((resolve) => {
    const title = options.title || 'Edit Information';
    const defaultValue = options.defaultValue || '';
    const confirmLabel = options.confirmText || 'Save';
    const cancelLabel = options.cancelText || 'Cancel';

    Alert.prompt(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(null) },
        { text: confirmLabel, onPress: (text) => resolve(text || defaultValue) }
      ],
      'plain-text',
      defaultValue
    );
  });
};

export default confirmToast;
