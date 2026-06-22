import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ResetPassword agora redireciona para a página de autenticação.
 * O Clerk gerencia a redefinição de senha internamente.
 */
export function ResetPassword() {
  const navigate = useNavigate();

  useEffect(() => {
    // O Clerk gerencia redefinição de senha internamente
    navigate('/auth', { replace: true });
  }, [navigate]);

  return null;
}
