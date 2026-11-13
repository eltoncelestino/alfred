# Guia de Contribuição (Contributing)

Obrigado pelo interesse em contribuir com o projeto **Alfred**! Este documento descreve os padrões arquiteturais e o fluxo de trabalho adotados no repositório.

---

## 1. Diretrizes Arquiteturais

O Alfred utiliza **Clean Architecture** combinada com **Feature-Based Architecture**:

- **`src/core/`**: Configurações globais, constantes, tokens de Design System e tratamento de erros (`AppError`, `ErrorBoundary`).
- **`src/domain/`**: Entidades (`Message`, `EmailAccount`, `AgendaEvent`), prompts da persona e Casos de Uso puros (`AnalyzeWakeWordUseCase`, `EvaluateMorningTriggerUseCase`, `BuildContextBriefingUseCase`, `ProcessAssistantDirectivesUseCase`). **Não importe bibliotecas de UI nesta camada.**
- **`src/infrastructure/`**: Gateways de IA (`GeminiGateway`), cliente HTTP com timeout (`httpClient`), repositórios de persistência (`EmailConfigRepository`, `AgendaRepository`, `MorningRoutineStateRepository`), motores de voz (`NeuralTtsEngine`, `VoiceSynthesisService`) e serviços externos (`WeatherService`, `NewsService`, `EmailService`).
- **`src/features/`**: Componentes visuais memoizados (`React.memo`) e Custom Hooks organizados por domínio funcional (`briefing`, `conversation`, `email`, `voice`).

---

## 2. Regras de Segurança antes do Commit

1. **Jamais** adicione chaves de API reais, Senhas de App do Google, tokens OAuth ou endereços IP internos no código-fonte.
2. Utilize sempre o arquivo `.env.local` (ignorado pelo Git) para suas chaves locais.
3. Execute a suíte de validação e testes antes de abrir um Pull Request:

```bash
npm test
```

---

## 3. Padrão de Commits (Conventional Commits)

Utilize mensagens semânticas:

- `feat:` para novas funcionalidades.
- `fix:` para correções de bugs.
- `refactor:` para melhorias arquiteturais sem mudança de comportamento externo.
- `docs:` para alterações exclusivas na documentação.
- `test:` para adição ou ajuste de testes automatizados.

