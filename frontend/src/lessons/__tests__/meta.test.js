import { describe, it, expect } from 'vitest';
import { LESSONS, LESSON_BY_SLUG, LESSON_BY_SKILL } from '../meta';
import { LESSON_COMPONENTS } from '../registry';
import { GENERATABLE_SKILLS } from '../../constants';

// Registry integrity: the curriculum metadata, the lazy component registry
// and the BKT skill list can never drift apart silently.
describe('lessons/meta — curriculum integrity', () => {
  it('slugs are unique', () => {
    const slugs = LESSONS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every generatable BKT skill has a lesson', () => {
    for (const skill of GENERATABLE_SKILLS) {
      expect(LESSON_BY_SKILL[skill], `missing lesson for skill ${skill}`).toBeTruthy();
    }
  });

  it('every prerequisite slug resolves to a real lesson', () => {
    for (const lesson of LESSONS) {
      for (const prereq of lesson.prereqs) {
        expect(LESSON_BY_SLUG[prereq], `${lesson.slug} prereq ${prereq}`).toBeTruthy();
      }
    }
  });

  it('prerequisites come earlier in the curriculum order', () => {
    const order = Object.fromEntries(LESSONS.map((l, i) => [l.slug, i]));
    for (const lesson of LESSONS) {
      for (const prereq of lesson.prereqs) {
        expect(order[prereq], `${prereq} must precede ${lesson.slug}`).toBeLessThan(order[lesson.slug]);
      }
    }
  });

  it('every lesson has at least one section with unique anchor ids', () => {
    for (const lesson of LESSONS) {
      expect(lesson.sections.length, lesson.slug).toBeGreaterThan(0);
      const ids = lesson.sections.map((s) => s.id);
      expect(new Set(ids).size, `duplicate section id in ${lesson.slug}`).toBe(ids.length);
    }
  });

  it('every slug has a component in the registry, and vice versa', () => {
    const slugs = LESSONS.map((l) => l.slug).sort();
    expect(Object.keys(LESSON_COMPONENTS).sort()).toEqual(slugs);
  });

  it('lesson metadata is complete', () => {
    for (const lesson of LESSONS) {
      expect(lesson.title, lesson.slug).toBeTruthy();
      expect(lesson.shortTitle, lesson.slug).toBeTruthy();
      expect(lesson.summary, lesson.slug).toBeTruthy();
      expect(lesson.icon, lesson.slug).toBeTruthy();
    }
  });
});
