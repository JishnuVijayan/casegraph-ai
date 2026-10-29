import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { App } from './App';
test('shows urgent official guidance and honest scaffold boundaries', () => {
 render(<MemoryRouter><App /></MemoryRouter>);
 expect(screen.getByRole('link', { name: '1930' })).toHaveAttribute('href', 'tel:1930');
 expect(screen.getByRole('link', { name: 'cybercrime.gov.in' })).toHaveAttribute('href', 'https://cybercrime.gov.in/');
 expect(screen.getByText(/Contact your bank immediately/)).toBeVisible();
 expect(screen.getByText(/Create synthetic cases and upload/)).toBeVisible();
 expect(screen.queryByLabelText(/Synthetic PNG/)).not.toBeInTheDocument();
});
