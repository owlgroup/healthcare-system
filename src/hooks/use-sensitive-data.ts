import { useState, useCallback } from 'react';
import {
  encrypt,
  decrypt,
  encryptFields,
  decryptFields,
  maskSensitiveData,
} from '@/lib/crypto';

/**
 * Hook to handle sensitive data encryption/decryption in components
 */
export function useSensitiveData() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const encryptValue = useCallback(async (value: string): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    try {
      return await encrypt(value);
    } catch (err) {
      setError('Lỗi mã hóa dữ liệu');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const decryptValue = useCallback(async (value: string): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    try {
      return await decrypt(value);
    } catch (err) {
      setError('Lỗi giải mã dữ liệu');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const encryptPatientData = useCallback(
    async <T extends Record<string, unknown>>(
      data: T,
      fields: (keyof T)[] = ['cccd', 'phone', 'insurance_number', 'address'] as (keyof T)[]
    ): Promise<T> => {
      setIsProcessing(true);
      setError(null);
      try {
        return await encryptFields(data, fields);
      } catch (err) {
        setError('Lỗi mã hóa thông tin bệnh nhân');
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const decryptPatientData = useCallback(
    async <T extends Record<string, unknown>>(
      data: T,
      fields: (keyof T)[] = ['cccd', 'phone', 'insurance_number', 'address'] as (keyof T)[]
    ): Promise<T> => {
      setIsProcessing(true);
      setError(null);
      try {
        return await decryptFields(data, fields);
      } catch (err) {
        setError('Lỗi giải mã thông tin bệnh nhân');
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return {
    isProcessing,
    error,
    encryptValue,
    decryptValue,
    encryptPatientData,
    decryptPatientData,
    maskSensitiveData,
  };
}

/**
 * Format và hiển thị dữ liệu nhạy cảm đã giải mã
 * Dùng trong UI components
 */
export function useSensitiveDisplay() {
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const revealValue = useCallback(
    async (key: string, encryptedValue: string): Promise<void> => {
      if (decryptedValues[key]) return;

      setIsLoading(true);
      try {
        const decrypted = await decrypt(encryptedValue);
        setDecryptedValues(prev => ({ ...prev, [key]: decrypted }));
      } finally {
        setIsLoading(false);
      }
    },
    [decryptedValues]
  );

  const hideValue = useCallback((key: string): void => {
    setDecryptedValues(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const getDisplayValue = useCallback(
    (
      key: string,
      encryptedValue: string,
      type: 'cccd' | 'phone' | 'medical'
    ): string => {
      if (decryptedValues[key]) {
        return decryptedValues[key];
      }
      return maskSensitiveData(encryptedValue, type);
    },
    [decryptedValues]
  );

  return {
    isLoading,
    decryptedValues,
    revealValue,
    hideValue,
    getDisplayValue,
  };
}
