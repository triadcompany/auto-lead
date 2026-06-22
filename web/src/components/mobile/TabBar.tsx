import { Home, Kanban, Users, MessageSquare, Menu, CalendarClock, ListTodo } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileText, Settings, Share2, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCount } from "@/hooks/useUnreadCount";

const mainTabs = [
  { icon: Home, label: "Dashboard", path: "/dashboard" },
  { icon: Kanban, label: "Oportunidades", path: "/oportunidades" },
  { icon: Users, label: "Contatos", path: "/leads" },
  { icon: MessageSquare, label: "Mensagens", path: "/inbox" },
];

const moreItems = [
  { icon: ListTodo, label: "Tarefas", path: "/tarefas" },
  { icon: CalendarClock, label: "Follow-ups", path: "/follow-ups" },
  { icon: FileText, label: "Relatórios", path: "/reports" },
  { icon: Settings, label: "Configurações", path: "/settings" },
  { icon: Share2, label: "Distribuição de Leads", path: "/settings?tab=distribution" },
  { icon: HelpCircle, label: "Ajuda", path: "/ajuda" },
];

export function TabBar() {
  const location = useLocation();
  const { user } = useAuth();
  const unreadCount = useUnreadCount();

  const publicRoutes = ['/landing', '/auth', '/seller-auth'];
  if (publicRoutes.includes(location.pathname) || !user) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border h-14 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-full px-2">
        {mainTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 transition-colors relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <div className="relative">
              <tab.icon className="h-5 w-5 shrink-0" />
              {tab.path === "/inbox" && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium truncate">{tab.label}</span>
          </NavLink>
        ))}

        <Sheet>
          <SheetTrigger className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 text-muted-foreground hover:text-foreground transition-colors">
            <Menu className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-medium">Mais</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              {moreItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-base">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
