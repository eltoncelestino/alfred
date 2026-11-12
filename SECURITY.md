# Política de Segurança (Security Policy)

A segurança da informação e a privacidade dos dados pessoais (voz, localização, agenda e credenciais de e-mail) são prioridades absolutas no projeto **Alfred**.

---

## Práticas de Segurança Implementadas

1. **Isolamento de Segredos e Variáveis de Ambiente:**
   - Nenhuma chave de API (`EXPO_PUBLIC_GEMINI_KEY`), Senha de App IMAP, Token OAuth 2.0 ou endereço de e-mail pessoal é versionada no repositório.
   - Configurações locais residem exclusivamente em `.env.local` e `server/email-credentials.json`, ambos bloqueados por regras explícitas no [`.gitignore`](.gitignore).
2. **Proteção de Privacidade na Leitura de E-mails:**
   - O Alfred lista inicialmente apenas o **remetente** e o **assunto** dos e-mails mais importantes, aguardando confirmação explícita do usuário antes de ler o conteúdo completo ou caso o usuário sinalize que não está sozinho.
3. **Confirmação Explícita para Ações Sensíveis:**
   - Ações que envolvem terceiros ou alterações permanentes (salvar novos compromissos na agenda, enviar ou arquivar e-mails) exigem confirmação verbal explícita do usuário.
4. **Comunicação Criptografada:**
   - Todas as integrações externas utilizam conexões seguras TLS/HTTPS (`generativelanguage.googleapis.com`, `imap.gmail.com:993`, `speech.platform.bing.com:443`, `api.open-meteo.com`).

---

## Como Reportar uma Vulnerabilidade

Caso você identifique qualquer vulnerabilidade de segurança neste projeto:

1. **Não abra uma Issue pública** contendo detalhes de exploração ou credenciais.
2. Envie um relato detalhado diretamente ao autor (**Elton Celestino**) através do perfil oficial no GitHub: [@eltoncelestino](https://github.com/eltoncelestino).
3. Inclua os passos para reprodução, o componente afetado e o impacto estimado.
