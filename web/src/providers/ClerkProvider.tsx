import { ClerkProvider as BaseClerkProvider } from '@clerk/clerk-react';
import { ReactNode, createContext, useContext } from 'react';
import { ptBR } from '@clerk/localizations';

// Clerk publishable key - this is a PUBLIC key, safe to include in code
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Z3JhdGVmdWwtcGVsaWNhbi04OC5jbGVyay5hY2NvdW50cy5kZXYk';

// Context to check if Clerk is available
const ClerkAvailableContext = createContext<boolean>(false);

export function useClerkAvailable() {
  return useContext(ClerkAvailableContext);
}

interface ClerkProviderProps {
  children: ReactNode;
}

export function ClerkProvider({ children }: ClerkProviderProps) {
  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn('⚠️ VITE_CLERK_PUBLISHABLE_KEY is not set. Clerk authentication will not work.');
    return (
      <ClerkAvailableContext.Provider value={false}>
        {children}
      </ClerkAvailableContext.Provider>
    );
  }

  return (
    <ClerkAvailableContext.Provider value={true}>
      <BaseClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        localization={ptBR}
        appearance={{
          variables: {
            colorPrimary: 'hsl(24, 95%, 53%)',
            colorBackground: 'hsl(0, 0%, 100%)',
            colorText: 'hsl(0, 0%, 22%)',
            colorInputBackground: 'hsl(0, 0%, 100%)',
            colorInputText: 'hsl(0, 0%, 22%)',
            borderRadius: '0.75rem',
            fontFamily: 'Poppins, sans-serif',
          },
          elements: {
            formButtonPrimary: 
              'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-poppins',
            card: 'bg-card border border-border shadow-xl',
            headerTitle: 'font-poppins font-bold text-foreground',
            headerSubtitle: 'font-poppins text-muted-foreground',
            socialButtonsBlockButton: 'border-border hover:bg-accent',
            formFieldLabel: 'font-poppins text-foreground',
            formFieldInput: 'font-poppins bg-input border-border text-foreground',
            footerActionLink: 'text-primary hover:text-primary/80',
            identityPreview: 'bg-muted border-border',
            identityPreviewText: 'text-foreground',
            identityPreviewEditButton: 'text-primary',
          },
        }}
      >
        {children}
      </BaseClerkProvider>
    </ClerkAvailableContext.Provider>
  );
}
