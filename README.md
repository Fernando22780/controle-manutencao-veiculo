# Controle de Manutenção de Veículos

Aplicativo em **React Native + Expo**, compatível com Android e iOS pelo Expo Go.

Permite registrar manutenções, salvar a localização da oficina por GPS e anexar fotos dos comprovantes. Os dados ficam salvos localmente no aparelho.

## Tecnologias

- React Native e Expo SDK 57
- React Navigation
- AsyncStorage
- Biometria com `expo-local-authentication`
- GPS com `expo-location`
- Câmera com `expo-camera`

## Como executar

```bash
npm install
npx expo start
```

Depois, abra o projeto no **Expo Go** pelo QR Code.

## Funcionalidades

- Cadastro e login local
- Acesso opcional por biometria
- Bloqueio automático ao voltar para o app
- Registro de serviço, data, veículo, localização e comprovante
- Histórico de manutenções
- Visualização e edição dos registros salvos
- Perfil da conta e logout

## Estrutura principal

```text
App.js              # Navegação e sessão
app.json            # Configuração do Expo e permissões
index.js            # Entrada do aplicativo
src/storage.js      # Dados locais
src/theme.js        # Tema e helpers
src/screens/        # Telas do aplicativo
src/components/     # Componentes reutilizáveis
```

## Observação

Para testar GPS, câmera e biometria corretamente, use um dispositivo físico com o Expo Go. O comportamento pode ser limitado em emuladores ou simuladores.
