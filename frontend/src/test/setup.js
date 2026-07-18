import '@testing-library/jest-dom';

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer requires one.
// A no-op stub is enough — chart layout isn't under test, only that pages
// render their content around the charts.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom implements neither window.scrollTo nor Element.scrollIntoView; the
// Learning Center lesson pages call both for anchor deep-links. No-op stubs —
// scrolling behaviour isn't under test, only that pages render.
window.scrollTo = () => {};
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
