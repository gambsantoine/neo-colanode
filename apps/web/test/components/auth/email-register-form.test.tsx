import { describe, expect, it, vi } from 'vitest';

import { RegisterForm } from '@colanode/ui/components/auth/email-register-form';

import { customRender, fireEvent, screen, waitFor } from '../../test-utils';

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('components/auth/RegisterForm', () => {
  it('suggests a username from the name until it is edited', () => {
    customRender(<RegisterForm isPending={false} onSubmit={vi.fn()} />);

    fill('Name', 'Ada Lovelace');
    expect(screen.getByLabelText('Username')).toHaveValue('ada_lovelace');

    fill('Username', 'ada');
    fill('Name', 'Ada King');
    expect(screen.getByLabelText('Username')).toHaveValue('ada');
  });

  it('sends a normalized username', async () => {
    const onSubmit = vi.fn();
    customRender(<RegisterForm isPending={false} onSubmit={onSubmit} />);

    fill('Name', 'Ada Lovelace');
    fill('Username', '  @Ada.L  ');
    fill('Email', 'ada@example.com');
    fill('Password', 'Secret-Pass1');
    fill('Confirm Password', 'Secret-Pass1');
    fireEvent.click(screen.getByRole('button', { name: /Register/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      username: 'ada.l',
      email: 'ada@example.com',
    });
  });

  it('refuses an invalid username', async () => {
    const onSubmit = vi.fn();
    customRender(<RegisterForm isPending={false} onSubmit={onSubmit} />);

    fill('Name', 'Ada Lovelace');
    fill('Username', 'a b');
    fill('Email', 'ada@example.com');
    fill('Password', 'Secret-Pass1');
    fill('Confirm Password', 'Secret-Pass1');
    fireEvent.click(screen.getByRole('button', { name: /Register/ }));

    await waitFor(() =>
      expect(screen.getByText(/3 to 32 lowercase letters/)).toBeInTheDocument()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
