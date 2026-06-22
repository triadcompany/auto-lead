import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * SellerAuth agora redireciona para a página principal de autenticação.
 * Com o Clerk, não há necessidade de uma página separada para vendedores.
 */
export function SellerAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona para a página de autenticação principal
    navigate('/auth', { replace: true });
  }, [navigate]);

  return null;
}
