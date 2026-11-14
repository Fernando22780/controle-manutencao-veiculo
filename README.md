# Controle de Manutenção de Veículos

Aplicativo para cadastrar veículos, registrar manutenções e guardar fotos dos comprovantes.

## Executar

Requer Node.js e Expo Go em um celular.

```bash
npm install
npx expo start
```

Leia o QR Code pelo Expo Go. Câmera, localização, biometria e PDF devem ser testados em um aparelho físico.

## Recursos

- Cadastro local de usuário e veículos
- Histórico de manutenções, quilometragem, custos e lembretes
- Foto de comprovante com confirmação antes de salvar
- Registro de localização da oficina
- Acesso opcional por biometria

## Configuração

Copie `.env.example` para `.env` e preencha as configurações do Firebase se for usar sincronização. O arquivo `.env` não deve ser compartilhado.

A API opcional inicia com `npm run api`. Para acessar pelo celular, configure `EXPO_PUBLIC_API_URL` com o endereço do computador na rede.

## Testes

```bash
npm test
```
