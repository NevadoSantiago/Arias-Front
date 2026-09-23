import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodayOrderPage } from './TodayOrderPage';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';

// `TodayOrderPage` is a thin branch — the actual screens are exercised by
// their own test files (`CompanyOrderPage`/`B2cOrderPage`). Stubbing them
// here keeps this test focused on ONE thing: does the branch pick the right
// screen for the right user, based on `companyId`.
vi.mock('./CompanyOrderPage', () => ({
  CompanyOrderPage: () => <p>legacy-single-dish-flow</p>,
}));
vi.mock('./B2cOrderPage', () => ({
  B2cOrderPage: () => <p>b2c-multi-item-cart-flow</p>,
}));

const baseUser: AuthUser = {
  id: 1,
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: null,
  role: 'EMPLOYEE',
  companyId: null,
  companyName: null,
  categoryId: 3,
  emailVerified: true,
  profileComplete: true,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <TodayOrderPage />
    </MemoryRouter>,
  );
}

describe('TodayOrderPage — branches on whether the user has a company', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
  });

  it('renders the legacy single-dish flow for a company employee (B2B, companyId set)', () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: { ...baseUser, companyId: 42, companyName: 'Acme' },
      bootstrapping: false,
    });

    renderPage();

    expect(screen.getByText('legacy-single-dish-flow')).toBeInTheDocument();
    expect(screen.queryByText('b2c-multi-item-cart-flow')).not.toBeInTheDocument();
  });

  it('renders the multi-item credits cart for a customer without a company (B2C, companyId null)', () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: { ...baseUser, companyId: null, categoryId: null },
      bootstrapping: false,
    });

    renderPage();

    expect(screen.getByText('b2c-multi-item-cart-flow')).toBeInTheDocument();
    expect(screen.queryByText('legacy-single-dish-flow')).not.toBeInTheDocument();
  });

  it('shows a loading state instead of guessing a flow while the user is not loaded yet', () => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });

    renderPage();

    expect(screen.queryByText('legacy-single-dish-flow')).not.toBeInTheDocument();
    expect(screen.queryByText('b2c-multi-item-cart-flow')).not.toBeInTheDocument();
  });
});
