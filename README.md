# Controle de Manutenção de Veículos

Aplicação móvel em React Native + Expo para organizar veículos e o respetivo histórico de manutenção. O projeto foi atualizado para **Expo SDK 58** e recebeu uma identidade visual premium em verde profundo, esmeralda, marfim e dourado.

## Como executar

```bash
npm install
npx expo install expo-image-manipulator expo-print expo-sharing
npx expo start
```

Abra o QR Code com o Expo Go. Para criar uma build nativa, use EAS Build ou os comandos Expo apropriados para Android/iOS.

## Funcionalidades

- Cadastro e login local, com acesso opcional por biometria
- Garagem: cadastre o modelo uma vez; placa e ano são opcionais e aparecem nos registros quando informados
- Seletor de veículo existente ao registar cada manutenção
- Migração dos nomes de veículo dos registos antigos para a nova garagem, preservando o histórico
- Registo de serviço, data, localização e comprovativo associados ao veículo selecionado
- Calendário visual para escolher a data da manutenção
- Histórico de manutenções com detalhes e edição de comprovativo/localização
- Aba Comprovantes: cada foto abre o registo de manutenção correspondente
- Página inicial com resumo do veículo selecionado e até três atividades recentes clicáveis
- Perfil com foto escolhida da galeria ou tirada na hora, com prévia, recorte (cantos arrastáveis) e botão Concluir
- Km e valor pago (opcionais) em cada manutenção
- Lembrete da próxima manutenção por km e/ou por tempo, com sugestão automática por tipo de serviço
- Início com gasto do mês, gasto total, km atual (editável) e próximas manutenções com barra de progresso
- Relatório do veículo em PDF (histórico, totais e comprovantes) para compartilhar
- Histórico com filtro por veículo e busca (serviço, placa ou data)
- Edição de registros já salvos (serviço, data, km, valor e lembrete)
- Gráfico de gastos dos últimos 6 meses e ranking dos serviços que mais custaram
- Alteração de senha com validação da senha antiga e confirmação da nova senha
- Ícone do app atualizado para a proposta aprovada com o carro preto

## Tecnologias

- React Native e Expo SDK 58
- React Navigation
- AsyncStorage para armazenamento local
- Expo ImagePicker para selecionar ou fotografar a imagem de perfil
- MaterialCommunityIcons
- Biometria com `expo-local-authentication`
- GPS com `expo-location`
- Câmara com `expo-camera`

## Estrutura principal

```text
App.js                         # Navegação e sessão
app.json                       # Configuração Expo e permissões
assets/app-icon.png            # Ícone aprovado
src/storage.js                 # Dados locais, garagem e migração
src/components/CalendarPicker.js # Calendário da manutenção
src/screens/                   # Telas do aplicativo
src/theme.js                   # Paleta e helpers
```

## Observação importante sobre o banco de dados

Os dados ainda são guardados no aparelho com AsyncStorage. A integração Firebase/Firestore não está ligada nesta versão; o modelo de veículos e manutenções já está estruturado para permitir essa próxima etapa, mas será necessário configurar um projeto Firebase e substituir a camada local de persistência.

Para testar GPS, câmara e biometria, use um dispositivo físico. Algumas capacidades podem ser limitadas em simuladores. O calendário é implementado na própria aplicação e não requer um pacote nativo adicional.

## Modelo dos dados (preparado para o Firebase)

Cada registro de manutenção guarda, além dos campos antigos:

```text
km        número | null        km do painel no dia do serviço
cost      número | null        valor pago em reais
reminder  objeto | null        { kmInterval, monthsInterval, nextKm, nextDate }
```

O veículo pode ter `currentKm` e `currentKmDate`. Para ligar o Firestore, basta trocar as funções de `src/storage.js`; as telas e os cálculos (`src/maintenanceUtils.js`) não mudam.
