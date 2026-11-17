import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalWikiNode } from '@colanode/client/types';
import { NodeRole, WikiPublicationOutput } from '@colanode/core';
import { WikiPublication } from '@colanode/ui/components/wikis/wiki-publication';

import { act, customRender, fireEvent, screen } from '../../test-utils';

type QueryCall = {
  input: { type: string; slug?: string; [key: string]: unknown };
  options?: { enabled?: boolean };
};

type MutateOptions = {
  input: { type: string; [key: string]: unknown };
  onSuccess?: (output: unknown) => void;
  onError?: (error: { code: string; message: string }) => void;
};

const state = vi.hoisted(() => ({
  publicationData: undefined as unknown,
  availabilityData: undefined as unknown,
  isPending: false,
  queryCalls: [] as unknown[],
}));

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  mutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'user1', workspaceId: 'ws1' }),
}));

vi.mock('@colanode/ui/hooks/use-query', () => ({
  useQuery: (input: QueryCall['input'], options: QueryCall['options']) => {
    state.queryCalls.push({ input, options });
    if (input.type === 'wiki.publication.get') {
      return { data: state.publicationData, refetch: mocks.refetch };
    }
    return { data: state.availabilityData, refetch: vi.fn() };
  },
}));

vi.mock('@colanode/ui/hooks/use-mutation', () => ({
  useMutation: () => ({ mutate: mocks.mutate, isPending: state.isPending }),
}));

vi.mock('@colanode/ui/components/wikis/wiki-publication-notice', () => ({
  WikiPublicationNotice: () => <p>publication notice</p>,
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const wiki = {
  id: 'wiki1',
  type: 'wiki',
  name: 'Product Docs',
  parentId: null,
  rootId: 'wiki1',
  collaborators: { user1: 'admin' },
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'user1',
  updatedAt: null,
  updatedBy: null,
} as unknown as LocalWikiNode;

const buildPublication = (
  overrides: Partial<WikiPublicationOutput> = {}
): WikiPublicationOutput => ({
  wikiId: 'wiki1',
  slug: 'product-docs',
  access: 'public',
  homeNodeId: null,
  url: 'https://colanode.test/wiki/product-docs',
  hasLink: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
  ...overrides,
});

const setPublication = (publication: WikiPublicationOutput | null) => {
  state.publicationData = { publication };
};

const renderPublication = (role: NodeRole = 'admin') =>
  customRender(<WikiPublication wiki={wiki} role={role} />);

const queryCalls = () => state.queryCalls as QueryCall[];

const lastQuery = (type: string) =>
  queryCalls()
    .filter((call) => call.input.type === type)
    .at(-1);

const mutateCall = (index: number) =>
  mocks.mutate.mock.calls[index]?.[0] as MutateOptions;

const saveButton = (name: string | RegExp) =>
  screen.getByRole('button', { name });

const copyButton = (inputId: string) => {
  const input = document.getElementById(inputId);
  const button = input?.parentElement?.querySelector('button');
  if (!button) {
    throw new Error(`No copy button for ${inputId}`);
  }
  return button;
};

const stubClipboard = (writeText: (value: string) => Promise<void>) => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(writeText) },
    configurable: true,
  });
  return navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  state.publicationData = undefined;
  state.availabilityData = undefined;
  state.isPending = false;
  state.queryCalls = [];
  mocks.refetch.mockReset();
  mocks.mutate.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('components/wikis/WikiPublication', () => {
  describe('for non admins', () => {
    it('explains that only admins can publish', () => {
      renderPublication('editor');

      expect(
        screen.getByText(
          'Only the admins of this wiki can publish it or change how it is shared.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
      expect(lastQuery('wiki.publication.get')?.options?.enabled).toBe(false);
      expect(lastQuery('wiki.slug.availability')?.options?.enabled).toBe(false);
    });
  });

  describe('for admins without publication', () => {
    it('starts private with a disabled save button', () => {
      setPublication(null);
      renderPublication();

      expect(lastQuery('wiki.publication.get')).toEqual({
        input: {
          type: 'wiki.publication.get',
          userId: 'user1',
          wikiId: 'wiki1',
        },
        options: { enabled: true },
      });

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(screen.getByRole('radio', { name: /Private/ })).toHaveAttribute(
        'aria-checked',
        'true'
      );
      expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();
      expect(saveButton('Save')).toBeDisabled();
      expect(lastQuery('wiki.slug.availability')?.options?.enabled).toBe(false);
    });

    it('switches between modes', async () => {
      const user = userEvent.setup();
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Public/ }));
      expect(screen.getByRole('radio', { name: /Public/ })).toHaveAttribute(
        'aria-checked',
        'true'
      );
      expect(screen.getByLabelText('Address')).toHaveValue('product-docs');
      expect(
        screen.getByText(
          'Pages get readable addresses from their names, for example /wiki/product-docs/getting-started.'
        )
      ).toBeInTheDocument();
      expect(saveButton('Publish')).toBeEnabled();

      await user.click(
        screen.getByRole('radio', { name: /Anyone with the link/ })
      );
      expect(
        screen.getByRole('radio', { name: /Anyone with the link/ })
      ).toHaveAttribute('aria-checked', 'true');
      expect(saveButton('Publish')).toBeEnabled();

      await user.click(screen.getByRole('radio', { name: /Private/ }));
      expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();
      expect(saveButton('Save')).toBeDisabled();
    });

    it('rejects invalid addresses', async () => {
      const user = userEvent.setup();
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Public/ }));
      const input = screen.getByLabelText('Address');

      for (const value of ['ab', 'bad slug', 'wiki', 'bad--slug']) {
        await user.clear(input);
        await user.type(input, value);
        expect(
          screen.getByText('Use 3 to 64 lowercase letters, digits and dashes.')
        ).toHaveClass('text-red-600');
        expect(saveButton('Publish')).toBeDisabled();
      }
    });

    it('normalizes the address before validating and saving', async () => {
      const user = userEvent.setup();
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Public/ }));
      const input = screen.getByLabelText('Address');
      await user.clear(input);
      await user.type(input, ' My-Docs ');

      expect(
        screen.getByText(
          'Pages get readable addresses from their names, for example /wiki/my-docs/getting-started.'
        )
      ).toHaveClass('text-muted-foreground');

      await user.click(saveButton('Publish'));
      expect(mutateCall(0).input).toEqual({
        type: 'wiki.publication.update',
        userId: 'user1',
        wikiId: 'wiki1',
        slug: 'my-docs',
        access: 'public',
      });
    });

    it('shows when the address is taken', async () => {
      const user = userEvent.setup();
      state.availabilityData = {
        slug: 'product-docs',
        valid: true,
        available: false,
      };
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Public/ }));

      expect(
        screen.getByText('This address is already used by another wiki.')
      ).toHaveClass('text-red-600');
      expect(saveButton('Publish')).toBeDisabled();
    });

    it('ignores availability results for another address', async () => {
      const user = userEvent.setup();
      state.availabilityData = {
        slug: 'other-docs',
        valid: true,
        available: false,
      };
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Public/ }));

      expect(
        screen.queryByText('This address is already used by another wiki.')
      ).not.toBeInTheDocument();
      expect(saveButton('Publish')).toBeEnabled();
    });

    it('publishes publicly', async () => {
      const user = userEvent.setup();
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Public/ }));
      await user.click(saveButton('Publish'));

      expect(mocks.mutate).toHaveBeenCalledTimes(1);
      expect(mutateCall(0).input).toEqual({
        type: 'wiki.publication.update',
        userId: 'user1',
        wikiId: 'wiki1',
        slug: 'product-docs',
        access: 'public',
      });

      act(() => {
        mutateCall(0).onSuccess?.(buildPublication());
      });

      expect(mocks.refetch).toHaveBeenCalledTimes(1);
      expect(mocks.toastSuccess).toHaveBeenCalledWith('The wiki is public.');
      expect(mocks.mutate).toHaveBeenCalledTimes(1);
    });

    it('publishes by link and creates the first access link', async () => {
      const user = userEvent.setup();
      renderPublication();

      await user.click(
        screen.getByRole('radio', { name: /Anyone with the link/ })
      );
      await user.click(saveButton('Publish'));
      expect(mutateCall(0).input).toMatchObject({
        type: 'wiki.publication.update',
        access: 'link',
      });

      const published = buildPublication({ access: 'link', hasLink: false });
      act(() => {
        mutateCall(0).onSuccess?.(published);
      });

      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'The wiki can be read with its access link.'
      );
      expect(mocks.mutate).toHaveBeenCalledTimes(2);
      expect(mutateCall(1).input).toEqual({
        type: 'wiki.publication.link.create',
        userId: 'user1',
        wikiId: 'wiki1',
      });

      setPublication({ ...published, hasLink: true });
      act(() => {
        mutateCall(1).onSuccess?.({
          linkUrl: 'https://colanode.test/wiki/s/secret',
        });
      });

      expect(mocks.refetch).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText('Access link')).toHaveValue(
        'https://colanode.test/wiki/s/secret'
      );
      expect(
        screen.getByText(/Copy this link now: it is shown only once/)
      ).toBeInTheDocument();
      expect(saveButton('Create a new link')).toBeInTheDocument();
    });

    it('does not create a link when one already exists', async () => {
      const user = userEvent.setup();
      renderPublication();

      await user.click(
        screen.getByRole('radio', { name: /Anyone with the link/ })
      );
      await user.click(saveButton('Publish'));
      act(() => {
        mutateCall(0).onSuccess?.(
          buildPublication({ access: 'link', hasLink: true })
        );
      });

      expect(mocks.mutate).toHaveBeenCalledTimes(1);
    });

    it('shows update errors', async () => {
      const user = userEvent.setup();
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Public/ }));
      await user.click(saveButton('Publish'));
      act(() => {
        mutateCall(0).onError?.({ code: 'api_error', message: 'Slug taken' });
      });

      expect(mocks.toastError).toHaveBeenCalledWith('Slug taken');
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });

    it('shows link creation errors after publishing', async () => {
      const user = userEvent.setup();
      renderPublication();

      await user.click(
        screen.getByRole('radio', { name: /Anyone with the link/ })
      );
      await user.click(saveButton('Publish'));
      act(() => {
        mutateCall(0).onSuccess?.(
          buildPublication({ access: 'link', hasLink: false })
        );
      });
      act(() => {
        mutateCall(1).onError?.({ code: 'api_error', message: 'Link failed' });
      });

      expect(mocks.toastError).toHaveBeenCalledWith('Link failed');
    });

    it('disables saving while a mutation is pending', async () => {
      const user = userEvent.setup();
      state.isPending = true;
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Public/ }));
      expect(saveButton('Publish')).toBeDisabled();
    });
  });

  describe('for admins with a publication', () => {
    it('loads a public publication', () => {
      setPublication(buildPublication({ slug: 'team-docs' }));
      renderPublication();

      expect(screen.getByRole('radio', { name: /Public/ })).toHaveAttribute(
        'aria-checked',
        'true'
      );
      expect(screen.getByLabelText('Address')).toHaveValue('team-docs');
      expect(saveButton('Update publication')).toBeDisabled();
      expect(screen.getByLabelText('Public address')).toHaveValue(
        'https://colanode.test/wiki/product-docs'
      );
      expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
        'href',
        'https://colanode.test/wiki/product-docs'
      );
      expect(screen.queryByLabelText('Access link')).not.toBeInTheDocument();
    });

    it('does not check the availability of the current address', () => {
      vi.useFakeTimers();
      setPublication(buildPublication({ slug: 'team-docs' }));
      renderPublication();

      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(lastQuery('wiki.slug.availability')).toMatchObject({
        input: { slug: 'team-docs' },
        options: { enabled: false },
      });
    });

    it('updates the address of a publication', async () => {
      const user = userEvent.setup();
      setPublication(buildPublication());
      renderPublication();

      const input = screen.getByLabelText('Address');
      await user.clear(input);
      await user.type(input, 'new-docs');
      expect(saveButton('Update publication')).toBeEnabled();

      await user.click(saveButton('Update publication'));
      expect(mutateCall(0).input).toMatchObject({
        type: 'wiki.publication.update',
        slug: 'new-docs',
        access: 'public',
      });
    });

    it('marks an access change as dirty', async () => {
      const user = userEvent.setup();
      setPublication(buildPublication());
      renderPublication();

      await user.click(
        screen.getByRole('radio', { name: /Anyone with the link/ })
      );
      expect(saveButton('Update publication')).toBeEnabled();
    });

    it('unpublishes the wiki', async () => {
      const user = userEvent.setup();
      setPublication(buildPublication());
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Private/ }));
      await user.click(saveButton('Unpublish'));

      expect(mutateCall(0).input).toEqual({
        type: 'wiki.publication.delete',
        userId: 'user1',
        wikiId: 'wiki1',
      });

      act(() => {
        mutateCall(0).onSuccess?.({ success: true });
      });
      expect(mocks.refetch).toHaveBeenCalledTimes(1);
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'The wiki is private again.'
      );
    });

    it('shows unpublish errors', async () => {
      const user = userEvent.setup();
      setPublication(buildPublication());
      renderPublication();

      await user.click(screen.getByRole('radio', { name: /Private/ }));
      await user.click(saveButton('Unpublish'));
      act(() => {
        mutateCall(0).onError?.({ code: 'api_error', message: 'Forbidden' });
      });

      expect(mocks.toastError).toHaveBeenCalledWith('Forbidden');
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });

    it('offers to replace an existing access link', async () => {
      const user = userEvent.setup();
      setPublication(buildPublication({ access: 'link', hasLink: true }));
      renderPublication();

      expect(
        screen.getByLabelText('Address (works after opening the access link)')
      ).toHaveValue('https://colanode.test/wiki/product-docs');
      expect(
        screen.getByText(/An access link exists\. For security/)
      ).toBeInTheDocument();

      await user.click(saveButton('Create a new link'));
      expect(mutateCall(0).input).toEqual({
        type: 'wiki.publication.link.create',
        userId: 'user1',
        wikiId: 'wiki1',
      });

      act(() => {
        mutateCall(0).onError?.({ code: 'api_error', message: 'Too many' });
      });
      expect(mocks.toastError).toHaveBeenCalledWith('Too many');
    });

    it('offers to create the first access link', async () => {
      const user = userEvent.setup();
      setPublication(buildPublication({ access: 'link', hasLink: false }));
      renderPublication();

      expect(screen.getByText('No access link yet.')).toBeInTheDocument();
      await user.click(saveButton('Create the link'));
      act(() => {
        mutateCall(0).onSuccess?.({
          linkUrl: 'https://colanode.test/wiki/s/first',
        });
      });

      expect(screen.getByLabelText('Access link')).toHaveValue(
        'https://colanode.test/wiki/s/first'
      );
    });

    it('disables link creation while pending', () => {
      state.isPending = true;
      setPublication(buildPublication({ access: 'link', hasLink: true }));
      renderPublication();

      expect(saveButton('Create a new link')).toBeDisabled();
    });
  });

  describe('copy field', () => {
    it('copies the address and shows a check for a moment', async () => {
      vi.useFakeTimers();
      const writeText = stubClipboard(async () => {});
      setPublication(buildPublication());
      renderPublication();

      const button = copyButton('wiki-url');
      expect(button.querySelector('.lucide-copy')).not.toBeNull();

      await act(async () => {
        fireEvent.click(button);
      });

      expect(writeText).toHaveBeenCalledWith(
        'https://colanode.test/wiki/product-docs'
      );
      expect(button.querySelector('.lucide-check')).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(button.querySelector('.lucide-copy')).not.toBeNull();
      expect(mocks.toastError).not.toHaveBeenCalled();
    });

    it('shows an error when the clipboard is unavailable', async () => {
      stubClipboard(async () => {
        throw new Error('denied');
      });
      setPublication(buildPublication());
      renderPublication();

      const button = copyButton('wiki-url');
      await act(async () => {
        fireEvent.click(button);
      });

      expect(mocks.toastError).toHaveBeenCalledWith(
        'Could not copy. Select the address and copy it.'
      );
      expect(button.querySelector('.lucide-copy')).not.toBeNull();
    });
  });

  describe('address availability', () => {
    it('debounces the availability check', () => {
      vi.useFakeTimers();
      state.publicationData = { publication: null };
      renderPublication();

      fireEvent.click(screen.getByRole('radio', { name: /Public/ }));
      expect(lastQuery('wiki.slug.availability')).toEqual({
        input: {
          type: 'wiki.slug.availability',
          userId: 'user1',
          wikiId: 'wiki1',
          slug: 'product-docs',
        },
        options: { enabled: true },
      });

      fireEvent.change(screen.getByLabelText('Address'), {
        target: { value: 'Other-Docs' },
      });
      expect(lastQuery('wiki.slug.availability')?.input.slug).toBe(
        'product-docs'
      );

      act(() => {
        vi.advanceTimersByTime(399);
      });
      expect(lastQuery('wiki.slug.availability')?.input.slug).toBe(
        'product-docs'
      );

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(lastQuery('wiki.slug.availability')?.input.slug).toBe(
        'other-docs'
      );
    });

    it('waits for the stored publication before checking an address', () => {
      renderPublication();
      fireEvent.click(screen.getByRole('radio', { name: /Public/ }));

      expect(lastQuery('wiki.slug.availability')?.options?.enabled).toBe(false);
    });

    it('restarts the debounce on each change', () => {
      vi.useFakeTimers();
      renderPublication();

      fireEvent.click(screen.getByRole('radio', { name: /Public/ }));
      const input = screen.getByLabelText('Address');

      fireEvent.change(input, { target: { value: 'first-docs' } });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      fireEvent.change(input, { target: { value: 'second-docs' } });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastQuery('wiki.slug.availability')?.input.slug).toBe(
        'product-docs'
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(lastQuery('wiki.slug.availability')?.input.slug).toBe(
        'second-docs'
      );
    });

    it('skips the check for invalid addresses', () => {
      vi.useFakeTimers();
      renderPublication();

      fireEvent.click(screen.getByRole('radio', { name: /Public/ }));
      fireEvent.change(screen.getByLabelText('Address'), {
        target: { value: 'ab' },
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(lastQuery('wiki.slug.availability')).toMatchObject({
        input: { slug: 'ab' },
        options: { enabled: false },
      });
    });
  });
});
