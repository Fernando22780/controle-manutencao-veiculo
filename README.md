# Controle de Manutenção de Veículo/Moto

Aplicativo acadêmico em React Native + Expo para registrar manutenções localmente, consultar a localização da oficina e fotografar o comprovante.

## Tecnologias

- React Native + Expo SDK 54
- React Navigation com Bottom Tabs
- `expo-local-authentication` para proteger o acesso
- `@react-native-async-storage/async-storage` para persistência local
- `expo-location` e `react-native-maps` para localização
- `expo-camera` para fotografar e exibir o comprovante

## Como executar

```bash
npm install
npx expo start
```

Abra o projeto no **Expo Go** usando o QR Code. Em um dispositivo sem biometria configurada, o aplicativo informa a indisponibilidade e permite continuar para facilitar os testes em simuladores e aparelhos sem cadastro biométrico.

## Estrutura

```text
controle-manutencao/
├── App.js          # biometria, navegação e telas do aplicativo
├── app.json        # configuração Expo, permissões e plugins
├── index.js        # entrada do Expo
├── package.json    # scripts e dependências
└── README.md       # instruções
```

