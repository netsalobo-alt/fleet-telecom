# Instalar o Fleet Telecom no Portainer (fleet.nortetelecom.net.br)

O sistema roda num único container com banco SQLite. Os dados ficam no volume `fleet_data`.

A imagem é montada automaticamente pelo GitHub a cada atualização do `main`, e o Portainer só precisa baixá-la:
`ghcr.io/netsalobo-alt/fleet-telecom:latest` (servidores Intel/AMD ou ARM).

## 1. Antes de começar (uma vez só)

1. **DNS.** Crie na zona `nortetelecom.net.br` um registro:

   ```text
   fleet   A   135.181.88.165
   ```

   (o mesmo servidor do `m2auto.com.br` e do `analytics.m2auto.com.br`). Confira com `dig +short fleet.nortetelecom.net.br`.
   Sem esse registro o Traefik não consegue emitir o certificado.
2. **Acesso à imagem.** Se o repositório no GitHub for privado, a imagem também é. Duas opções:
   - deixar o pacote público em https://github.com/netsalobo-alt?tab=packages › **fleet-telecom** ›
     **Package settings › Change visibility** (expõe o código, não os dados); ou
   - cadastrar o GHCR no Portainer em **Registries › Add registry › Custom registry**: Registry URL `ghcr.io`,
     **Authentication** com usuário `netsalobo-alt` e um token (classic) só com `read:packages`.
3. **Traefik.** O servidor já tem o Traefik v3 nas portas 80/443, na rede **`Mosqueironet`**. O compose usa as mesmas
   labels das stacks do M2 e do ChatAnalytics: entrypoint `websecure`, certresolver `letsencryptresolver`,
   `traefik.swarm.network=Mosqueironet`. Se alguma mudar, ajuste a linha correspondente no `docker-compose.yml`.

## 2. Criar a stack

1. No Portainer, abra **Stacks › Add stack**.
2. Em **Name**, use `fleet`.
3. Em **Build method**, escolha **Web editor** e cole o conteúdo de [`docker-compose.yml`](../docker-compose.yml).
4. Em **Environment variables**, adicione:

   | Nome | Valor | Obrigatória |
   | --- | --- | --- |
   | `FLEET_ADMIN_PASSWORD` | senha forte, mínimo 8 caracteres | sim |
   | `FLEET_ADMIN_LOGIN` | login do administrador (padrão `admin`) | não |
   | `FLEET_ADMIN_NAME` | nome exibido (padrão `Administrador`) | não |
   | `GEMINI_API_KEY` | chave do Gemini, para leitura de notas e diagnóstico com IA | não |
   | `FIPE_SUBSCRIPTION_TOKEN` | token da API FIPE (fipe.parallelum.com.br), para buscar o valor FIPE pela placa | não |
   | `WAHA_ALLOWED_HOSTS` | `waha.nortetelecom.net.br`, para só permitir envio de WhatsApp por ela | não |

   O administrador é criado **só na primeira vez**, com o banco vazio. Depois, usuários e senhas são geridos no
   próprio sistema (ícone de chave no rodapé do menu) e essas variáveis deixam de ter efeito.
5. Clique em **Deploy the stack**.
6. Em **Containers**, o `fleet` deve ficar **healthy** em até 1 minuto. Abra https://fleet.nortetelecom.net.br:
   na primeira visita o Traefik emite o certificado, o que leva alguns segundos.

## 3. Como o HTTPS funciona

Não há portas publicadas: o Traefik recebe o acesso em 443, emite o certificado Let's Encrypt e encaminha para a porta
3000 do container pela rede `Mosqueironet`. O app confia no proxy (`trust proxy`), então o cookie de login sai como
`Secure`. As labels ficam em `deploy.labels`, que é onde o Traefik em Swarm as lê.

A stack usa `replicas: 1` e atualização `stop-first`: o banco é um arquivo, e só um container deve abri-lo por vez.
Numa atualização o sistema fica fora do ar por alguns segundos.

## 4. Primeiro acesso

1. Entre com `FLEET_ADMIN_LOGIN` (padrão `admin`) e `FLEET_ADMIN_PASSWORD`.
2. Em **Usuários** (ícone de chave), crie os logins da equipe: gestor, supervisor, motorista ou somente leitura.
3. Em **Cadastros › Motoristas**, cadastre os motoristas; ter login é opcional.
4. Em **Configurações**, informe as chaves da Selsyn, da WAHA (WhatsApp) e da OpenAI.
5. Se algum navegador ainda tiver dados da versão antiga, que guardava tudo no navegador, abra o sistema nele como
   gestor: aparece a opção **Importar** para levar esses dados ao servidor.

## 5. Atualizar o sistema

Cada mudança no `main` publica uma imagem nova em alguns minutos (aba **Actions**, workflow "Imagem Docker").
Para aplicar: abra a stack, clique em **Update the stack** e marque **Re-pull image and redeploy**.
**Nunca apague o volume `fleet_data`.**

## 6. Backup e restauração

O banco inteiro é o arquivo `fleet.db` dentro do volume. Cópia consistente com o sistema rodando
(no servidor, por SSH):

```bash
C=$(docker ps -q -f name=fleet_fleet)
docker exec $C node -e "new (require('node:sqlite').DatabaseSync)('/app/data/fleet.db').exec(\"VACUUM INTO '/app/data/backup.db'\")"
docker cp $C:/app/data/backup.db ./fleet-$(date +%F).db
docker exec $C rm /app/data/backup.db
```

Para restaurar: escale o serviço para 0, coloque o arquivo no volume com o nome `fleet.db`
(`/var/lib/docker/volumes/fleet_data/_data/`) e escale de volta para 1.

## 7. Conferir que está tudo certo

```bash
curl -s https://fleet.nortetelecom.net.br/api/health   # {"status":"ok",...}
curl -s https://fleet.nortetelecom.net.br/api/ready    # {"status":"ready","database":{"engine":"SQLite",...}}
```

Os logs ficam em **Services › fleet_fleet › Logs** (a primeira linha útil é `[DB] Banco novo: administrador ...`).
