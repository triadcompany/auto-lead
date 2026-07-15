import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// CSS escopado sob .triad-lp — a página original era um HTML autocontido
// (com seletores globais tipo body/html/*), mas aqui roda dentro de uma SPA
// com outras rotas, então todo seletor precisa estar sob o wrapper .triad-lp
// para não vazar estilo pro resto do app.
const CSS = `
.triad-lp{
  --bg:#0C0A09;
  --surface:#171412;
  --surface-2:#1F1B18;
  --line:#2B2622;
  --ember:#FF6B2C;
  --ember-soft:rgba(255,107,44,.12);
  --ember-line:rgba(255,107,44,.35);
  --text:#FAF7F4;
  --muted:#A69C93;
  --green:#4ADE80;
  --red:#F87171;
  --radius:14px;
  --display:'Bricolage Grotesque',sans-serif;
  --body:'Inter',sans-serif;
  background:var(--bg);color:var(--text);font-family:var(--body);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;
}
.triad-lp *{margin:0;padding:0;box-sizing:border-box}
.triad-lp img{max-width:100%}
.triad-lp a{color:inherit;text-decoration:none}
.triad-lp .wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.triad-lp section{padding:96px 0}

.triad-lp h1,.triad-lp h2,.triad-lp h3{font-family:var(--display);line-height:1.08;letter-spacing:-.02em}
.triad-lp h2{font-size:clamp(1.9rem,4vw,2.75rem);font-weight:700}
.triad-lp .lead{color:var(--muted);font-size:1.06rem;max-width:560px}
.triad-lp .center{text-align:center}
.triad-lp .center .lead{margin:16px auto 0}

/* ---------- NAV ---------- */
.triad-lp nav{position:sticky;top:0;z-index:50;background:rgba(12,10,9,.82);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.triad-lp .nav-inner{display:flex;align-items:center;justify-content:space-between;height:68px}
.triad-lp .logo{font-family:var(--display);font-weight:800;font-size:1.25rem;display:flex;align-items:center;gap:9px}
.triad-lp .logo-mark{width:28px;height:28px;border-radius:8px;background:var(--ember);display:grid;place-items:center;font-size:.9rem;color:#0C0A09}
.triad-lp .logo-img{width:32px;height:32px;object-fit:contain}
.triad-lp .nav-links{display:flex;gap:28px;font-size:.92rem;color:var(--muted)}
.triad-lp .nav-links a:hover{color:var(--text)}
.triad-lp .nav-cta{display:flex;gap:12px;align-items:center}
.triad-lp .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:.95rem;padding:12px 24px;border-radius:10px;border:1px solid transparent;cursor:pointer;transition:transform .15s ease,background .15s ease,border-color .15s ease;font-family:var(--body)}
.triad-lp .btn:active{transform:scale(.97)}
.triad-lp .btn-primary{background:var(--ember);color:#140A04}
.triad-lp .btn-primary:hover{background:#FF8049}
.triad-lp .btn-ghost{border-color:var(--line);color:var(--text)}
.triad-lp .btn-ghost:hover{border-color:var(--ember-line)}
.triad-lp .btn-lg{padding:15px 30px;font-size:1.02rem}

/* ---------- HERO ---------- */
.triad-lp .hero{padding:110px 0 80px;position:relative}
.triad-lp .hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 60% 45% at 50% -5%,rgba(255,107,44,.14),transparent 70%);pointer-events:none;opacity:0;animation:tlpGlowIn 1.6s ease forwards}
.triad-lp .hero-grid{position:relative;text-align:center;max-width:820px;margin:0 auto}
.triad-lp .hero h1{font-size:clamp(2.6rem,6.4vw,4.4rem);font-weight:800}
.triad-lp .hero h1 .flip{color:var(--ember)}
.triad-lp .hero .lead{margin:24px auto 0;max-width:640px;font-size:1.15rem}
.triad-lp .hero-ctas{margin-top:36px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.triad-lp .hero-notes{margin-top:20px;display:flex;gap:22px;justify-content:center;flex-wrap:wrap;font-size:.85rem;color:var(--muted)}
.triad-lp .hero-notes span::before{content:"✓";color:var(--green);margin-right:6px;font-weight:700}

@keyframes tlpGlowIn{to{opacity:1}}
@keyframes tlpHeroUp{from{opacity:0;transform:translateY(16px);filter:blur(8px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
.triad-lp .hero-grid h1 .line{display:inline-block;opacity:0;transform:translateY(18px);filter:blur(8px);animation:tlpHeroUp 1.15s cubic-bezier(.22,1,.36,1) forwards}
.triad-lp .hero-grid h1 .line.l1{animation-delay:.28s}
.triad-lp .hero-grid h1 .line.l2{animation-delay:.48s}
.triad-lp .hero-grid .lead{opacity:0;animation:tlpHeroUp 1.1s cubic-bezier(.22,1,.36,1) forwards;animation-delay:.72s}
.triad-lp .hero-grid .hero-ctas{opacity:0;animation:tlpHeroUp 1.1s cubic-bezier(.22,1,.36,1) forwards;animation-delay:.92s}
.triad-lp .hero-grid .hero-notes{opacity:0;animation:tlpHeroUp 1s cubic-bezier(.22,1,.36,1) forwards;animation-delay:1.08s}

.triad-lp .pipeline{margin:72px auto 0;max-width:960px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:28px;position:relative;overflow:hidden}
.triad-lp .hero-pipeline{opacity:0;transform:perspective(1400px) rotateX(5deg) translateY(34px) scale(.97);filter:blur(6px);transform-origin:center top;animation:tlpPipelineIn 1.4s cubic-bezier(.22,1,.36,1) forwards;animation-delay:1.25s}
@keyframes tlpPipelineIn{to{opacity:1;transform:perspective(1400px) rotateX(0deg) translateY(0) scale(1);filter:blur(0)}}
.triad-lp .pipeline-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;font-size:.82rem;color:var(--muted)}
.triad-lp .pipeline-head .dot-row{display:flex;gap:6px}
.triad-lp .pipeline-head .dot-row i{width:9px;height:9px;border-radius:50%;background:var(--line)}
.triad-lp .stages{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.triad-lp .stage{background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:14px;min-height:180px}
.triad-lp .stage h4{font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;display:flex;justify-content:space-between}
.triad-lp .stage h4 em{font-style:normal;color:var(--text)}
.triad-lp .card{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:.8rem;margin-bottom:8px;display:flex;align-items:center;gap:8px;animation:tlpPop .5s ease both}
.triad-lp .card .avatar{width:22px;height:22px;border-radius:50%;background:var(--ember-soft);border:1px solid var(--ember-line);display:grid;place-items:center;font-size:.6rem;color:var(--ember);font-weight:700;flex-shrink:0}
.triad-lp .card.won{border-color:rgba(74,222,128,.4)}
.triad-lp .card.won::after{content:"R$";margin-left:auto;color:var(--green);font-weight:700;font-size:.72rem}
.triad-lp .card.hot::after{content:"🔥";margin-left:auto;font-size:.72rem}
@keyframes tlpPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.triad-lp .meta-badge{position:absolute;right:24px;bottom:20px;background:var(--bg);border:1px solid var(--ember-line);border-radius:999px;padding:8px 16px;font-size:.78rem;color:var(--muted);display:flex;align-items:center;gap:8px}
.triad-lp .meta-badge b{color:var(--ember)}
.triad-lp .meta-badge .pulse{width:8px;height:8px;border-radius:50%;background:var(--green);animation:tlpPulse 1.6s infinite}
@keyframes tlpPulse{0%,100%{opacity:1}50%{opacity:.3}}

/* ---------- DORES ---------- */
.triad-lp .dores{background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.triad-lp .dores-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:48px}
.triad-lp .dor{background:var(--bg);border:1px solid var(--line);border-left:3px solid var(--red);border-radius:var(--radius);padding:26px 28px;font-size:1.02rem;color:var(--text)}
.triad-lp .dor q{quotes:"“" "”";font-style:italic}
.triad-lp .dor small{display:block;margin-top:10px;color:var(--muted);font-size:.8rem;font-style:normal}

/* ---------- SOLUÇÃO (scrollytelling) ---------- */
.triad-lp .story-grid{display:flex;gap:64px;align-items:flex-start;margin-top:56px}
.triad-lp .story-steps{flex:1.05;position:relative;padding-left:44px}
.triad-lp .story-rail{position:absolute;left:5px;top:8px;bottom:8px;width:2px;background:var(--line);border-radius:2px}
.triad-lp .story-rail-fill{position:absolute;left:5px;top:8px;width:2px;background:var(--ember);height:0;border-radius:2px;transition:height .35s ease}
.triad-lp .step{position:relative;padding:140px 0;opacity:.35;filter:saturate(.7);transition:opacity .4s ease,filter .4s ease;min-height:52vh;display:flex;flex-direction:column;justify-content:center}
.triad-lp .step:first-child{padding-top:20px}
.triad-lp .step.active{opacity:1;filter:saturate(1)}
.triad-lp .step .dot{position:absolute;left:-44px;top:50%;transform:translateY(-50%);width:12px;height:12px;border-radius:50%;background:var(--surface);border:2px solid var(--line);transition:all .3s ease}
.triad-lp .step:first-child .dot{top:34px}
.triad-lp .step.active .dot{border-color:var(--ember);background:var(--ember);box-shadow:0 0 0 6px var(--ember-soft)}
.triad-lp .step .tag{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ember);margin-bottom:10px}
.triad-lp .step h3{font-size:1.5rem;font-weight:700;margin-bottom:10px}
.triad-lp .step p{color:var(--muted);font-size:1rem;max-width:400px}

.triad-lp .story-visual{flex:1;position:sticky;top:calc(50vh - 250px);height:500px}
.triad-lp .visual-frame{position:relative;width:100%;height:100%;background:var(--surface);border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:0 40px 70px -30px rgba(0,0,0,.6)}
.triad-lp .visual-frame::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 85% 12%,rgba(255,107,44,.10),transparent 55%);pointer-events:none}
.triad-lp .mockup{position:absolute;inset:0;padding:32px;opacity:0;transform:scale(.94) translateY(14px);transition:opacity .5s cubic-bezier(.2,.7,.3,1),transform .5s cubic-bezier(.2,.7,.3,1);pointer-events:none;display:flex;flex-direction:column}
.triad-lp .mockup.active{opacity:1;transform:scale(1) translateY(0);pointer-events:auto}

.triad-lp .chat-mock .chat-head{display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--muted);font-weight:600;padding-bottom:16px;border-bottom:1px solid var(--line)}
.triad-lp .chat-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px rgba(74,222,128,.18)}
.triad-lp .chat-body{flex:1;display:flex;flex-direction:column;gap:10px;justify-content:flex-end;padding-top:18px}
.triad-lp .bubble{max-width:80%;padding:12px 16px;border-radius:15px;font-size:.87rem;line-height:1.45}
.triad-lp .bubble.in{align-self:flex-start;background:var(--surface-2);border:1px solid var(--line);border-bottom-left-radius:4px}
.triad-lp .bubble.ai{align-self:flex-end;background:var(--ember);color:#140A04;border-bottom-right-radius:4px;font-weight:500}
.triad-lp .ai-tag{display:inline-block;background:rgba(0,0,0,.2);font-size:.6rem;font-weight:800;padding:2px 7px;border-radius:5px;margin-right:6px;letter-spacing:.05em;vertical-align:1px}
.triad-lp .typing{align-self:flex-start;display:flex;gap:4px;padding:11px 15px;background:var(--surface-2);border:1px solid var(--line);border-radius:14px;border-bottom-left-radius:4px;width:fit-content}
.triad-lp .typing span{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:tlpBlink 1.3s infinite}
.triad-lp .typing span:nth-child(2){animation-delay:.2s}
.triad-lp .typing span:nth-child(3){animation-delay:.4s}
@keyframes tlpBlink{0%,60%,100%{opacity:.25}30%{opacity:1}}

.triad-lp .kanban-mock .km-head{font-size:.82rem;color:var(--muted);font-weight:600;margin-bottom:20px}
.triad-lp .km-cols{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;position:relative}
.triad-lp .km-col{background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px}
.triad-lp .km-col h5{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:10px}
.triad-lp .km-card{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-size:.78rem}
.triad-lp .km-flying{position:absolute;top:34px;background:var(--bg);border:1px solid var(--ember-line);border-radius:8px;padding:9px 10px;font-size:.78rem;box-shadow:0 10px 24px rgba(0,0,0,.45);animation:tlpFlyCard 3.4s ease-in-out infinite}
@keyframes tlpFlyCard{0%,6%{left:2%;opacity:0}14%,44%{left:2%;opacity:1}56%,86%{left:36%;opacity:1}94%,100%{left:36%;opacity:0}}

.triad-lp .followup-mock{gap:16px}
.triad-lp .fu-toast{display:flex;align-items:center;gap:12px;background:var(--surface-2);border:1px solid var(--ember-line);border-radius:12px;padding:14px 16px;animation:tlpToastIn .5s ease both}
.triad-lp .fu-toast .fu-ico{font-size:1.2rem}
.triad-lp .fu-toast strong{display:block;font-size:.88rem}
.triad-lp .fu-toast small{color:var(--muted);font-size:.78rem}
@keyframes tlpToastIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
.triad-lp .fu-list{display:flex;flex-direction:column;gap:9px;margin-top:auto}
.triad-lp .fu-item{display:flex;align-items:center;gap:10px;font-size:.85rem;padding:11px 14px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);color:var(--muted)}
.triad-lp .fu-item .chk{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center;font-size:.65rem;flex-shrink:0}
.triad-lp .fu-item.done{opacity:.6;text-decoration:line-through}
.triad-lp .fu-item.done .chk{background:var(--green);border-color:var(--green);color:#0C0A09}
.triad-lp .fu-item.pending{color:var(--text);border-color:var(--ember-line)}
.triad-lp .fu-item.pending .chk{border-color:var(--ember);animation:tlpRingPulse 1.4s infinite}
@keyframes tlpRingPulse{0%,100%{box-shadow:0 0 0 0 var(--ember-soft)}50%{box-shadow:0 0 0 5px var(--ember-soft)}}

.triad-lp .meta-mock{justify-content:center;gap:22px}
.triad-lp .meta-stats{display:flex;align-items:center;gap:18px}
.triad-lp .meta-stats>div{display:flex;flex-direction:column;gap:4px}
.triad-lp .meta-stats span{font-size:.74rem;color:var(--muted)}
.triad-lp .meta-stats strong{font-family:var(--display);font-size:1.6rem}
.triad-lp .meta-stats strong.good{color:var(--green)}
.triad-lp .meta-stats .arrow{color:var(--ember);font-size:1.2rem}
.triad-lp .meta-chart{width:100%;height:120px}
.triad-lp .meta-chart polyline{fill:none;stroke:var(--ember);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:420;stroke-dashoffset:420;animation:tlpDraw 1.8s ease forwards}
@keyframes tlpDraw{to{stroke-dashoffset:0}}

.triad-lp .rank-mock{justify-content:center;gap:22px}
.triad-lp .rank-row{display:flex;align-items:center;gap:14px}
.triad-lp .rank-row>span{width:96px;font-size:.85rem;flex-shrink:0}
.triad-lp .rank-row .bar{flex:1;height:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:999px;overflow:hidden}
.triad-lp .rank-row .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ember),#FFA06A);border-radius:999px;animation:tlpGrow 1.4s ease forwards;animation-delay:.15s}
@keyframes tlpGrow{to{width:var(--w)}}

.triad-lp .flow-mock{justify-content:center;align-items:center;gap:0}
.triad-lp .flow-node{background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:13px 20px;font-size:.88rem;font-weight:600;text-align:center;width:220px}
.triad-lp .flow-line{height:34px;width:2px;background:var(--line);position:relative}
.triad-lp .flow-line .pulse-dot{position:absolute;left:-3px;top:0;width:8px;height:8px;border-radius:50%;background:var(--ember);animation:tlpFlowDot 1.6s linear infinite}
@keyframes tlpFlowDot{0%{top:0;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:100%;opacity:0}}

@media (max-width:880px){
  .triad-lp .story-grid{flex-direction:column;gap:8px}
  .triad-lp .story-visual{order:-1;position:sticky;top:64px;transform:none;height:340px;width:100%;margin-bottom:28px;flex:none}
  .triad-lp .story-steps{padding-left:36px;order:2}
  .triad-lp .step .dot{left:-36px}
}

/* ---------- PARA QUEM ---------- */
.triad-lp .quem-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:48px}
.triad-lp .quem{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:26px;text-align:center}
.triad-lp .quem .ico{font-size:1.6rem;margin-bottom:14px}
.triad-lp .quem h3{font-size:1rem;font-weight:700;margin-bottom:6px}
.triad-lp .quem p{color:var(--muted);font-size:.86rem}

/* ---------- DIFERENCIAIS ---------- */
.triad-lp .dif{background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.triad-lp .dif-list{margin-top:48px;display:flex;flex-direction:column}
.triad-lp .dif-item{display:grid;grid-template-columns:64px 1fr 1.2fr;gap:24px;align-items:baseline;padding:26px 8px;border-bottom:1px solid var(--line)}
.triad-lp .dif-item:last-child{border-bottom:none}
.triad-lp .dif-item .n{font-family:var(--display);font-weight:800;font-size:1.5rem;color:var(--ember)}
.triad-lp .dif-item h3{font-size:1.18rem;font-weight:700}
.triad-lp .dif-item p{color:var(--muted);font-size:.95rem}
.triad-lp .dif-item:nth-child(1){transition-delay:0s}
.triad-lp .dif-item:nth-child(2){transition-delay:.1s}
.triad-lp .dif-item:nth-child(3){transition-delay:.2s}
.triad-lp .dif-item:nth-child(4){transition-delay:.3s}
.triad-lp .dif-item:nth-child(5){transition-delay:.4s}

/* ---------- SEGURANÇA ---------- */
.triad-lp .seg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:48px}
.triad-lp .seg{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:26px}
.triad-lp .seg .ico{font-size:1.3rem;margin-bottom:14px}
.triad-lp .seg h3{font-size:.98rem;font-weight:700;margin-bottom:6px}
.triad-lp .seg p{color:var(--muted);font-size:.85rem}

/* ---------- PLANOS ---------- */
.triad-lp .planos{position:relative}
.triad-lp .planos::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 50% 40% at 50% 20%,rgba(255,107,44,.08),transparent 70%);pointer-events:none}
.triad-lp .billing{display:flex;justify-content:center;gap:8px;margin-top:32px}
.triad-lp .billing button{background:var(--surface);border:1px solid var(--line);color:var(--muted);padding:9px 20px;border-radius:999px;font-size:.85rem;font-weight:600;cursor:pointer;font-family:var(--body)}
.triad-lp .billing button.on{background:var(--ember-soft);border-color:var(--ember-line);color:var(--ember)}
.triad-lp .billing button b{color:var(--green);font-size:.72rem;margin-left:5px}
.triad-lp .planos-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:44px;max-width:880px;margin-left:auto;margin-right:auto;position:relative}
.triad-lp .plano{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:36px}
.triad-lp .plano.rec{border-color:var(--ember-line);background:linear-gradient(170deg,var(--ember-soft),var(--surface) 45%);position:relative}
.triad-lp .plano.rec .badge{position:absolute;top:-13px;right:26px;background:var(--ember);color:#140A04;font-size:.72rem;font-weight:700;padding:5px 14px;border-radius:999px;letter-spacing:.04em}
.triad-lp .plano h3{font-size:1.35rem;font-weight:800}
.triad-lp .plano .pos{color:var(--muted);font-size:.9rem;margin:6px 0 22px;min-height:44px}
.triad-lp .preco{font-family:var(--display);font-size:2.6rem;font-weight:800;letter-spacing:-.02em}
.triad-lp .preco small{font-size:.95rem;color:var(--muted);font-weight:500;font-family:var(--body)}
.triad-lp .preco-nota{font-size:.78rem;color:var(--muted);margin-top:2px}
.triad-lp .plano .btn{width:100%;margin:24px 0 26px}
.triad-lp .plano ul{list-style:none;font-size:.9rem;display:flex;flex-direction:column;gap:10px}
.triad-lp .plano ul li::before{content:"✓";color:var(--green);font-weight:700;margin-right:9px}
.triad-lp .plano ul li.no{color:var(--muted)}
.triad-lp .plano ul li.no::before{content:"✕";color:var(--red);opacity:.7}
.triad-lp .plano ul .grupo{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:8px}
.triad-lp .plano ul .grupo::before{content:none}
.triad-lp .planos-nota{text-align:center;color:var(--muted);font-size:.85rem;margin-top:32px}

/* ---------- FAQ ---------- */
.triad-lp .faq-list{max-width:720px;margin:48px auto 0}
.triad-lp details{border:1px solid var(--line);border-radius:12px;background:var(--surface);margin-bottom:12px;overflow:hidden}
.triad-lp summary{cursor:pointer;padding:20px 24px;font-weight:600;font-size:.98rem;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px}
.triad-lp summary::-webkit-details-marker{display:none}
.triad-lp summary::after{content:"+";font-family:var(--display);font-size:1.3rem;color:var(--ember);transition:transform .2s ease;flex-shrink:0}
.triad-lp details[open] summary::after{transform:rotate(45deg)}
.triad-lp details .faq-body{padding:0 24px 20px;color:var(--muted);font-size:.92rem}

/* ---------- CTA FINAL ---------- */
.triad-lp .cta-final{text-align:center;padding:120px 0;position:relative}
.triad-lp .cta-final::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 55% 55% at 50% 60%,rgba(255,107,44,.13),transparent 70%);pointer-events:none}
.triad-lp .cta-final h2{font-size:clamp(2rem,5vw,3.2rem);max-width:760px;margin:0 auto}
.triad-lp .cta-final .lead{margin:20px auto 0}
.triad-lp .cta-final .btn{margin-top:36px}
.triad-lp .cta-final small{display:block;margin-top:16px;color:var(--muted);font-size:.84rem}

/* ---------- FOOTER ---------- */
.triad-lp footer{border-top:1px solid var(--line);padding:56px 0 40px;background:var(--surface)}
.triad-lp .foot-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:40px}
.triad-lp .foot-grid p{color:var(--muted);font-size:.88rem;max-width:280px;margin-top:12px}
.triad-lp .foot-col h4{font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:16px}
.triad-lp .foot-col a{display:block;font-size:.9rem;color:var(--muted);margin-bottom:10px}
.triad-lp .foot-col a:hover{color:var(--text)}
.triad-lp .foot-base{display:flex;justify-content:space-between;align-items:center;margin-top:48px;padding-top:24px;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted);flex-wrap:wrap;gap:12px}
.triad-lp .foot-base .links{display:flex;gap:20px}

/* reveal on scroll */
.triad-lp .reveal{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}
.triad-lp .reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){
  .triad-lp .reveal{opacity:1;transform:none;transition:none}
  .triad-lp .card{animation:none}
  .triad-lp .pulse{animation:none}
  .triad-lp .hero::before{animation:none;opacity:1}
  .triad-lp .hero-grid h1 .line,.triad-lp .hero-grid .lead,.triad-lp .hero-grid .hero-ctas,.triad-lp .hero-grid .hero-notes{animation:none;opacity:1;transform:none}
  .triad-lp .hero-pipeline{animation:none;opacity:1;transform:none}
}

/* ---------- RESPONSIVO ---------- */
@media (max-width:920px){
  .triad-lp .sol-grid{grid-template-columns:repeat(2,1fr)}
  .triad-lp .quem-grid,.triad-lp .seg-grid{grid-template-columns:repeat(2,1fr)}
  .triad-lp .stages{grid-template-columns:repeat(2,1fr)}
  .triad-lp .dif-item{grid-template-columns:48px 1fr;gap:8px 18px}
  .triad-lp .dif-item p{grid-column:2}
  .triad-lp .foot-grid{grid-template-columns:1fr 1fr}
}
@media (max-width:640px){
  .triad-lp section{padding:72px 0}
  .triad-lp .nav-links{display:none}
  .triad-lp .dores-grid,.triad-lp .sol-grid,.triad-lp .planos-grid{grid-template-columns:1fr}
  .triad-lp .quem-grid,.triad-lp .seg-grid{grid-template-columns:1fr}
  .triad-lp .hero{padding:72px 0 56px}
  .triad-lp .foot-grid{grid-template-columns:1fr}
  .triad-lp .meta-badge{position:static;margin-top:18px;justify-content:center}
}
`;

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prevTitle = document.title;
    document.title = "Triad CRM — Todo lead ignorado vira venda do concorrente";

    // overflow-x:hidden vai no <body>, não num wrapper interno — em qualquer
    // ancestral que não seja o scroller real, essa propriedade quebra
    // position:sticky nos elementos filhos (ex.: o card animado da seção Solução).
    const prevOverflowX = document.body.style.overflowX;
    document.body.style.overflowX = "hidden";

    // ── reveal on scroll ──────────────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    // ── scrollytelling da seção "solução" ────────────────────────────────
    const steps = [...root.querySelectorAll<HTMLElement>("#storySteps .step")];
    const mockups = [...root.querySelectorAll<HTMLElement>(".mockup")];
    const railFill = root.querySelector<HTMLElement>("#railFill");
    const rail = root.querySelector<HTMLElement>(".story-rail");
    let scrollTicking = false;

    function activateStep(i: number) {
      steps.forEach((s, idx) => s.classList.toggle("active", idx === i));
      mockups.forEach((m, idx) => m.classList.toggle("active", idx === i));
      if (rail && railFill && steps[i]) {
        const dot = steps[i].querySelector(".dot");
        if (dot) {
          const railRect = rail.getBoundingClientRect();
          const dotRect = dot.getBoundingClientRect();
          const h = Math.max(0, dotRect.top + dotRect.height / 2 - railRect.top);
          railFill.style.height = h + "px";
        }
      }
    }

    function updateActiveStep() {
      const target = window.innerHeight / 2;
      let closestIdx = 0;
      let closestDist = Infinity;
      steps.forEach((s, idx) => {
        const r = s.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const dist = Math.abs(center - target);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });
      activateStep(closestIdx);
      scrollTicking = false;
    }
    function onScroll() {
      if (!scrollTicking) {
        requestAnimationFrame(updateActiveStep);
        scrollTicking = true;
      }
    }
    if (steps.length) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      updateActiveStep();
    }

    // ── pipeline vivo (assinatura visual do hero) ────────────────────────
    const nomes = ["MC", "JP", "AL", "RS", "BF", "TK", "LV", "GD", "PH", "CN"];
    const stagesEl = [...root.querySelectorAll<HTMLElement>("#stages .stage")];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function makeCard(name: string, cls?: string) {
      const d = document.createElement("div");
      d.className = "card" + (cls ? " " + cls : "");
      d.innerHTML = `<span class="avatar">${name}</span><span>Lead ${name}</span>`;
      return d;
    }
    function seed() {
      const dist: [number, string][] = [
        [3, ""],
        [2, "hot"],
        [2, ""],
        [2, "won"],
      ];
      let idx = 0;
      stagesEl.forEach((st, i) => {
        const box = st.querySelector(".cards");
        if (!box) return;
        box.innerHTML = "";
        const [n, cls] = dist[i];
        for (let k = 0; k < n; k++) {
          const card = makeCard(nomes[(i * 3 + k) % nomes.length], k === 0 ? cls : "");
          card.style.animationDelay = idx * 80 + "ms";
          idx++;
          box.appendChild(card);
        }
        const count = st.querySelector("[data-count]");
        if (count) count.textContent = String(n);
      });
    }

    let pipelineInterval: ReturnType<typeof setInterval> | undefined;
    let pipelineTimeout: ReturnType<typeof setTimeout> | undefined;
    if (stagesEl.length) {
      pipelineTimeout = setTimeout(
        () => {
          seed();
          if (!reduced) {
            let t = 0;
            pipelineInterval = setInterval(() => {
              t++;
              const from = stagesEl[t % 3];
              const to = stagesEl[(t % 3) + 1];
              const card = from?.querySelector(".card");
              if (card && to) {
                card.remove();
                const nc = makeCard(
                  nomes[Math.floor(Math.random() * nomes.length)],
                  (t % 3) + 1 === 3 ? "won" : ""
                );
                to.querySelector(".cards")?.prepend(nc);
              }
              if (t % 2 === 0) {
                const nc = makeCard(nomes[Math.floor(Math.random() * nomes.length)], "");
                const box0 = stagesEl[0]?.querySelector(".cards");
                box0?.prepend(nc);
                const cards0 = stagesEl[0]?.querySelectorAll(".card") || [];
                if (cards0.length > 4) cards0[cards0.length - 1].remove();
              }
              stagesEl.forEach((st) => {
                const cards = st.querySelectorAll(".card");
                if (cards.length > 4) cards[cards.length - 1].remove();
                const count = st.querySelector("[data-count]");
                if (count) count.textContent = String(st.querySelectorAll(".card").length);
              });
            }, 2600);
          }
        },
        reduced ? 0 : 2050
      );
    }

    // ── toggle de cobrança (mensal/semestral) ────────────────────────────
    const billingButtons = [...root.querySelectorAll<HTMLButtonElement>(".billing button")];
    function handleBillingClick(this: HTMLButtonElement) {
      billingButtons.forEach((b) => b.classList.remove("on"));
      this.classList.add("on");
      const c = this.dataset.cycle as string;
      root!.querySelectorAll<HTMLElement>("[data-price]").forEach((p) => {
        p.textContent = p.dataset[c] || p.textContent;
      });
      root!.querySelectorAll<HTMLElement>("[data-nota]").forEach((n) => {
        n.textContent = n.dataset[c] || n.textContent;
      });
    }
    billingButtons.forEach((btn) => btn.addEventListener("click", handleBillingClick));

    return () => {
      document.title = prevTitle;
      document.body.style.overflowX = prevOverflowX;
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (pipelineInterval) clearInterval(pipelineInterval);
      if (pipelineTimeout) clearTimeout(pipelineTimeout);
      billingButtons.forEach((btn) => btn.removeEventListener("click", handleBillingClick));
    };
  }, []);

  const goToSignup = () => navigate("/auth?signup=true");
  const goToLogin = () => navigate("/auth");

  return (
    <div className="triad-lp" ref={rootRef}>
      <style>{CSS}</style>

      <nav>
        <div className="wrap nav-inner">
          <a className="logo" href="#top">
            <img src="/triad-crm-logo.png" alt="Triad CRM" className="logo-img" />Triad CRM
          </a>
          <div className="nav-links">
            <a href="#solucao">Solução</a>
            <a href="#diferenciais">Diferenciais</a>
            <a href="#planos">Planos</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-cta">
            <a className="btn btn-ghost" href="#" onClick={(e) => { e.preventDefault(); goToLogin(); }}>Entrar</a>
            <a className="btn btn-primary" href="#" onClick={(e) => { e.preventDefault(); goToSignup(); }}>Testar grátis</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero" id="top">
        <div className="wrap">
          <div className="hero-grid">
            <h1>
              <span className="line l1">Seu WhatsApp lota.</span>
              <br />
              <span className="flip line l2">Seu rival agradece.</span>
            </h1>
            <p className="lead">
              Lead sem resposta vira venda de outro lugar. Automatize do seu jeito e deixe sua Meta Ads aprender quem compra.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary btn-lg" href="#" onClick={(e) => { e.preventDefault(); goToSignup(); }}>
                Organizar meus leads grátis
              </a>
              <a className="btn btn-ghost btn-lg" href="#solucao">Ver como funciona</a>
            </div>
            <div className="hero-notes">
              <span>Teste grátis</span>
              <span>Sem cartão de crédito</span>
              <span>Pronto em minutos</span>
            </div>
          </div>

          <div className="pipeline hero-pipeline">
            <div className="pipeline-head">
              <div className="dot-row"><i></i><i></i><i></i></div>
              <span>Funil de vendas · tempo real</span>
            </div>
            <div className="stages" id="stages">
              <div className="stage"><h4>Novo lead <em data-count>4</em></h4><div className="cards"></div></div>
              <div className="stage"><h4>Em conversa <em data-count>3</em></h4><div className="cards"></div></div>
              <div className="stage"><h4>Proposta <em data-count>2</em></h4><div className="cards"></div></div>
              <div className="stage"><h4>Ganho <em data-count>2</em></h4><div className="cards"></div></div>
            </div>
            <div className="meta-badge"><span className="pulse"></span>Venda enviada pra <b>Meta Ads</b> — campanha otimizando</div>
          </div>
        </div>
      </header>

      {/* DORES */}
      <section className="dores">
        <div className="wrap">
          <div className="center reveal">
            <h2>Se você já pensou alguma dessas frases,<br />o Triad foi feito pra você</h2>
          </div>
          <div className="dores-grid">
            <div className="dor reveal"><q>O lead chamou no WhatsApp de madrugada. Quando o vendedor viu, ele já tinha comprado em outro lugar.</q><small>, Velocidade de resposta</small></div>
            <div className="dor reveal"><q>Eu pergunto como estão as negociações e cada vendedor responde uma coisa. Ninguém sabe o número real.</q><small>, Visibilidade do time</small></div>
            <div className="dor reveal"><q>Combinamos de retornar em 3 dias. Ninguém retornou. Ninguém nem lembrava.</q><small>, Follow-ups perdidos</small></div>
            <div className="dor reveal"><q>Gasto milhares em anúncio todo mês e não faço ideia de qual campanha traz cliente que compra.</q><small>, Dinheiro no escuro</small></div>
          </div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section id="solucao">
        <div className="wrap">
          <div className="center reveal">
            <h2>Do clique no anúncio ao fechamento:<br />cada lead com dono, prazo e próximo passo</h2>
          </div>

          <div className="story-grid">
            <div className="story-steps" id="storySteps">
              <div className="story-rail"></div>
              <div className="story-rail-fill" id="railFill"></div>

              <div className="step active" data-step="0">
                <div className="dot"></div>
                <h3>Nenhum lead sem resposta</h3>
                <p>Todos os leads do WhatsApp caem num inbox único. A IA responde na hora, mesmo às 2h da manhã.</p>
              </div>
              <div className="step" data-step="1">
                <div className="dot"></div>
                <h3>Veja onde cada venda travou</h3>
                <p>Funil kanban visual: arraste o lead de etapa em etapa e enxergue o pipeline inteiro em segundos.</p>
              </div>
              <div className="step" data-step="2">
                <div className="dot"></div>
                <h3>Follow-up cobrado automaticamente</h3>
                <p>O sistema agenda e lembra cada retorno. Esquecer deixa de ser opção.</p>
              </div>
              <div className="step" data-step="3">
                <div className="dot"></div>
                <span className="tag">Ponto forte</span>
                <h3>Sua Meta aprende quem compra</h3>
                <p>Enviamos os dados de venda pra Meta Ads. Suas campanhas passam a buscar compradores, não curiosos.</p>
              </div>
              <div className="step" data-step="4">
                <div className="dot"></div>
                <h3>Saiba quem vende e quem enrola</h3>
                <p>Performance de cada vendedor em tempo real: leads atendidos, tempo de resposta, conversão.</p>
              </div>
              <div className="step" data-step="5">
                <div className="dot"></div>
                <h3>Venda no automático</h3>
                <p>Automações movem leads, disparam mensagens e distribuem contatos pro time sem você tocar em nada.</p>
              </div>
            </div>

            <div className="story-visual">
              <div className="visual-frame">
                <div className="mockup chat-mock active" data-mock="0">
                  <div className="chat-head"><span className="chat-dot"></span>WhatsApp · Inbox</div>
                  <div className="chat-body">
                    <div className="bubble in">Oi! Vi o anúncio, ainda tá disponível?</div>
                    <div className="bubble ai"><span className="ai-tag">IA</span>Sim! Temos 2 unidades. Posso te passar as condições agora?</div>
                    <div className="typing"><span></span><span></span><span></span></div>
                  </div>
                </div>

                <div className="mockup kanban-mock" data-mock="1">
                  <div className="km-head">Funil de vendas</div>
                  <div className="km-cols">
                    <div className="km-col"><h5>Novo</h5></div>
                    <div className="km-col"><h5>Conversa</h5><div className="km-card">Julia P.</div></div>
                    <div className="km-col"><h5>Proposta</h5><div className="km-card">Marcos C.</div></div>
                    <div className="km-flying">Ana L.</div>
                  </div>
                </div>

                <div className="mockup followup-mock" data-mock="2">
                  <div className="fu-toast">
                    <span className="fu-ico">⏰</span>
                    <div><strong>Retornar para Ana Paula</strong><small>Hoje, 15:00</small></div>
                  </div>
                  <div className="fu-list">
                    <div className="fu-item done"><span className="chk">✓</span>Follow-up · Marcos</div>
                    <div className="fu-item done"><span className="chk">✓</span>Follow-up · Julia</div>
                    <div className="fu-item pending"><span className="chk"></span>Follow-up · Ana Paula</div>
                  </div>
                </div>

                <div className="mockup meta-mock" data-mock="3">
                  <div className="meta-stats">
                    <div><span>CPL antes</span><strong>R$42</strong></div>
                    <div className="arrow">→</div>
                    <div><span>CPL agora</span><strong className="good">R$18</strong></div>
                  </div>
                  <svg className="meta-chart" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <polyline points="0,85 50,75 100,80 150,55 200,45 250,25 300,12" />
                  </svg>
                </div>

                <div className="mockup rank-mock" data-mock="4">
                  <div className="rank-row"><span>🥇 Marcos</span><div className="bar"><i style={{ ["--w" as any]: "92%" }}></i></div></div>
                  <div className="rank-row"><span>🥈 Julia</span><div className="bar"><i style={{ ["--w" as any]: "68%" }}></i></div></div>
                  <div className="rank-row"><span>🥉 Pedro</span><div className="bar"><i style={{ ["--w" as any]: "41%" }}></i></div></div>
                </div>

                <div className="mockup flow-mock" data-mock="5">
                  <div className="flow-node">Lead entra</div>
                  <div className="flow-line"><span className="pulse-dot"></span></div>
                  <div className="flow-node">Mensagem enviada</div>
                  <div className="flow-line"><span className="pulse-dot" style={{ animationDelay: ".8s" }}></span></div>
                  <div className="flow-node">Tarefa criada</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PARA QUEM */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="center reveal">
            <h2>Feito pra quem vende de verdade</h2>
          </div>
          <div className="quem-grid">
            <div className="quem reveal"><div className="ico">👥</div><h3>Times de 2 a 15 vendedores</h3><p>Que precisam de processo claro sem sistema complicado.</p></div>
            <div className="quem reveal"><div className="ico">🎯</div><h3>Quem anuncia na Meta</h3><p>E quer que cada real investido traga leads mais qualificados que o anterior.</p></div>
            <div className="quem reveal"><div className="ico">📱</div><h3>Quem vende pelo WhatsApp</h3><p>Onde o cliente chama a qualquer hora e não pode esperar.</p></div>
            <div className="quem reveal"><div className="ico">🏢</div><h3>Grupos com várias unidades</h3><p>Que precisam ver tudo num painel só, sem trocar de conta.</p></div>
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="dif" id="diferenciais">
        <div className="wrap">
          <div className="center reveal">
            <h2>O que o Triad faz que os outros não fazem</h2>
          </div>
          <div className="dif-list">
            <div className="dif-item reveal"><span className="n">01</span><h3>Rodando hoje, não mês que vem</h3><p>Abre no navegador, sem instalação. Implementação em minutos.</p></div>
            <div className="dif-item reveal"><span className="n">02</span><h3>WhatsApp dentro do CRM</h3><p>Seu time atende e atualiza o funil na mesma tela.</p></div>
            <div className="dif-item reveal"><span className="n">03</span><h3>IA que atende primeiro</h3><p>Resposta imediata enquanto seu vendedor está com outro cliente.</p></div>
            <div className="dif-item reveal"><span className="n">04</span><h3>Meta Ads integrado</h3><p>Coisa que a maioria dos CRMs do seu concorrente não faz.</p></div>
            <div className="dif-item reveal"><span className="n">05</span><h3>Multiempresa de verdade</h3><p>Várias unidades, permissões separadas, visão unificada.</p></div>
          </div>
        </div>
      </section>

      {/* SEGURANÇA */}
      <section>
        <div className="wrap">
          <div className="center reveal">
            <h2>Seus leads são seu ativo mais caro.<br />Aqui, eles ficam trancados.</h2>
          </div>
          <div className="seg-grid">
            <div className="seg reveal"><div className="ico">🔒</div><h3>Criptografia de ponta a ponta</h3><p>Seus dados e conversas protegidos em todo o trajeto.</p></div>
            <div className="seg reveal"><div className="ico">🗝️</div><h3>Cada um vê só o que deve</h3><p>Permissões por usuário: vendedor não acessa dado de gestor.</p></div>
            <div className="seg reveal"><div className="ico">🛡️</div><h3>Login em duas etapas</h3><p>Senha vazada não vira conta invadida.</p></div>
            <div className="seg reveal"><div className="ico">☁️</div><h3>99,9% no ar</h3><p>Infraestrutura que não te deixa na mão no meio da venda.</p></div>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section className="planos" id="planos">
        <div className="wrap">
          <div className="center reveal">
            <h2>O plano se paga com um lead<br />que você deixaria escapar</h2>
            <p className="lead">Comece organizando o funil. Escale quando quiser IA, automação ilimitada e campanhas mais baratas.</p>
          </div>

          <div className="billing reveal">
            <button className="on" data-cycle="mensal">Mensal</button>
            <button data-cycle="semestral">Semestral <b>−20%</b></button>
          </div>

          <div className="planos-grid">
            <div className="plano reveal">
              <h3>Start</h3>
              <p className="pos">Pra quem quer parar de perder leads e ter o funil sob controle.</p>
              <div className="preco"><span data-price data-mensal="R$157" data-semestral="R$126">R$157</span><small>/mês</small></div>
              <p className="preco-nota" data-nota data-mensal="cobrado mensalmente" data-semestral="R$756 a cada 6 meses">cobrado mensalmente</p>
              <a className="btn btn-ghost" href="#" onClick={(e) => { e.preventDefault(); goToSignup(); }}>Começar agora</a>
              <ul>
                <li className="grupo">O que está incluído</li>
                <li>Gestão de leads (kanban)</li>
                <li>2 pipelines de vendas</li>
                <li>WhatsApp conectado (inbox)</li>
                <li>Até 3 usuários</li>
                <li>2 automações ativas</li>
                <li>Follow-ups manuais</li>
                <li>Relatórios básicos</li>
                <li className="grupo">Não inclui</li>
                <li className="no">IA de atendimento</li>
                <li className="no">Disparo em massa</li>
                <li className="no">Meta Ads (CAPI + Lead Ads)</li>
              </ul>
            </div>

            <div className="plano rec reveal">
              <span className="badge">Recomendado</span>
              <h3>Scale ✦</h3>
              <p className="pos">Pra quem quer vender enquanto dorme: IA atendendo, automações rodando e a Meta otimizando sozinha.</p>
              <div className="preco"><span data-price data-mensal="R$317" data-semestral="R$254">R$317</span><small>/mês</small></div>
              <p className="preco-nota" data-nota data-mensal="cobrado mensalmente" data-semestral="R$1.524 a cada 6 meses">cobrado mensalmente</p>
              <a className="btn btn-primary" href="#" onClick={(e) => { e.preventDefault(); goToSignup(); }}>Começar agora →</a>
              <ul>
                <li className="grupo">O que está incluído</li>
                <li><strong>Tudo do plano Start</strong></li>
                <li>Pipelines ilimitados</li>
                <li>Usuários ilimitados</li>
                <li>Automações ilimitadas</li>
                <li>IA de atendimento</li>
                <li>Disparo em massa</li>
                <li>Meta Ads</li>
                <li>Relatórios avançados</li>
              </ul>
            </div>
          </div>
          <p className="planos-nota">Todos os planos incluem suporte por chat e atualizações gratuitas. Cancele quando quiser, sem burocracia.</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="center reveal">
            <h2>Perguntas frequentes</h2>
          </div>
          <div className="faq-list reveal">
            <details>
              <summary>Preciso instalar alguma coisa?</summary>
              <div className="faq-body">Não. O Triad roda direto no navegador, no computador ou no celular. Você cria a conta e já começa a usar — a implementação leva minutos, não semanas.</div>
            </details>
            <details>
              <summary>Como funciona a integração com o WhatsApp?</summary>
              <div className="faq-body">Você conecta seu número e todas as conversas caem num inbox único dentro do CRM. Seu time atende, atualiza o funil e agenda follow-ups na mesma tela — sem alternar entre apps.</div>
            </details>
            <details>
              <summary>O que exatamente o envio de dados pra Meta faz?</summary>
              <div className="faq-body">Quando um lead vira venda no Triad, enviamos esse evento pro Meta Ads. Com isso, o algoritmo aprende o perfil de quem realmente compra — e passa a otimizar suas campanhas pra encontrar mais compradores, baratando seu custo por lead qualificado.</div>
            </details>
            <details>
              <summary>Posso trocar de plano ou cancelar quando quiser?</summary>
              <div className="faq-body">Sim. Você pode fazer upgrade, downgrade ou cancelar a qualquer momento, direto no painel, sem multa e sem precisar falar com ninguém.</div>
            </details>
            <details>
              <summary>Meus dados ficam seguros?</summary>
              <div className="faq-body">Sim. Usamos criptografia de ponta a ponta, autenticação em duas etapas e permissões por usuário. Nossa infraestrutura opera com 99,9% de disponibilidade.</div>
            </details>
            <details>
              <summary>Funciona pra mais de uma empresa ou unidade?</summary>
              <div className="faq-body">Sim. O Triad é multiempresa: você gerencia várias unidades com permissões separadas e visão unificada, tudo na mesma conta.</div>
            </details>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="cta-final">
        <div className="wrap">
          <h2 className="reveal">Quantos leads você perdeu enquanto lia esta página?</h2>
          <p className="lead reveal">Crie sua conta grátis e coloque seu funil pra rodar ainda hoje.</p>
          <a className="btn btn-primary btn-lg reveal" href="#" onClick={(e) => { e.preventDefault(); goToSignup(); }}>Criar conta grátis →</a>
          <small className="reveal">Sem compromisso. Cancele quando quiser.</small>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <a className="logo" href="#top">
                <img src="/triad-crm-logo.png" alt="Triad CRM" className="logo-img" />Triad CRM
              </a>
              <p>O CRM que organiza seus leads do WhatsApp, cobra os follow-ups do time e devolve dados pra Meta otimizar suas campanhas.</p>
            </div>
            <div className="foot-col">
              <h4>Produto</h4>
              <a href="#solucao">Funcionalidades</a>
              <a href="#planos">Planos</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="foot-col">
              <h4>Empresa</h4>
              <a href="#">Sobre</a>
              <a href="#">Contato</a>
              <a href="#">Blog</a>
            </div>
          </div>
          <div className="foot-base">
            <span>© 2026 Triad Company. Todos os direitos reservados.</span>
            <div className="links">
              <a href="#">Privacidade</a>
              <a href="#">Termos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
