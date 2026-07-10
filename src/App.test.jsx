import { render, screen } from '@testing-library/react';
import App from './App';

describe('App smoke test', () => {
  it('renders public facade on initial load', async () => {
    render(<App />);
    expect(await screen.findByText(/Centro de Cultura/i)).toBeInTheDocument();
  });
});
