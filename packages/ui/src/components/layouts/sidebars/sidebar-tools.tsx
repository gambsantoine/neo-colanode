import { Search, X } from 'lucide-react';
import { useState } from 'react';

import { SidebarHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-header';
import { SidebarSettingsItem } from '@colanode/ui/components/layouts/sidebars/sidebar-settings-item';
import { Input } from '@colanode/ui/components/ui/input';
import { Link } from '@colanode/ui/components/ui/link';
import { groupToolsByCategory, searchTools } from '@colanode/ui/lib/tools';

export const SidebarTools = () => {
  const [query, setQuery] = useState('');
  const groups = groupToolsByCategory(searchTools(query));

  return (
    <div className="flex flex-col gap-4 h-full px-2 group/sidebar">
      <div className="flex w-full min-w-0 flex-col gap-1">
        <SidebarHeader title="Tools" />
        <div className="relative px-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('');
              }
            }}
            placeholder="Search tools"
            aria-label="Search tools"
            className="h-8 pl-8 pr-8 text-sm"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {groups.length === 0 && (
          <p className="px-2 pt-2 text-sm text-muted-foreground">
            No tools match "{query.trim()}"
          </p>
        )}
        {groups.map((group) => (
          <div key={group.category} className="flex flex-col gap-1">
            <p className="px-2 pt-2 text-xs font-medium text-muted-foreground">
              {group.name}
            </p>
            {group.tools.map((tool) => (
              <Link key={tool.id} from="/workspace/$userId" to={tool.path}>
                {({ isActive }) => (
                  <SidebarSettingsItem
                    title={tool.name}
                    icon={tool.icon}
                    isActive={isActive}
                  />
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
