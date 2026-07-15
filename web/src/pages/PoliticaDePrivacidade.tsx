import LegalLayout from "../components/legal/LegalLayout";

export default function PoliticaDePrivacidade() {
  return (
    <LegalLayout title="Política de Privacidade" updated="[data de publicação]">
      <h2>1. Introdução</h2>
      <p>
        Esta Política de Privacidade descreve como a Triad Company [razão social completa], CNPJ [CNPJ]
        ("Triad", "nós"), trata dados pessoais no âmbito da plataforma Triad CRM, em conformidade com a Lei Geral
        de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2>2. Quando somos controladores e quando somos operadores</h2>
      <p>
        <strong>Como controladora:</strong> somos controladores dos dados pessoais dos usuários que criam contas
        na Plataforma (nome, e-mail, telefone, dados da empresa), usados para viabilizar cadastro, autenticação,
        cobrança e comunicação sobre o Serviço.
      </p>
      <p>
        <strong>Como operadora:</strong> quando você (Cliente) usa a Plataforma para gerenciar leads, contatos e
        conversas de WhatsApp de terceiros, a Triad atua como operadora desses dados, tratando-os exclusivamente
        conforme suas instruções, para viabilizar as funcionalidades do CRM. Nesse caso, você é o controlador
        desses dados e é responsável por garantir base legal adequada para a coleta e o tratamento junto aos seus
        próprios leads e clientes.
      </p>

      <h2>3. Dados que coletamos</h2>
      <ul>
        <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, nome da empresa e, quando informado, CNPJ.</li>
        <li><strong>Dados de uso:</strong> informações sobre como você utiliza a Plataforma, para fins de suporte, segurança e melhoria do Serviço.</li>
        <li><strong>Dados processados em nome do Cliente:</strong> nomes, telefones, e-mails, mensagens de WhatsApp e demais informações de leads e contatos inseridas ou capturadas por meio da Plataforma.</li>
        <li><strong>Dados de pagamento:</strong> processados diretamente pelo provedor de pagamento (Stripe); a Triad não armazena dados completos de cartão de crédito.</li>
      </ul>

      <h2>4. Finalidade do tratamento</h2>
      <p>Utilizamos os dados para:</p>
      <ul>
        <li>Viabilizar o funcionamento da Plataforma (inbox de WhatsApp, funil de vendas, automações, IA de atendimento);</li>
        <li>Processar pagamentos e emitir cobranças;</li>
        <li>Enviar comunicações operacionais (confirmação de cadastro, cobrança, avisos de segurança);</li>
        <li>Enviar eventos de conversão ao Meta Ads quando você habilitar essa integração;</li>
        <li>Oferecer suporte técnico;</li>
        <li>Cumprir obrigações legais e regulatórias.</li>
      </ul>

      <h2>5. Compartilhamento de dados com terceiros</h2>
      <p>Podemos compartilhar dados com prestadores de serviço que nos auxiliam a operar a Plataforma, incluindo:</p>
      <ul>
        <li>Clerk — autenticação e gerenciamento de usuários;</li>
        <li>Stripe — processamento de pagamentos;</li>
        <li>Provedores de infraestrutura em nuvem — hospedagem e banco de dados;</li>
        <li>Evolution API / provedores de conexão com WhatsApp — envio e recebimento de mensagens;</li>
        <li>Meta Platforms, Inc. (Meta Ads / API de Conversões) — quando você habilitar essa integração, para envio de eventos de conversão;</li>
        <li>Provedores de inteligência artificial — para geração de respostas automáticas quando essa funcionalidade estiver habilitada.</li>
      </ul>
      <p>
        Esses terceiros têm acesso aos dados apenas na medida necessária para a prestação de seus serviços, e não
        estão autorizados a utilizá-los para outras finalidades.
      </p>

      <h2>6. Retenção e exclusão</h2>
      <p>
        Mantemos os dados pelo tempo necessário para cumprir as finalidades descritas nesta Política ou pelo
        prazo exigido por lei. Ao encerrar sua conta, seus dados poderão ser excluídos ou anonimizados após o
        prazo de retenção aplicável, ressalvadas obrigações legais de guarda.
      </p>

      <h2>7. Segurança da informação</h2>
      <p>
        Adotamos medidas técnicas e organizacionais para proteger dados pessoais, incluindo criptografia em
        trânsito, autenticação multifator, controle de acesso por perfil de usuário e monitoramento de
        disponibilidade da infraestrutura.
      </p>

      <h2>8. Seus direitos como titular de dados</h2>
      <p>Nos termos da LGPD, você pode solicitar:</p>
      <ul>
        <li>Confirmação da existência de tratamento;</li>
        <li>Acesso aos dados;</li>
        <li>Correção de dados incompletos ou desatualizados;</li>
        <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>Portabilidade a outro fornecedor;</li>
        <li>Informação sobre com quem compartilhamos seus dados;</li>
        <li>Revogação do consentimento, quando aplicável.</li>
      </ul>
      <p>Para exercer esses direitos, entre em contato pelo canal indicado no item 10.</p>

      <h2>9. Cookies</h2>
      <p>
        Utilizamos cookies e tecnologias similares para manter sua sessão ativa, lembrar preferências e entender
        o uso da Plataforma. Você pode gerenciar cookies nas configurações do seu navegador.
      </p>

      <h2>10. Encarregado de Dados (DPO) e contato</h2>
      <p>
        Para exercer seus direitos ou esclarecer dúvidas sobre esta Política, entre em contato com nosso
        Encarregado de Proteção de Dados pelo e-mail [e-mail do DPO].
      </p>

      <h2>11. Alterações desta Política</h2>
      <p>
        Esta Política pode ser atualizada periodicamente. A versão vigente estará sempre disponível nesta página,
        com a data da última atualização.
      </p>
    </LegalLayout>
  );
}
