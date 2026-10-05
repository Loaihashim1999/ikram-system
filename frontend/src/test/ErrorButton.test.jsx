import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ErrorButton from '../components/ErrorButton';

it('reports the intentional verification error to the browser error handler', () => {
  const errors = [];
  const handleError = (event) => {
    errors.push(event.error);
    event.preventDefault();
  };
  window.addEventListener('error', handleError);
  try {
    render(<ErrorButton />);
    fireEvent.click(screen.getByRole('button', { name: /Break the world/ }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect(errors[0].message).toBe('This is your first error!');
  } finally {
    window.removeEventListener('error', handleError);
  }
});
