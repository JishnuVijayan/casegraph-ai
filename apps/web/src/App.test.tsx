import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';

afterEach(() => cleanup());

test('shows victim filing hero without officer or debug share controls', () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'CaseGraph AI' })).toBeVisible();
  expect(screen.getByRole('link',{name:'1930'})).toHaveAttribute('href','tel:1930');
  expect(screen.getByRole('link',{name:'cybercrime.gov.in'})).toHaveAttribute('href','https://cybercrime.gov.in/');
  expect(screen.getByText('Hackathon demo · synthetic data')).toBeVisible();
  expect(screen.getByText(/Turn scattered evidence into a clear complaint draft/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Officer workspace' })).toHaveAttribute('href', '/officer');
  expect(screen.queryByLabelText('Case ID')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Grant access' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Image file/)).not.toBeInTheDocument();
});

test('shows officer workspace entry on /officer', () => {
  render(<MemoryRouter initialEntries={['/officer']}><App /></MemoryRouter>);
  expect(screen.getByText(/Review complaints and related-case leads/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Continue as officer' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'File a complaint' })).toHaveAttribute('href', '/');
  expect(screen.queryByText(/Turn scattered evidence into a clear complaint draft/)).not.toBeInTheDocument();
});
