import Dexie, { type Table } from 'dexie';
import type { CenterPoint, AppSettings, ColorSlots } from '../types';

class RangeDB extends Dexie {
  points!: Table<CenterPoint, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('RangeDB');
    this.version(1).stores({
      points: 'id',
      settings: 'key',
    });
  }
}

export const db = new RangeDB();

export async function savePoints(points: CenterPoint[]) {
  await db.transaction('rw', db.points, async () => {
    await db.points.clear();
    await db.points.bulkAdd(points);
  });
}

export async function loadPoints(): Promise<CenterPoint[]> {
  return db.points.toArray();
}

export async function saveSetting<T>(key: string, value: T) {
  await db.settings.put({ key, value });
}

export async function loadSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function loadAllData() {
  const points = await loadPoints();
  const settings = await loadSetting<AppSettings>('appSettings');
  const colorSlots = await loadSetting<ColorSlots>('colorSlots');
  return { points, settings, colorSlots };
}
