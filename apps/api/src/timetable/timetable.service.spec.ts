import { timesOverlap } from './timetable.service';

describe('timesOverlap', () => {
  it('detects overlapping class and teacher timetable slots', () => {
    expect(timesOverlap('09:00', '09:45', '09:30', '10:15')).toBe(true);
    expect(timesOverlap('09:00', '09:45', '09:45', '10:30')).toBe(false);
    expect(timesOverlap('10:00', '10:45', '09:00', '10:00')).toBe(false);
    expect(timesOverlap('10:00', '10:45', '09:30', '10:15')).toBe(true);
  });
});
