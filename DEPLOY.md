# 部署手册（生产）

目标机器：`192.168.3.74`（`debian`，Debian 13），项目目录 `/mcsm/cts/cts-website`，
网站域名 **`web.ctserver.top`**，通过 **Cloudflare Tunnel** 暴露。

> **为什么不用 80/443，也不动 `ctserver.top`**
>
> `ctserver.top` 的 A 记录指向家里那条宽带，上面挂着 7 个端口：
> `25565 25566 25567 25601 30000 30001 30002`。Cloudflare 只代理一小撮
> HTTP(S) 端口，25565 之流**根本穿不过去** —— 一旦把 apex 改成隧道的 CNAME，
> 这些服务会同时掉线。
>
> 所以网站单独用 `web.ctserver.top`，apex 一个字都不改。顺带的好处是
> Cloudflare 提供有效证书：会话 cookie 在生产带 `Secure` 标记
> （见 `src/lib/session.ts`），**没有 HTTPS 的话登录会静默失败**。

---

## 一次性准备

### 1. 建 Cloudflare Tunnel

Cloudflare Zero Trust → Networks → Tunnels → Create a tunnel（类型选 Cloudflared）
→ 复制 **token**（形如 `eyJhIjoi...`）。

然后在该 tunnel 的 **Public Hostname** 里加一条：

| 字段 | 值 |
| --- | --- |
| Subdomain | `web` |
| Domain | `ctserver.top` |
| Service | `http://app:3000` |

> ⚠️ **Subdomain 千万别留空。** 留空就是 `ctserver.top`，Cloudflare 会把 apex
> 的 A 记录改成隧道的 CNAME，你那 7 个端口全部失效。
> 建完去 DNS 页面确认 `ctserver.top` 那条 A 记录**还在、还是灰云**。

### 2. Azure 加回调地址

Azure Portal → 应用注册 → 身份验证 → 重定向 URI，**新增**（不要替换）：

```
https://web.ctserver.top/api/auth/callback
```

旧的 `https://ctserver.top/api/auth/callback` 可以留着。

### 3. 建目录

`/mcsm/cts` 属于 `mc_cts:mc_cts`，`city` 没有写权限，所以要 sudo：

```bash
sudo mkdir -p /mcsm/cts/cts-website
sudo chown city:city /mcsm/cts/cts-website
```

### 4. 拉代码

```bash
cd /mcsm/cts/cts-website
git clone https://github.com/CITYWIDESIGN/cts-website.git .
```

### 5. 写 .env

```bash
cp .env.production.example .env
chmod 600 .env
```

逐项填好，重点是：

- `POSTGRES_PASSWORD` / `SESSION_SECRET`：`node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
- `TUNNEL_TOKEN`：第 1 步复制的
- SMTP 那几项：和本地开发用同一个发件邮箱

---

## 部署

```bash
cd /mcsm/cts/cts-website

# 1. 构建（在服务器上构建，32 线程大概几分钟）
docker compose -f docker-compose.prod.yml build

# 2. 起数据库（app 会等 db healthy 再起）
docker compose -f docker-compose.prod.yml up -d db

# 3. 建表。**必须在 app 起来之前跑**，否则首次访问会报列不存在。
docker compose -f docker-compose.prod.yml run --rm app npx prisma db push

# 4. 起 app + tunnel
docker compose -f docker-compose.prod.yml up -d
```

### 验证

```bash
docker compose -f docker-compose.prod.yml ps          # 三个都该是 healthy / running
docker compose -f docker-compose.prod.yml logs -f cloudflared | head -40
curl -s http://127.0.0.1:3000/api/health              # 容器内网，宿主机访问不到
docker compose -f docker-compose.prod.yml exec app wget -qO- http://127.0.0.1:3000/api/health
```

然后从**外网**（手机流量，别用家里 WiFi）打开 <https://web.ctserver.top>。

---

## 日常运维

```bash
cd /mcsm/cts/cts-website

# 备份（默认写到 ./backups，建议 --out 指到别的盘）
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U cts cts_website | gzip > backups/cts-$(date +%F).sql.gz

# 清理过期数据
docker compose -f docker-compose.prod.yml exec app node scripts/cleanup.mts

# 更新代码
git pull
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
docker compose -f docker-compose.prod.yml run --rm app npx prisma db push
```

> `scripts/backup.mjs` 也能用（它会自动退回 `docker compose exec db pg_dump`），
> 但容器名和卷名对不上时不如上面那条直接。二选一，别两个都用。

### 挂 cron

```cron
# 每天 4:10 备份，保留 14 天
10 4 * * * cd /mcsm/cts/cts-website && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U cts cts_website | gzip > backups/cts-$(date +\%F).sql.gz && find backups -name 'cts-*.sql.gz' -mtime +14 -delete
# 每天 4:30 清理过期数据
30 4 * * * cd /mcsm/cts/cts-website && docker compose -f docker-compose.prod.yml exec -T app node scripts/cleanup.mts >> logs/cleanup.log 2>&1
```

---

## 回滚

```bash
# 代码回滚
git log --oneline -5
git checkout <上一个好的 commit>
docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d app

# 数据恢复（会覆盖现有数据，先停掉 app）
docker compose -f docker-compose.prod.yml stop app
gunzip -c backups/cts-2026-09-11.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U cts -d cts_website
docker compose -f docker-compose.prod.yml start app
```

---

## 已知注意点

- **`sessionVersion` 那一列**：本版本引入了它，`prisma db push` 会加上。
  副作用是老会话全部失效，所有人（包括站长自己）需要重新登录一次。
- **进后台**：站长账号在本地库里是 `ciiity`，`role = USER`。
  服务器上是新库，第一次部署后需要自己注册一个账号并提权。
- **Microsoft 登录**：AppID 审批没过之前最后一步 403，本地账号不受影响。
- **首页在线人数**：`MC_PING_HOST=host.docker.internal` 指向宿主机的 25565
  （velocity 代理），拿到的是整个网络的在线人数。想关掉就把这一行注释掉。
- **`MC_PING` 默认关闭**：`mc-ping.ts` 只有在设了 `MC_PING_HOST` 或 `MC_PING=1`
  时才探测。没设时首页显示 `src/config/site.ts` 里的静态值。
