import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';

afterEach(() => cleanup());

test('shows victim intake hero with name and mobile, without fixture picker', () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'CaseGraph AI' })).toBeVisible();
  expect(screen.getByText('Hackathon demo')).toBeVisible();
  expect(screen.getByText(/File a complaint in a few clear steps/)).toBeVisible();
  expect(screen.getByLabelText('Your name')).toBeVisible();
  expect(screen.getByLabelText('Mobile number')).toBeVisible();
  expect(screen.queryByLabelText('Fictional identity')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Officer workspace' })).toHaveAttribute('href', '/officer');
  expect(screen.queryByLabelText('Case ID')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Grant access' })).not.toBeInTheDocument();
});

test('shows officer workspace entry on /officer', () => {
  render(<MemoryRouter initialEntries={['/officer']}><App /></MemoryRouter>);
  expect(screen.getByText(/Review complaints and related-case leads/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Continue as officer' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'File a complaint' })).toHaveAttribute('href', '/');
  expect(screen.queryByText(/File a complaint in a few clear steps/)).not.toBeInTheDocument();
});
