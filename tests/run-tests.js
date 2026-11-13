const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const babel = require('@babel/core');

// Mock leve do React Native e módulos Expo para avaliar StyleSheet.create e inicialização de todos os módulos
const mockMocks = {
  'react-native': {
    Platform: {
      OS: 'ios',
      select: (obj) => obj.ios ?? obj.default,
    },
    StyleSheet: {
      create: (styles) => styles,
    },
    NativeModules: {
      SourceCode: { scriptURL: 'http://localhost:8081/index.bundle' },
    },
    Linking: {
      addEventListener: () => ({ remove: () => {} }),
      getInitialURL: () => Promise.resolve(null),
    },
    View: 'View',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    FlatList: 'FlatList',
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    Modal: 'Modal',
    ActivityIndicator: 'ActivityIndicator',
    SafeAreaView: 'SafeAreaView',
    StatusBar: 'StatusBar',
  },
  'expo-audio': {
    AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: true }) },
    RecordingPresets: { HIGH_QUALITY: {} },
    setAudioModeAsync: async () => {},
    useAudioRecorder: () => ({}),
    createAudioPlayer: () => ({}),
  },
  'expo-file-system': {
    File: class {},
  },
  'expo-file-system/legacy': {
    documentDirectory: 'file:///docs/',
    cacheDirectory: 'file:///cache/',
    EncodingType: { Base64: 'base64' },
    getInfoAsync: async () => ({ exists: false }),
    readAsStringAsync: async () => '',
    writeAsStringAsync: async () => {},
    deleteAsync: async () => {},
  },
  'expo-location': {
    Accuracy: { Balanced: 3 },
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 } }),
  },
  'expo-speech': {
    stop: async () => {},
    speak: () => {},
    getAvailableVoicesAsync: async () => [],
  },
};

const moduleCache = new Map();

function loadEsModule(relPath) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (moduleCache.has(fullPath)) {
    return moduleCache.get(fullPath).exports;
  }

  const source = fs.readFileSync(fullPath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: fullPath,
    plugins: [
      require.resolve('@babel/plugin-transform-react-jsx', {
        paths: [process.cwd()],
      }),
      require.resolve('@babel/plugin-transform-modules-commonjs', {
        paths: [process.cwd()],
      }),
    ],
  });

  const mod = { exports: {} };
  moduleCache.set(fullPath, mod);

  const dir = path.dirname(fullPath);
  const customRequire = (spec) => {
    if (mockMocks[spec]) return mockMocks[spec];
    if (spec.startsWith('.')) {
      const candidate = path.resolve(dir, spec);
      let resolved = candidate;
      if (fs.existsSync(candidate + '.js')) {
        resolved = candidate + '.js';
      } else if (fs.existsSync(path.join(candidate, 'index.js'))) {
        resolved = path.join(candidate, 'index.js');
      }
      return loadEsModule(path.relative(path.resolve(__dirname, '..'), resolved));
    }
    return require(spec);
  };

  const fn = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    transformed.code
  );
  fn(mod.exports, customRequire, mod, fullPath, dir);
  return mod.exports;
}

console.log('====================================================');
console.log(' ALFRED — SUÍTE DE TESTES AUTOMATIZADOS E VALIDAÇÃO ');
console.log('====================================================\n');

let passed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✖ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Validação de AST, Imports e Execução em Runtime (StyleSheet.create / Tokens) de TODOS os módulos
runTest('Integridade de AST, Imports e Avaliação Runtime (StyleSheet/Tokens) em 100% dos módulos', () => {
  function walk(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results = results.concat(walk(full));
      else if (entry.name.endsWith('.js')) results.push(full);
    }
    return results;
  }

  const rootDir = path.resolve(__dirname, '..');
  const files = [
    path.resolve(rootDir, 'App.js'),
    ...walk(path.resolve(rootDir, 'src')),
  ];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
    for (const node of ast.program.body) {
      if (
        (node.type === 'ImportDeclaration' ||
          node.type === 'ExportNamedDeclaration' ||
          node.type === 'ExportAllDeclaration') &&
        node.source
      ) {
        const spec = node.source.value;
        if (spec.startsWith('.')) {
          const base = path.resolve(path.dirname(file), spec);
          const candidates = [base, base + '.js', path.join(base, 'index.js')];
          assert.ok(
            candidates.some((c) => fs.existsSync(c)),
            `Import relativo não encontrado: ${spec} em ${file}`
          );
        }
      }
    }
    // Executa o módulo para garantir que nenhum StyleSheet.create ou token lance TypeError em runtime
    loadEsModule(path.relative(rootDir, file));
  }
});

// 2. Testes de Domínio: Wake-Word ("Alfred") e Intenção Direta
const {
  analyzeWakeWordCall,
  detectDirectCommandIntent,
} = loadEsModule('src/domain/useCases/AnalyzeWakeWordUseCase.js');

runTest('Wake-Word: Reconhece chamado isolado "Alfred" e variações fonéticas', () => {
  const res1 = analyzeWakeWordCall('Alfred');
  assert.equal(res1.called, true);
  assert.equal(res1.command, '');

  const res2 = analyzeWakeWordCall('Ei Alfredo, quais são as notícias de hoje?');
  assert.equal(res2.called, true);
  assert.match(res2.command, /notícias de hoje/i);
});

runTest('Wake-Word: Ignora fala ambiente sem a palavra de ativação', () => {
  const res = analyzeWakeWordCall('Conversa paralela na sala de estar');
  assert.equal(res.called, false);
});

runTest('Intenção Direta: Identifica comandos explícitos de clima, e-mail e notícias', () => {
  assert.equal(detectDirectCommandIntent('Leia meus e-mails por favor'), true);
  assert.equal(detectDirectCommandIntent('Como está o clima agora?'), true);
});

// 3. Testes de Domínio: Gatilho da Rotina Matinal (Alarme do iPhone + Alarmy)
const { evaluateMorningAlarmTrigger } = loadEsModule(
  'src/domain/useCases/EvaluateMorningTriggerUseCase.js'
);
const { AgendaEventEntity } = loadEsModule('src/domain/entities/AgendaEvent.js');

runTest('Gatilho Matinal: Ignora modo soneca (snooze) sem iniciar rotina', () => {
  const decision = evaluateMorningAlarmTrigger({
    source: 'iphone_alarm',
    action: 'snoozed',
    morningState: { lastTriggeredDate: null },
  });
  assert.equal(decision.shouldStart, false);
  assert.equal(decision.reason, 'snoozed');
});

runTest('Gatilho Matinal: Aguarda conclusão da missão do Alarmy antes de falar', () => {
  const pending = evaluateMorningAlarmTrigger({
    source: 'alarmy',
    action: 'mission_in_progress',
    morningState: { lastTriggeredDate: null },
  });
  assert.equal(pending.shouldStart, false);
  assert.equal(pending.reason, 'alarmy_mission_pending');

  const completed = evaluateMorningAlarmTrigger({
    source: 'alarmy',
    action: 'mission_completed',
    morningState: { lastTriggeredDate: null },
  });
  assert.equal(completed.shouldStart, true);
  assert.equal(completed.isAlarmyMissionCompleted, true);
});

runTest('Gatilho Matinal: Deduplica alarmes em sequência no mesmo dia', () => {
  const today = AgendaEventEntity.getTodayIsoDate();
  const secondAlarm = evaluateMorningAlarmTrigger({
    source: 'iphone_alarm',
    action: 'dismissed',
    morningState: { lastTriggeredDate: today },
    forceManual: false,
  });
  assert.equal(secondAlarm.shouldStart, false);
  assert.equal(secondAlarm.reason, 'already_triggered_today');
});

// 4. Testes de Domínio: Agenda, Conflitos de Horário e Sugestão de Próximo Horário Livre
runTest('Agenda: Detecta colisão de horários e sugere próximo horário livre', () => {
  const existing = [
    AgendaEventEntity.create({
      title: 'Reunião com a equipe',
      date: '2026-11-12',
      time: '10:00',
      durationMinutes: 60,
    }),
  ];

  const candidate = {
    title: 'Alinhamento de projeto',
    date: '2026-11-12',
    time: '10:30',
    durationMinutes: 60,
  };

  const check = AgendaEventEntity.findConflict(existing, candidate);
  assert.equal(check.hasConflict, true);
  assert.equal(check.conflictingEvent.title, 'Reunião com a equipe');
  assert.equal(check.nextFreeTime, '11:00');
});

// 5. Testes de Domínio: Extração de Diretivas e Limpeza para Estilo de Voz
const { processAssistantDirectives } = loadEsModule(
  'src/domain/useCases/ProcessAssistantDirectivesUseCase.js'
);

runTest('Diretivas de Voz: Extrai tag AGENDA_SAVE e remove markdown da fala', () => {
  const raw =
    '**Confirmado!** Almoço com a Carla marcado para quinta às doze e meia. [[AGENDA_SAVE:{"title":"Almoço com a Carla","date":"2026-11-13","time":"12:30","durationMinutes":60}]]';
  const result = processAssistantDirectives(raw);
  assert.equal(
    result.spokenText,
    'Confirmado! Almoço com a Carla marcado para quinta às doze e meia.'
  );
  assert.equal(result.savedEvents.length, 1);
  assert.equal(result.savedEvents[0].title, 'Almoço com a Carla');
  assert.equal(result.savedEvents[0].time, '12:30');
});

runTest('Diretivas de Voz e YouTube: Extrai tag YOUTUBE_PLAY e reconhece intenção', () => {
  assert.equal(detectDirectCommandIntent('Toque jazz relaxante no YouTube'), true);
  const raw =
    'Abrindo jazz relaxante no YouTube agora, senhor. [[YOUTUBE_PLAY:{"query":"jazz relaxante"}]]';
  const result = processAssistantDirectives(raw);
  assert.equal(result.spokenText, 'Abrindo jazz relaxante no YouTube agora, senhor.');
  assert.equal(result.youtubeQueries.length, 1);
  assert.equal(result.youtubeQueries[0].query, 'jazz relaxante');
});

runTest('Diretivas de Voz e Agenda: Extrai tags AGENDA_REMOVE e AGENDA_UPDATE', () => {
  const rawRemove =
    'Pronto, removi o passeio matinal das dezoito horas. [[AGENDA_REMOVE:{"title":"Passeio matinal","date":"2026-11-13","time":"18:00"}]]';
  const resRemove = processAssistantDirectives(rawRemove);
  assert.equal(resRemove.spokenText, 'Pronto, removi o passeio matinal das dezoito horas.');
  assert.equal(resRemove.removedEvents.length, 1);
  assert.equal(resRemove.removedEvents[0].title, 'Passeio matinal');

  const rawUpdate =
    'Alterado para Cinema às dezoito horas. [[AGENDA_UPDATE:{"matchTitle":"Passeio matinal","matchDate":"2026-11-13","matchTime":"18:00","title":"Cinema","date":"2026-11-13","time":"18:00","durationMinutes":120}]]';
  const resUpdate = processAssistantDirectives(rawUpdate);
  assert.equal(resUpdate.spokenText, 'Alterado para Cinema às dezoito horas.');
  assert.equal(resUpdate.updatedEvents.length, 1);
  assert.equal(resUpdate.updatedEvents[0].matchTitle, 'Passeio matinal');
  assert.equal(resUpdate.updatedEvents[0].title, 'Cinema');
});

console.log(`\nResultado final: ${passed} suítes aprovadas com 0 falhas.`);
