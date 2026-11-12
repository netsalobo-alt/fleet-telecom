# GUIA DE DEPLOY: FLEET TELECOM NO PORTAINER / DOCKER SWARM
# (Build Local da Imagem: fleet-app:1.0.0 - Sem Registry Privado)

**Domínio:** `fleet.nortetelecom.net.br`  
**Roteador de Entrada:** Traefik existente (Rede externa: `Mosqueironet`)  
**Banco de Dados:** SQLite dentro do próprio app (arquivo `/app/data/fleet.db`)  
**Volume de Dados:** `fleet_data`  
**Imagem da Aplicação:** `fleet-app:1.0.0` (construída localmente no nó Manager)  

---

## 1. Pré-Requisitos no Servidor (Nó Manager do Swarm)

1. **Entrada DNS:**  
   Configure um registro do tipo `A` (ou `CNAME`) na zona DNS de `nortetelecom.net.br`:
   ```text
   fleet.nortetelecom.net.br  IN  A  <IP_PUBLICO_DO_TRAEFIK>
   ```

2. **Verificar a Rede Externa do Traefik (Mosqueironet):**  
   Certifique-se de que a rede overlay `Mosqueironet` já existe no cluster:
   ```bash
   docker network ls | grep Mosqueironet
   ```
   *(Caso não exista, crie-a como overlay anexável: `docker network create --driver overlay --attachable Mosqueironet`)*

---

## 2. Passo a Passo: Download do Código e Build Local da Imagem

Como não há registry privado, a imagem é compilada diretamente no servidor que atua como **Manager** do cluster Swarm:

```bash
# 1. Acesse o servidor via SSH no nó Manager do cluster
ssh usuario@ip-do-servidor

# 2. Crie ou acesse o diretório de aplicações
mkdir -p /opt/apps && cd /opt/apps

# 3. Clone o repositório do GitHub (ou baixe os arquivos mais recentes)
git clone https://github.com/SEU_USUARIO/fleet-frota.git fleet
cd /opt/apps/fleet

# 4. Caso já tenha clonado anteriormente e queira apenas atualizar:
# git pull origin main

# 5. Construa a imagem localmente com a tag fleet-app:1.0.0
docker build -t fleet-app:1.0.0 .

# 6. Verifique se a imagem foi criada com sucesso
docker images | grep fleet-app
# Saída esperada: fleet-app   1.0.0   ...   <tamanho otimizado ~200MB>
```

> **Nota de Arquitetura Swarm:**  
> Como a imagem foi construída localmente e não em um registry centralizado, o serviço `fleet_app` no arquivo `docker-stack.yml` foi configurado com a restrição de placement:
> ```yaml
> placement:
>   constraints:
>     - node.role == manager
> ```
> Isso garante que o Docker Swarm instancie o container exclusivamente no nó onde a imagem `fleet-app:1.0.0` existe.

---

## 3. Segredo da IA (Docker Secret)

No terminal do nó Manager (ou pela interface do Portainer em **Secrets**):

```bash
echo -n "SUA_CHAVE_GEMINI_AQUI" | docker secret create gemini_api_key -
```

Não há senha de banco: o banco é um arquivo SQLite dentro do volume `fleet_data`.

---

## 4. Publicação da Stack no Portainer

1. Acesse o painel web do **Portainer**.
2. No menu lateral do cluster Swarm, clique em **Stacks** > **Add stack**.
3. Escolha **Web editor** ou faça o upload do arquivo `docker-stack.yml`.
4. Defina o nome da stack: `fleet_telecom`.
5. Cole o conteúdo integral do arquivo `docker-stack.yml`.
6. Clique no botão **Deploy the stack**.

O Portainer criará o serviço `fleet_telecom_fleet_app` e o volume `fleet_telecom_fleet_data`.

---

## 5. Primeiro acesso

No primeiro start (volume vazio) o app cria o banco e um administrador:

- login: o valor de `FLEET_ADMIN_LOGIN` (padrão `admin`);
- senha: a de `FLEET_ADMIN_PASSWORD`, ou, se ela não foi definida, uma senha temporária
  que aparece **uma única vez** no log do serviço (`Services` > `fleet_app` > `Logs`, linha `[DB] Banco novo`).

Entre, crie os usuários da equipe em **Usuários** e troque a senha do administrador.
Se algum navegador ainda tiver dados da versão anterior (que guardava tudo no navegador),
ao entrar como gestor o app oferece **Importar** esses dados para o servidor.

### Backup

O banco inteiro é o arquivo `fleet.db`. Para uma cópia consistente com o app rodando:

```bash
C=$(docker ps -q -f name=fleet_telecom_fleet_app)
docker exec $C node -e "new (require('node:sqlite').DatabaseSync)('/app/data/fleet.db').exec(\"VACUUM INTO '/app/data/backup.db'\")"
docker cp $C:/app/data/backup.db ./fleet-$(date +%F).db
docker exec $C rm /app/data/backup.db
```

Restaurar: pare o serviço, coloque o arquivo no volume com o nome `fleet.db` e suba de novo.

---

## 6. Verificação de Saúde e Roteamento

1. **Liveness Probe (Aplicação e Servidor Web):**
   ```bash
   curl -I https://fleet.nortetelecom.net.br/api/health
   # Retorno esperado: HTTP/2 200 OK
   ```

2. **Readiness Probe (Status da Aplicação):**
   ```bash
   curl -s https://fleet.nortetelecom.net.br/api/ready
   ```

3. **Logs dos Containers no Portainer:**
   - Acesse **Services** > `fleet_telecom_fleet_app` > **Logs** para verificar a inicialização do Express.

---

## 7. Como Atualizar a Aplicação no Futuro

Para aplicar novas alterações de código no futuro:

```bash
cd /opt/apps/fleet
git pull origin main

# Reconstrua a imagem local
docker build -t fleet-app:1.0.0 .

# Force o Swarm a atualizar o serviço com a nova imagem compilada
docker service update --force --image fleet-app:1.0.0 fleet_telecom_fleet_app
```
*(Ou pelo Portainer, abra o serviço `fleet_app` e clique no botão **Service update**).*
