import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface MobileHeaderProps {
  title: string;
  onSearch?: () => void;
}

export function MobileHeader({ title, onSearch }: MobileHeaderProps) {
  return (
    <header className="md:hidden sticky top-0 z-40 bg-background border-b border-border h-14 px-4 flex items-center justify-between safe-area-inset-top">
      <h1 className="text-lg font-semibold truncate flex-1">{title}</h1>
      <div className="flex items-center gap-2">
        {onSearch && (
          <Button variant="ghost" size="icon" onClick={onSearch} className="h-9 w-9">
            <Search className="h-4 w-4" />
          </Button>
        )}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Notificações</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma notificação no momento
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
