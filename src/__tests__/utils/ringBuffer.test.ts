/**
 * Ring Buffer Tests
 * Tests for the O(1) bounded collection implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LogBuffer } from '../../utils/ringBuffer';

interface TestItem {
  id: number;
  timestamp: number;
  value: string;
}

describe('LogBuffer', () => {
  let buffer: LogBuffer<TestItem>;

  beforeEach(() => {
    buffer = new LogBuffer<TestItem>(5);
  });

  describe('basic operations', () => {
    it('should start empty', () => {
      expect(buffer.isEmpty).toBe(true);
      expect(buffer.size).toBe(0);
      expect(buffer.toArray()).toEqual([]);
    });

    it('should push items correctly', () => {
      buffer.push({ id: 1, timestamp: 1000, value: 'first' });
      expect(buffer.size).toBe(1);
      expect(buffer.isEmpty).toBe(false);
    });

    it('should maintain insertion order', () => {
      buffer.push({ id: 1, timestamp: 1000, value: 'first' });
      buffer.push({ id: 2, timestamp: 2000, value: 'second' });
      buffer.push({ id: 3, timestamp: 3000, value: 'third' });

      const items = buffer.toArray();
      expect(items.map(i => i.id)).toEqual([1, 2, 3]);
    });
  });

  describe('capacity management', () => {
    it('should wrap around when capacity is exceeded', () => {
      for (let i = 1; i <= 7; i++) {
        buffer.push({ id: i, timestamp: i * 1000, value: `item-${i}` });
      }

      expect(buffer.size).toBe(5);
      const items = buffer.toArray();
      expect(items.map(i => i.id)).toEqual([3, 4, 5, 6, 7]);
    });

    it('should report capacity correctly', () => {
      expect(buffer.capacity).toBe(5);
    });

    it('should report isFull correctly', () => {
      for (let i = 1; i <= 4; i++) {
        buffer.push({ id: i, timestamp: i * 1000, value: `item-${i}` });
      }
      expect(buffer.isFull).toBe(false);

      buffer.push({ id: 5, timestamp: 5000, value: 'item-5' });
      expect(buffer.isFull).toBe(true);
    });
  });

  describe('getLast', () => {
    it('should return last N items', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push({ id: i, timestamp: i * 1000, value: `item-${i}` });
      }

      const last2 = buffer.getLast(2);
      expect(last2.map(i => i.id)).toEqual([4, 5]);
    });

    it('should return all items if N exceeds size', () => {
      buffer.push({ id: 1, timestamp: 1000, value: 'first' });
      buffer.push({ id: 2, timestamp: 2000, value: 'second' });

      const last10 = buffer.getLast(10);
      expect(last10.map(i => i.id)).toEqual([1, 2]);
    });

    it('should return empty array for empty buffer', () => {
      expect(buffer.getLast(5)).toEqual([]);
    });
  });

  describe('filter', () => {
    it('should filter items correctly', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push({ id: i, timestamp: i * 1000, value: `item-${i}` });
      }

      const evenItems = buffer.filter(item => item.id % 2 === 0);
      expect(evenItems.map(i => i.id)).toEqual([2, 4]);
    });

    it('should return empty array when no matches', () => {
      buffer.push({ id: 1, timestamp: 1000, value: 'first' });
      const matches = buffer.filter(item => item.id > 10);
      expect(matches).toEqual([]);
    });
  });

  describe('getByTimeRange', () => {
    it('should return items within time range', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push({ id: i, timestamp: i * 1000, value: `item-${i}` });
      }

      const inRange = buffer.getByTimeRange(2000, 4000);
      expect(inRange.map(i => i.id)).toEqual([2, 3, 4]);
    });

    it('should handle edge cases at boundaries', () => {
      buffer.push({ id: 1, timestamp: 1000, value: 'first' });
      buffer.push({ id: 2, timestamp: 2000, value: 'second' });

      const exact = buffer.getByTimeRange(1000, 1000);
      expect(exact.map(i => i.id)).toEqual([1]);
    });
  });

  describe('search', () => {
    it('should search by string match in value', () => {
      buffer.push({ id: 1, timestamp: 1000, value: 'hello world' });
      buffer.push({ id: 2, timestamp: 2000, value: 'foo bar' });
      buffer.push({ id: 3, timestamp: 3000, value: 'hello again' });

      const matches = buffer.search('hello');
      expect(matches.map(i => i.id)).toEqual([1, 3]);
    });

    it('should be case-insensitive', () => {
      buffer.push({ id: 1, timestamp: 1000, value: 'HELLO WORLD' });
      buffer.push({ id: 2, timestamp: 2000, value: 'hello world' });

      const matches = buffer.search('hello');
      expect(matches.length).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all items', () => {
      for (let i = 1; i <= 3; i++) {
        buffer.push({ id: i, timestamp: i * 1000, value: `item-${i}` });
      }

      buffer.clear();
      expect(buffer.isEmpty).toBe(true);
      expect(buffer.size).toBe(0);
      expect(buffer.toArray()).toEqual([]);
    });

    it('should work correctly after clear and re-add', () => {
      buffer.push({ id: 1, timestamp: 1000, value: 'first' });
      buffer.clear();
      buffer.push({ id: 2, timestamp: 2000, value: 'second' });

      expect(buffer.size).toBe(1);
      expect(buffer.toArray()[0].id).toBe(2);
    });
  });

  describe('forEach', () => {
    it('should iterate over all items in order', () => {
      for (let i = 1; i <= 3; i++) {
        buffer.push({ id: i, timestamp: i * 1000, value: `item-${i}` });
      }

      const visited: number[] = [];
      buffer.forEach(item => visited.push(item.id));

      expect(visited).toEqual([1, 2, 3]);
    });
  });

  describe('edge cases', () => {
    it('should handle single-capacity buffer', () => {
      const singleBuffer = new LogBuffer<TestItem>(1);
      singleBuffer.push({ id: 1, timestamp: 1000, value: 'first' });
      singleBuffer.push({ id: 2, timestamp: 2000, value: 'second' });

      expect(singleBuffer.size).toBe(1);
      expect(singleBuffer.toArray()[0].id).toBe(2);
    });

    it('should throw for zero capacity', () => {
      expect(() => new LogBuffer<TestItem>(0)).toThrow();
    });

    it('should throw for negative capacity', () => {
      expect(() => new LogBuffer<TestItem>(-1)).toThrow();
    });
  });
});
