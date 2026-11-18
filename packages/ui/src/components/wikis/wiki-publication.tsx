import { Check, Copy, ExternalLink, Globe, Link2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { LocalWikiNode } from '@colanode/client/types';
import {
  hasNodeRole,
  isValidWikiSlug,
  NodeRole,
  slugify,
  WikiAccess,
} from '@colanode/core';
import { Button } from '@colanode/ui/components/ui/button';
import { Input } from '@colanode/ui/components/ui/input';
import { Label } from '@colanode/ui/components/ui/label';
import { WikiPublicationNotice } from '@colanode/ui/components/wikis/wiki-publication-notice';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useDebouncedValue } from '@colanode/ui/hooks/use-debounced-value';
import { useMutation } from '@colanode/ui/hooks/use-mutation';
import { useQuery } from '@colanode/ui/hooks/use-query';
import { cn } from '@colanode/ui/lib/utils';

type PublicationMode = 'private' | WikiAccess;

const MODES: {
  value: PublicationMode;
  label: string;
  description: string;
  icon: typeof Lock;
}[] = [
  {
    value: 'private',
    label: 'Private',
    description:
      'Only the collaborators of this wiki can read it, in Colanode.',
    icon: Lock,
  },
  {
    value: 'link',
    label: 'Anyone with the link',
    description:
      'People with the secret access link can read it, without an account. Not indexed by search engines.',
    icon: Link2,
  },
  {
    value: 'public',
    label: 'Public',
    description:
      'Anyone can read it at its address. Search engines can index it.',
    icon: Globe,
  },
];

const CopyField = ({ id, value }: { id: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy. Select the address and copy it.');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input id={id} value={value} readOnly className="font-mono text-xs" />
      <Button type="button" variant="outline" size="icon" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
      <Button type="button" variant="outline" size="icon" asChild>
        <a href={value} target="_blank" rel="noreferrer" aria-label="Open">
          <ExternalLink className="size-4" />
        </a>
      </Button>
    </div>
  );
};

interface WikiPublicationProps {
  wiki: LocalWikiNode;
  role: NodeRole;
}

export const WikiPublication = ({ wiki, role }: WikiPublicationProps) => {
  const workspace = useWorkspace();
  const isAdmin = hasNodeRole(role, 'admin');
  const { mutate, isPending } = useMutation();

  const publicationQuery = useQuery(
    { type: 'wiki.publication.get', userId: workspace.userId, wikiId: wiki.id },
    { enabled: isAdmin }
  );
  const publication = publicationQuery.data?.publication ?? null;

  const [mode, setMode] = useState<PublicationMode>('private');
  const [slug, setSlug] = useState(() => slugify(wiki.name));
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    if (publication) {
      setMode(publication.access);
      setSlug(publication.slug);
    }
  }, [publication?.access, publication?.slug]);

  const normalizedSlug = slug.trim().toLowerCase();
  const debouncedSlug = useDebouncedValue(normalizedSlug, 400);
  const slugValid = isValidWikiSlug(normalizedSlug);
  const availabilityQuery = useQuery(
    {
      type: 'wiki.slug.availability',
      userId: workspace.userId,
      wikiId: wiki.id,
      slug: debouncedSlug,
    },
    {
      // Only once the stored publication is known and typing has paused:
      // otherwise the address derived from the name is checked for nothing.
      enabled:
        isAdmin &&
        publicationQuery.data !== undefined &&
        mode !== 'private' &&
        debouncedSlug === normalizedSlug &&
        isValidWikiSlug(debouncedSlug) &&
        debouncedSlug !== publication?.slug,
    }
  );
  const slugTaken =
    availabilityQuery.data?.slug === normalizedSlug &&
    availabilityQuery.data.available === false;

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the admins of this wiki can publish it or change how it is shared.
      </p>
    );
  }

  const isDirty =
    (publication?.access ?? 'private') !== mode ||
    (mode !== 'private' && publication?.slug !== normalizedSlug);

  const save = () => {
    if (mode === 'private') {
      mutate({
        input: {
          type: 'wiki.publication.delete',
          userId: workspace.userId,
          wikiId: wiki.id,
        },
        onSuccess() {
          setLinkUrl(null);
          publicationQuery.refetch();
          toast.success('The wiki is private again.');
        },
        onError(error) {
          toast.error(error.message);
        },
      });
      return;
    }

    mutate({
      input: {
        type: 'wiki.publication.update',
        userId: workspace.userId,
        wikiId: wiki.id,
        slug: normalizedSlug,
        access: mode,
      },
      onSuccess(output) {
        publicationQuery.refetch();
        if (output.access === 'link' && !output.hasLink) {
          createLink();
        }
        toast.success(
          output.access === 'public'
            ? 'The wiki is public.'
            : 'The wiki can be read with its access link.'
        );
      },
      onError(error) {
        toast.error(error.message);
      },
    });
  };

  const createLink = () => {
    mutate({
      input: {
        type: 'wiki.publication.link.create',
        userId: workspace.userId,
        wikiId: wiki.id,
      },
      onSuccess(output) {
        setLinkUrl(output.linkUrl);
        publicationQuery.refetch();
      },
      onError(error) {
        toast.error(error.message);
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
        {MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={mode === item.value}
            onClick={() => setMode(item.value)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-md border p-3 text-left cursor-pointer transition-colors',
              mode === item.value
                ? 'border-primary bg-accent'
                : 'border-border hover:bg-accent/50'
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <item.icon className="size-4" />
              {item.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.description}
            </span>
          </button>
        ))}
      </div>

      {mode !== 'private' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="wiki-slug">Address</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              /wiki/
            </span>
            <Input
              id="wiki-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="product-docs"
              className="font-mono"
            />
          </div>
          <p
            className={cn(
              'text-xs',
              !slugValid || slugTaken ? 'text-red-600' : 'text-muted-foreground'
            )}
          >
            {!slugValid
              ? 'Use 3 to 64 lowercase letters, digits and dashes.'
              : slugTaken
                ? 'This address is already used by another wiki.'
                : 'Pages get readable addresses from their names, for example /wiki/' +
                  normalizedSlug +
                  '/getting-started.'}
          </p>
        </div>
      )}

      {mode !== 'private' && <WikiPublicationNotice wikiId={wiki.id} />}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={save}
          disabled={
            isPending ||
            !isDirty ||
            (mode !== 'private' && (!slugValid || slugTaken))
          }
        >
          {mode === 'private'
            ? publication
              ? 'Unpublish'
              : 'Save'
            : publication
              ? 'Update publication'
              : 'Publish'}
        </Button>
      </div>

      {publication && (
        <div className="flex flex-col gap-4 rounded-md border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wiki-url">
              {publication.access === 'public'
                ? 'Public address'
                : 'Address (works after opening the access link)'}
            </Label>
            <CopyField id="wiki-url" value={publication.url} />
          </div>

          {publication.access === 'link' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="wiki-link">Access link</Label>
              {linkUrl ? (
                <>
                  <CopyField id="wiki-link" value={linkUrl} />
                  <p className="text-xs text-muted-foreground">
                    Copy this link now: it is shown only once. Share it with the
                    people who should read the wiki.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {publication.hasLink
                    ? 'An access link exists. For security it is not shown again. Create a new one to share it; the previous link stops working.'
                    : 'No access link yet.'}
                </p>
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={createLink}
                  disabled={isPending}
                >
                  {publication.hasLink
                    ? 'Create a new link'
                    : 'Create the link'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
