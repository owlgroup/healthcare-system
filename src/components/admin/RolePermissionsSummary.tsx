import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getPermissionCategoryLabel,
  getPermissionDisplayName,
  groupPermissionsByCategory,
} from "@/config/rbac-permissions";
import type { PermissionRow } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const COLLAPSE_THRESHOLD = 10;

function PermissionChip({ permission }: { permission: PermissionRow }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default items-center whitespace-nowrap rounded-full border border-[#E1DDDA] bg-[#FAF9F8] px-[9px] py-[3px] text-xs text-foreground">
          {getPermissionDisplayName(permission)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="font-mono text-xs">{permission.slug}</TooltipContent>
    </Tooltip>
  );
}

function GroupedPermissions({ groups }: { groups: [string, PermissionRow[]][] }) {
  return (
    <div className="mt-1 flex flex-col gap-2">
      {groups.map(([category, perms]) => (
        <div key={category} className="flex flex-col gap-[5px]">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#9A928D]">
            {getPermissionCategoryLabel(category)}
          </span>
          <div className="flex flex-wrap gap-[5px]">
            {perms.map((permission) => (
              <PermissionChip key={permission.id} permission={permission} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RolePermissionsSummary({ permissions }: { permissions: PermissionRow[] }) {
  const groups = groupPermissionsByCategory(permissions);

  if (permissions.length === 0) {
    return <p className="text-xs text-[#9A928D]">Không có quyền hạn</p>;
  }

  const categoryCount = groups.length;

  if (permissions.length <= COLLAPSE_THRESHOLD) {
    return <GroupedPermissions groups={groups} />;
  }

  return (
    <Collapsible className="group">
      <GroupedPermissions groups={groups.slice(0, 1)} />
      <CollapsibleContent>
        <GroupedPermissions groups={groups.slice(1)} />
      </CollapsibleContent>
      <CollapsibleTrigger
        className={cn(
          "mt-1 inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs text-[#7A726D]",
          "transition-colors duration-200 hover:text-foreground",
        )}
      >
        {permissions.length} quyền · {categoryCount} nhóm ·{" "}
        <span className="font-semibold text-primary group-data-[state=open]:hidden">Xem chi tiết</span>
        <span className="hidden font-semibold text-primary group-data-[state=open]:inline">Thu gọn</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
    </Collapsible>
  );
}

export default RolePermissionsSummary;

export function PermissionCountBadge({ count }: { count: number }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {count} quyền
    </Badge>
  );
}
