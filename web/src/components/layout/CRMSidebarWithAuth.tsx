import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Home,
  BarChart3,
  Settings,
  List,
  Workflow,
  Cog,
  Zap,
  Inbox,
  Bot,
  Radio,
  ListTodo,
} from "lucide-react";
import { useLocation, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { OrgSwitcher } from "./OrgSwitcher";
import { UserOrgMenu } from "./UserOrgMenu";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const principalItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Leads", url: "/leads", icon: List },
  { title: "Oportunidades", url: "/oportunidades", icon: Workflow },
  { title: "Tarefas", url: "/tarefas", icon: ListTodo },
  { title: "Inbox", url: "/inbox", icon: Inbox },
  { title: "Disparos", url: "/broadcasts", icon: Radio },
];

const vendasItems: NavItem[] = [
  { title: "Pipelines", url: "/pipelines", icon: Cog },
  { title: "Automações", url: "/automacoes", icon: Zap },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
];

const adminItems: NavItem[] = [
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Treinar Agente IA", url: "/treinar-agente", icon: Bot },
];

export function CRMSidebarWithAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const { settings: orgSettings } = useOrgSettings();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const filterByModule = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.url === "/inbox" && !orgSettings.inbox_enabled) return false;
      return true;
    });

  const renderGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="font-poppins font-medium text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.url}
                  className="font-poppins"
                >
                  <NavLink to={item.url} end>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className="hidden md:flex border-r border-border/40">
      <SidebarHeader className="px-3 py-4">
        <OrgSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Principal", filterByModule(principalItems))}
        {renderGroup("Vendas", vendasItems)}
        {isAdmin && renderGroup("Administração", adminItems)}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="bg-muted/50 rounded-lg p-2 space-y-1">
          <UserOrgMenu onLogout={handleLogout} />
          <ThemeToggle variant="full" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
