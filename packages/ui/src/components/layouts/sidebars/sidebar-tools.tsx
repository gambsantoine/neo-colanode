import { SidebarHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-header';
import { SidebarSettingsItem } from '@colanode/ui/components/layouts/sidebars/sidebar-settings-item';
import { Link } from '@colanode/ui/components/ui/link';
import { groupToolsByCategory } from '@colanode/ui/lib/tools';

export const SidebarTools = () => {
  const groups = groupToolsByCategory();

  return (
    <div className="flex flex-col gap-4 h-full px-2 group/sidebar">
      <div className="flex w-full min-w-0 flex-col gap-1">
        <SidebarHeader title="Tools" />
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
