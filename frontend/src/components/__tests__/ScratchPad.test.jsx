import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ScratchPad, { evaluateExpression } from '../ScratchPad';

describe('evaluateExpression', () => {
  it.each([
    ['5 / 20', 0.25],
    ['5/(10+5+5)', 0.25],
    ['2 + 3 * 4', 14], // precedence, not left-to-right
    ['(2 + 3) * 4', 20],
    ['10 - 4 - 3', 3], // left-associative subtraction
    ['-5 + 8', 3],
    ['.5 * 8', 4],
    ['9 ÷ 2', 4.5],
    ['3 × 3', 9],
  ])('evaluates %s', (input, expected) => {
    expect(evaluateExpression(input)).toBeCloseTo(expected, 10);
  });

  it.each([
    '',
    '   ',
    '2 +',
    '2 + 3)',
    '(2 + 3',
    '5 / 0', // undefined, not Infinity
    '1.2.3',
    'alert(1)', // never eval'd, so this is just invalid input
  ])('returns null for invalid input %s', (input) => {
    expect(evaluateExpression(input)).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(evaluateExpression(null)).toBeNull();
    expect(evaluateExpression(42)).toBeNull();
  });
});

describe('ScratchPad', () => {
  // Collapsed by default so it never competes with the question; every
  // interaction test starts by opening it.
  const openPad = () => {
    render(<ScratchPad />);
    fireEvent.click(screen.getByRole('button', { name: /Scratchpad/ }));
    return screen.getByLabelText('Scratchpad expression');
  };

  it('shows a result as both a decimal and a percentage', () => {
    const input = openPad();
    fireEvent.change(input, { target: { value: '5/20' } });
    expect(screen.getByText('= 0.25')).toBeInTheDocument();
    expect(screen.getByText('= 25%')).toBeInTheDocument();
  });

  it('flags an expression it cannot evaluate instead of guessing', () => {
    const input = openPad();
    fireEvent.change(input, { target: { value: '5/' } });
    expect(screen.getByText(/Check the expression/)).toBeInTheDocument();
  });

  it('saves a committed line to the tape and clears the input', () => {
    const input = openPad();
    fireEvent.change(input, { target: { value: '12+8' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('');
    expect(screen.getByRole('button', { name: '12+8' })).toBeInTheDocument();
  });
});
