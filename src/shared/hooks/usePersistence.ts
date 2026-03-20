import { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { savePoints, saveSetting, loadAllData } from '../../db/database';

export function usePersistence() {
  const initialized = useRef(false);

  // Load data on mount
  useEffect(() => {
    loadAllData().then((data) => {
      useStore.getState().hydrate({
        points: data.points?.length ? data.points : undefined,
        settings: data.settings ?? undefined,
        colorSlots: data.colorSlots ?? undefined,
      });
      initialized.current = true;
    });
  }, []);

  // Auto-save points
  useEffect(() => {
    return useStore.subscribe(
      (s) => s.points,
      (points) => {
        if (initialized.current) savePoints(points);
      }
    );
  }, []);

  // Auto-save settings
  useEffect(() => {
    return useStore.subscribe(
      (s) => s.settings,
      (settings) => {
        if (initialized.current) saveSetting('appSettings', settings);
      }
    );
  }, []);

  // Auto-save color slots
  useEffect(() => {
    return useStore.subscribe(
      (s) => s.colorSlots,
      (colorSlots) => {
        if (initialized.current) saveSetting('colorSlots', colorSlots);
      }
    );
  }, []);
}
