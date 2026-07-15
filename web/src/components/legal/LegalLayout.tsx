import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";

// CSS escopado sob .triad-legal, mesmo padrão usado na LandingPage: a página
// roda dentro da SPA (não é HTML autocontido), então nenhum seletor pode vazar
// pro resto do app.
const CSS = `
.triad-legal{
  --bg:#0C0A09;
  --surface:#171412;
  --line:#2B2622;
  --ember:#FF6B2C;
  --ember-line:rgba(255,107,44,.35);
  --text:#FAF7F4;
  --muted:#A69C93;
  --display:'Bricolage Grotesque',sans-serif;
  --body:'Inter',sans-serif;
  background:var(--bg);color:var(--text);font-family:var(--body);font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;min-height:100vh;
}
.triad-legal *{box-sizing:border-box}
.triad-legal a{color:var(--ember)}
.triad-legal a:hover{text-decoration:underline}
.triad-legal .wrap{max-width:760px;margin:0 auto;padding:0 24px}

.triad-legal nav{position:sticky;top:0;z-index:50;background:rgba(12,10,9,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.triad-legal .nav-inner{max-width:1120px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:64px}
.triad-legal .logo{font-family:var(--display);font-weight:800;font-size:1.1rem;display:flex;align-items:center;gap:9px;color:var(--text)}
.triad-legal .logo:hover{text-decoration:none}
.triad-legal .logo-img{width:28px;height:28px;object-fit:contain}
.triad-legal .back-link{font-size:.9rem;color:var(--muted)}

.triad-legal main{padding:64px 0 96px}
.triad-legal h1{font-family:var(--display);font-size:clamp(1.9rem,4.5vw,2.5rem);font-weight:800;letter-spacing:-.02em;line-height:1.15;margin-bottom:8px}
.triad-legal .updated{color:var(--muted);font-size:.9rem;margin-bottom:40px}
.triad-legal .disclaimer{background:rgba(255,107,44,.08);border:1px solid var(--ember-line);border-radius:12px;padding:16px 20px;font-size:.92rem;color:var(--muted);margin-bottom:48px}
.triad-legal .disclaimer strong{color:var(--text)}

.triad-legal article h2{font-family:var(--display);font-size:1.3rem;font-weight:700;letter-spacing:-.01em;margin:40px 0 12px}
.triad-legal article h2:first-child{margin-top:0}
.triad-legal article p{color:var(--muted);margin-bottom:14px}
.triad-legal article ul{color:var(--muted);margin:0 0 14px 20px}
.triad-legal article li{margin-bottom:6px}
.triad-legal article strong{color:var(--text)}

.triad-legal footer{border-top:1px solid var(--line);padding:32px 0;text-align:center;color:var(--muted);font-size:.88rem}
.triad-legal footer a{margin:0 8px}
`;

export default function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${title} — Triad CRM`;
    return () => {
      document.title = prevTitle;
    };
  }, [title]);

  return (
    <div className="triad-legal">
      <style>{CSS}</style>
      <nav>
        <div className="nav-inner">
          <Link className="logo" to="/landing">
            <img src="/triad-crm-logo.png" alt="Triad CRM" className="logo-img" />Triad CRM
          </Link>
          <Link className="back-link" to="/landing">← Voltar ao site</Link>
        </div>
      </nav>
      <main>
        <div className="wrap">
          <h1>{title}</h1>
          <p className="updated">Última atualização: {updated}</p>
          <div className="disclaimer">
            <strong>Aviso:</strong> este é um documento em elaboração, disponibilizado de boa-fé para dar transparência sobre como o Triad CRM funciona. Alguns dados de identificação da empresa ainda estão sendo formalizados e serão atualizados aqui assim que confirmados.
          </div>
          <article>{children}</article>
        </div>
      </main>
      <footer>
        <span>© 2026 Triad Company.</span>
        <Link to="/termos">Termos de Uso</Link>
        <Link to="/privacidade">Política de Privacidade</Link>
      </footer>
    </div>
  );
}
