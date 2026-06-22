import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** @deprecated Org name no longer renders in the page header. */
  showOrgName?: boolean;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-poppins font-bold text-primary">{title}</h1>
        {description && (
          <p className="text-muted-foreground font-poppins mt-1">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
