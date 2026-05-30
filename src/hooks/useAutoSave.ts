'use client';

import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

type SaveFn = () => Promise<void>;

export function useAutoSave(saveFn: SaveFn, deps: unknown[], delay = 1000) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  const triggerSave = useCallback(async () => {
    try {
      await saveFn();
    } catch (e) {
      toast.error('保存に失敗しました');
      console.error(e);
    }
  }, [saveFn]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      triggerSave();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { saveNow: triggerSave };
}
