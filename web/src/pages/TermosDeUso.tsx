import LegalLayout from "../components/legal/LegalLayout";

export default function TermosDeUso() {
  return (
    <LegalLayout title="Termos de Uso" updated="[data de publicação]">
      <h2>1. Sobre este documento</h2>
      <p>
        Estes Termos de Uso ("Termos") regem o acesso e o uso da plataforma Triad CRM ("Plataforma", "Serviço"),
        operada por Triad Company [razão social completa], inscrita no CNPJ sob o nº [CNPJ] ("Triad", "nós").
        Ao criar uma conta ou usar a Plataforma, você ("Usuário", "Cliente") concorda com estes Termos. Se você
        está aceitando em nome de uma empresa, declara ter poderes para vinculá-la.
      </p>

      <h2>2. O que é o Triad CRM</h2>
      <p>
        O Triad CRM é uma plataforma de gestão de leads e relacionamento com clientes que oferece, entre outras
        funcionalidades: funil de vendas (kanban), inbox unificado de WhatsApp, automações de atendimento e
        cobrança de follow-up, respostas assistidas por inteligência artificial, disparo de mensagens em massa via
        WhatsApp e integração com Meta Ads (incluindo envio de eventos de conversão via API de Conversões).
      </p>

      <h2>3. Cadastro e conta</h2>
      <ul>
        <li>Para usar a Plataforma, você deve fornecer informações verdadeiras, completas e atualizadas.</li>
        <li>Você é responsável por manter a confidencialidade de suas credenciais e por toda atividade realizada em sua conta.</li>
        <li>Cada organização cadastrada pode convidar usuários adicionais, com papéis de administrador ou vendedor e diferentes níveis de permissão.</li>
      </ul>

      <h2>4. Planos, cobrança e cancelamento</h2>
      <ul>
        <li>O acesso é oferecido por meio de planos de assinatura pagos (mensais ou semestrais), conforme descrito na página de Planos.</li>
        <li>As cobranças são processadas por um provedor de pagamento terceirizado (Stripe). Ao assinar, você autoriza a cobrança recorrente do valor do plano escolhido.</li>
        <li>A assinatura renova automaticamente ao fim de cada ciclo, salvo cancelamento prévio.</li>
        <li>Você pode cancelar a qualquer momento pelo painel de configurações. O cancelamento produz efeito ao final do ciclo de cobrança vigente; não há reembolso proporcional de período já pago, salvo disposição legal em contrário.</li>
        <li>Podemos oferecer período de teste gratuito, sujeito às condições informadas no momento da contratação.</li>
      </ul>

      <h2>5. Propriedade dos dados inseridos pelo Cliente</h2>
      <p>
        Todos os dados que você insere ou coleta por meio da Plataforma — leads, contatos, conversas e negócios —
        são de sua propriedade. A Triad atua apenas como operadora desses dados, tratando-os para viabilizar o
        Serviço, conforme detalhado na nossa <a href="/privacidade">Política de Privacidade</a>. Ao encerrar sua
        conta, você pode solicitar a exportação dos seus dados dentro do prazo informado antes da exclusão
        definitiva.
      </p>

      <h2>6. Integração com WhatsApp — aviso importante</h2>
      <p>
        A conexão com o WhatsApp disponibilizada pela Plataforma utiliza tecnologia de automação não vinculada à
        API oficial WhatsApp Business (Cloud API/BSP). Essa forma de conexão está sujeita às políticas de uso do
        WhatsApp/Meta, que podem, a critério deles, suspender ou banir números utilizados de forma automatizada —
        especialmente em caso de alto volume de disparos ou denúncias de destinatários.
      </p>
      <p>
        A Triad não garante disponibilidade contínua da conexão com o WhatsApp e não se responsabiliza por
        bloqueios, suspensões ou banimentos de números realizados pelo WhatsApp/Meta, nem por eventuais prejuízos
        decorrentes disso. Recomendamos uso responsável das funcionalidades de disparo em massa, respeitando
        boas práticas de opt-in e evitando volumes que caracterizem spam.
      </p>

      <h2>7. Uso aceitável</h2>
      <p>Você concorda em não utilizar a Plataforma para:</p>
      <ul>
        <li>Enviar spam ou comunicações não solicitadas em violação à legislação aplicável;</li>
        <li>Armazenar ou transmitir conteúdo ilegal, difamatório ou que viole direitos de terceiros;</li>
        <li>Tentar acessar áreas não autorizadas do sistema, fazer engenharia reversa ou comprometer a segurança da Plataforma;</li>
        <li>Revender ou sublicenciar o acesso à Plataforma sem autorização prévia por escrito.</li>
      </ul>

      <h2>8. Disponibilidade do serviço</h2>
      <p>
        Envidamos esforços razoáveis para manter a Plataforma disponível de forma contínua, mas não garantimos
        operação ininterrupta ou livre de erros. Podem ocorrer interrupções para manutenção, atualizações ou por
        fatores fora do nosso controle, incluindo indisponibilidade de provedores terceiros integrados (WhatsApp,
        Meta Ads, provedores de IA, gateway de pagamento e infraestrutura de nuvem).
      </p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        Na máxima extensão permitida pela lei, a Triad não será responsável por danos indiretos, lucros cessantes,
        perda de dados ou de negócios decorrentes do uso ou da impossibilidade de uso da Plataforma, incluindo os
        decorrentes de indisponibilidade de serviços de terceiros integrados.
      </p>

      <h2>10. Propriedade intelectual</h2>
      <p>
        O software, a marca, o layout e demais elementos da Plataforma são de propriedade da Triad ou de seus
        licenciadores, sendo vedada a reprodução, cópia ou uso não autorizado.
      </p>

      <h2>11. Rescisão</h2>
      <p>
        Podemos suspender ou encerrar o acesso de contas que violem estes Termos, mediante notificação prévia,
        exceto em casos de violação grave, em que a suspensão poderá ser imediata.
      </p>

      <h2>12. Alterações destes Termos</h2>
      <p>
        Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas por e-mail ou por
        aviso na Plataforma, com antecedência razoável.
      </p>

      <h2>13. Legislação aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de
        [cidade/UF], com renúncia a qualquer outro, por mais privilegiado que seja.
      </p>

      <h2>14. Contato</h2>
      <p>Dúvidas sobre estes Termos podem ser enviadas para [e-mail de contato].</p>
    </LegalLayout>
  );
}
