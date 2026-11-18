import { and, eq, useLiveQuery } from '@tanstack/react-db';
import { TriangleAlert } from 'lucide-react';

import { LocalNode } from '@colanode/client/types';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

export interface SensitiveField {
  databaseName: string;
  fieldName: string;
  kind: 'email' | 'phone';
}

// Database fields holding contact details: published with the wiki, their
// values become readable by anyone who can open it.
export const findSensitiveFields = (nodes: LocalNode[]): SensitiveField[] => {
  const fields: SensitiveField[] = [];
  for (const node of nodes) {
    if (node.type !== 'database') {
      continue;
    }

    for (const field of Object.values(node.fields ?? {})) {
      if (field.type === 'email' || field.type === 'phone') {
        fields.push({
          databaseName: node.name || 'Untitled',
          fieldName: field.name,
          kind: field.type,
        });
      }
    }
  }

  return fields;
};

interface WikiPublicationNoticeProps {
  wikiId: string;
}

export const WikiPublicationNotice = ({
  wikiId,
}: WikiPublicationNoticeProps) => {
  const workspace = useWorkspace();
  const databasesQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) =>
          and(eq(nodes.rootId, wikiId), eq(nodes.type, 'database'))
        ),
    [workspace.userId, wikiId]
  );

  const sensitive = findSensitiveFields(
    (databasesQuery.data ?? []) as LocalNode[]
  );

  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 shrink-0" />
        What readers will see
      </p>
      <p>
        Pages, files, images and databases of this wiki. Mentioned people appear
        with their username, never with their name or email.
      </p>
      {sensitive.length > 0 && (
        <div>
          <p className="font-medium">
            These fields hold email addresses or phone numbers and will be
            public:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {sensitive.map((field) => (
              <li key={`${field.databaseName}-${field.fieldName}`}>
                {field.fieldName} ({field.kind === 'email' ? 'email' : 'phone'})
                in {field.databaseName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
