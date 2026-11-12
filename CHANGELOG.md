# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

## [1.0.0] - 2026-11-12

### Adicionado
- **Arquitetura Limpa e Modular (`Clean + Feature-Based Architecture`):** Separação completa em camadas `core`, `domain`, `infrastructure`, `features`, `components`, `screens` e `utils` seguindo os princípios **SOLID**.
- **Gatilho Inteligente de Rotina Matinal Pós-Alarme:** Suporte coordenado ao alarme padrão do iPhone e ao aplicativo **Alarmy** (aguarda conclusão da missão de despertar, ignora soneca e deduplica alarmes em sequência no mesmo dia).
- **Sistema de Voz Hands-Free (Wake-Word `"Alfred"`):** Escuta em standby com detecção de atividade de voz (VAD), tolerância fonética e janela armada de comando.
- **Voz Neural Masculina Natural (`pt-BR-AntonioNeural`):** Síntese neural consistente via middleware Metro (`/alfred-tts`) e WebSocket TLS direto no dispositivo, com cache em memória e fallback masculino (`Charon` / `expo-speech`).
- **Agenda Pessoal com Detecção de Conflitos:** Consulta em ordem cronológica, criação de compromissos com validação de título/data/horário, detecção automática de colisão de horários com sugestão do próximo horário livre e confirmação explícita antes de salvar.
- **Integração Multi-Estratégia de E-mail (`Strategy Pattern`):** Leitura real de remetente e assunto via Gmail IMAP Bridge (`server/imap-helper.js`), Gmail REST API (OAuth 2.0) ou Webhook JSON.
- **Meteorologia e Notícias em Tempo Real:** Integração com GPS (`expo-location`), Open-Meteo, BigDataCloud Reverse Geocoding e feeds RSS do Google News Brasil / G1.
- **Suíte de Testes Automatizados e Documentação Completa:** Testes de casos de uso e validação de árvore sintática (`npm test`), recursos visuais em `docs/images/` e auditoria de segurança.
