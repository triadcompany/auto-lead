import React, { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  Car,
  PlusCircle,
  Workflow,
  List,
  Cog,
  ListTodo,
  Inbox,
  Building2,
  CalendarClock,
  MailCheck,
  MessageSquare,
  PlayCircle,
  ChevronDown,
  Bug,
  Stethoscope,
  Radio,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Leads",
    url: "/leads",
    icon: List,
  },
  {
    title: "Oportunidades",
    url: "/oportunidades",
    icon: Workflow,
  },
  {
    title: "Tarefas",
    url: "/tarefas",
    icon: ListTodo,
  },
  {
    title: "Inbox",
    url: "/inbox",
    icon: Inbox,
  },
  {
    title: "Veículos",
    url: "/vehicles",
    icon: Car,
  },
  {
    title: "Follow-ups",
    url: "/follow-ups",
    icon: CalendarClock,
  },
  {
    title: "Relatórios",
    url: "/reports", 
    icon: BarChart3,
  },
  {
    title: "Disparos",
    url: "/broadcasts",
    icon: Radio,
  },
];

const adminItems = [
  {
    title: "Pipelines",
    url: "/pipelines",
    icon: Cog,
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Debug Automações",
    url: "/admin/debug/automations",
    icon: Bug,
  },
  {
    title: "Diagnóstico",
    url: "/admin/diagnostico",
    icon: Stethoscope,
  },
];

const followupChildren = [
  { title: "Templates", url: "/settings?tab=templates", icon: MessageSquare },
  { title: "Cadências", url: "/settings?tab=cadences", icon: PlayCircle },
];

export function CRMSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { settings: orgSettings } = useOrgSettings();
  const currentPath = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab');

  const isFollowupActive = currentPath === '/settings' && (currentTab === 'templates' || currentTab === 'cadences');
  const [followupOpen, setFollowupOpen] = React.useState(isFollowupActive);

  React.useEffect(() => {
    if (isFollowupActive) setFollowupOpen(true);
  }, [isFollowupActive]);

  const isActive = (path: string) => currentPath === path;
  const getNavClass = (active: boolean) =>
    active 
      ? "bg-primary text-primary-foreground font-medium" 
      : "hover:bg-accent hover:text-accent-foreground";

  const filteredNavItems = useMemo(() => {
    return navigationItems.filter(item => {
      if (item.url === '/inbox' && !orgSettings.inbox_enabled) return false;
      return true;
    });
  }, [orgSettings.inbox_enabled]);

  return (
    <Sidebar collapsible="icon">
      <div className="p-4 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 authority-gradient rounded-lg flex items-center justify-center">
            <Car className="h-4 w-4 text-white" />
          </div>
          {open && (
            <div>
              <h2 className="font-poppins font-bold text-lg text-foreground">AutoLead</h2>
              <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
            </div>
          )}
        </div>
      </div>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-poppins font-medium text-muted-foreground">
            {open && "NAVEGAÇÃO"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${getNavClass(isActive(item.url))}`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {open && (
                        <span className="font-poppins font-medium">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-poppins font-medium text-muted-foreground">
              {open && "ADMINISTRAÇÃO"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${getNavClass(isActive(item.url))}`}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {open && (
                          <span className="font-poppins font-medium">{item.title}</span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Follow-up collapsible group */}
                <SidebarMenuItem>
                  <button
                    onClick={() => setFollowupOpen(!followupOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                      isFollowupActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <MailCheck className="h-5 w-5 flex-shrink-0" />
                      {open && <span className="font-poppins font-medium">Follow-up</span>}
                    </div>
                    {open && (
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${followupOpen ? "rotate-180" : ""}`} />
                    )}
                  </button>
                </SidebarMenuItem>

                {followupOpen && open && followupChildren.map((child) => (
                  <SidebarMenuItem key={child.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={child.url}
                        className={`flex items-center space-x-3 px-3 py-1.5 ml-4 pl-3 border-l-2 border-border rounded-lg transition-all duration-200 ${
                          currentTab === child.url.split('tab=')[1]
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <child.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="font-poppins font-medium text-sm">{child.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {open && (
          <div className="mt-auto p-4">
            <div className="card-gradient rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                <span className="text-sm font-poppins font-medium">Novo Lead</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Cadastre rapidamente um novo lead
              </p>
              <button className="btn-gradient w-full text-white text-sm font-poppins font-medium py-2 rounded-lg">
                Adicionar Lead
              </button>
            </div>
          </div>
        )}
      </SidebarContent>

      <div className="p-2">
        <SidebarTrigger />
      </div>
    </Sidebar>
  );
}