# คู่มือ Deploy Salon POS ขึ้น VPS (ตั้งแต่ศูนย์)

คู่มือนี้พาติดตั้งระบบ Salon POS บน VPS Linux (Ubuntu 22.04 / 24.04) ตั้งแต่เครื่องเปล่า
จนเปิดใช้งานผ่าน HTTPS ได้จริง พร้อมอธิบายว่าแต่ละชิ้นใน tech stack ทำหน้าที่อะไร

---

## ส่วนที่ 1 — Tech Stack ทำอะไรบ้าง (ภาพรวมก่อนลงมือ)

```
                    HTTPS (443)            HTTP (localhost:3000)
   [ Browser ]  ───────────────►  [ Caddy ]  ───────────────►  [ Next.js (Node) ]
   ผู้ใช้/ลูกค้า   เข้ารหัส TLS         reverse proxy              เว็บ + API ในตัวเดียว
                                          │                              │
                                          │                              │ Prisma (ORM)
                                          │                              ▼
                                   (ออก cert ให้อัตโนมัติ)        [ PostgreSQL (5432) ]
                                                                     ฐานข้อมูลจริง
   [ pm2 ] คอยดูแลให้ Node รันค้าง + restart เองเมื่อแครชหรือรีบูตเครื่อง
```

| ชิ้นส่วน | คือ | หน้าที่ในระบบนี้ |
|---|---|---|
| **Node.js** | runtime ของ JavaScript | เป็น "เครื่องยนต์" ที่รันตัวแอป Next.js (แอปนี้เป็น JS ทั้งหมด) |
| **Next.js 16** (App Router) | เว็บเฟรมเวิร์ก full-stack | เสิร์ฟทั้งหน้า UI และ API routes (`/api/...`) ในโปรเซสเดียว — ตัวแอปหลักของเรา |
| **React 19** | UI library | สร้างหน้าจอ/คอมโพเนนต์ (Next ใช้ React เรนเดอร์หน้า) |
| **Tailwind CSS v4** | CSS framework | สไตล์/ดีไซน์หน้าจอ (build รวมเป็น CSS ตอน `npm run build`) |
| **Prisma 7** | ORM | สะพานเชื่อมโค้ดกับฐานข้อมูล — เขียน `prisma.order.findMany()` แทน SQL ดิบ |
| **@prisma/adapter-pg + pg** | driver | ตัวที่ Prisma ใช้ "คุย" กับ PostgreSQL จริงๆ |
| **PostgreSQL** | ฐานข้อมูล | เก็บข้อมูลทั้งหมด (ออร์เดอร์ ลูกค้า สต็อก พนักงาน ฯลฯ) |
| **bcryptjs** | hashing | เข้ารหัสรหัสผ่านพนักงานก่อนเก็บลง DB (ไม่เก็บ plain text) |
| **Session cookie** (`src/lib/session.ts`) | auth เขียนเอง | จำว่าใคร login อยู่ (เก็บใน cookie `salon_session`) |
| **pm2** | process manager | ให้แอปรันค้างเป็น background + restart อัตโนมัติเมื่อแครช/รีบูต |
| **Caddy** | reverse proxy + TLS | รับ HTTPS จากโลกภายนอก, ออกใบ cert ฟรีอัตโนมัติ, ส่งต่อเข้า Next ที่ port 3000 |
| **Git / GitHub** | version control | ช่องทาง deploy: แก้โค้ดที่เครื่อง → push → VPS `git pull` |

**สิ่งที่ต้องเตรียมก่อน:**
1. VPS Ubuntu 22.04/24.04 + สิทธิ์ `sudo` (แนะนำ RAM ≥ 2GB เพราะ `next build` กินแรม)
2. โดเมน (เช่น `pos.yourshop.com`) ที่ตั้ง DNS A record ชี้มาที่ IP ของ VPS แล้ว
3. SSH เข้า VPS ได้

> ⚠️ ทำไมต้องมีโดเมน + HTTPS? เพราะ cookie ของ session ตั้ง `Secure` เมื่อเป็น HTTPS
> (ดู `src/lib/session.ts`) ถ้าเข้าผ่าน `http://<ip>` ตรงๆ จะ login แล้ววนกลับหน้าเดิม
> ทางลัดถ้ายังไม่มีโดเมน: ตั้ง `COOKIE_SECURE=false` ใน `.env` (ดูส่วนที่ 3) — ใช้ทดสอบเท่านั้น

---

## ส่วนที่ 2 — ติดตั้งทีละขั้น

### 2.1 ตั้งค่าเครื่องเบื้องต้น + firewall
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw

# เปิดเฉพาะ port ที่ใช้: SSH(22), HTTP(80), HTTPS(443)
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```
> Postgres (5432) **ไม่ต้อง** เปิด firewall — แอปกับ DB อยู่เครื่องเดียวกัน คุยผ่าน localhost

### 2.2 ติดตั้ง Node.js (LTS 22)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # ควรได้ v22.x
```

### 2.3 ติดตั้ง PostgreSQL + สร้าง DB
```bash
sudo apt install -y postgresql
sudo systemctl enable --now postgresql    # ให้ Postgres เปิดเองตอนบูต

# สร้าง role 'salon' (ตั้งรหัสผ่านแข็งแรง) + database 'salonpos'
sudo -u postgres psql <<'SQL'
CREATE ROLE salon WITH LOGIN PASSWORD 'CHANGE_TO_A_STRONG_PASSWORD' CREATEDB;
CREATE DATABASE salonpos OWNER salon;
SQL
```
> Ubuntu ตั้ง `host 127.0.0.1 scram-sha-256` ใน `pg_hba.conf` มาให้แล้ว → เชื่อมด้วย user/password ผ่าน localhost ได้เลย ไม่ต้องแก้อะไรเพิ่ม

### 2.4 ดึงโค้ดจาก GitHub
```bash
cd ~
git clone https://github.com/Miaojaaa/POS.git
cd POS/salon-pos
```

### 2.5 สร้างไฟล์ `.env` (ไม่อยู่ใน repo — ต้องสร้างเอง)
```bash
nano .env
```
ใส่:
```env
DATABASE_URL="postgresql://salon:CHANGE_TO_A_STRONG_PASSWORD@localhost:5432/salonpos?schema=public&connection_limit=10"
NODE_ENV="production"
# ตั้งบรรทัดล่างนี้เฉพาะถ้ายังไม่มีโดเมน/HTTPS แล้วอยากทดสอบผ่าน http (ปิดความปลอดภัย cookie):
# COOKIE_SECURE="false"
```

### 2.6 ติดตั้ง dependencies
```bash
npm ci
```
> `npm ci` ติดตั้งตาม `package-lock.json` เป๊ะ (เหมาะกับ production มากกว่า `npm install`)
> postinstall จะพยายามตั้ง git hook — ถ้าขึ้น warning ไม่เป็นไร ไม่กระทบการ deploy

### 2.7 เตรียมฐานข้อมูล — เลือก 1 ใน 2 แบบ

**แบบ A — เริ่มสะอาด (แนะนำสำหรับเปิดร้านจริงใหม่)**
ได้ พนักงาน + บริการ + สินค้า + การตั้งค่า/แบรนด์ จาก snapshot ในโปรเจกต์ แต่ยังไม่มีประวัติออร์เดอร์
```bash
npm run bootstrap
```
> `bootstrap` = `prisma db push` (สร้างตาราง) + `prisma generate` + import `shared-config.json` + `shared-catalog.json`

**แบบ B — ยกข้อมูลทั้งหมดจากเครื่อง dev มาด้วย (รวมออร์เดอร์/ลูกค้า)**
ดูวิธี dump/restore ใน [ส่วนที่ 4](#ส่วนที่-4--ยกข้อมูลทั้งก้อนจากเครื่อง-dev-ขึ้น-vps)

### 2.8 Build + ทดสอบรัน
```bash
npm run build          # สร้าง production build (กินแรม — ดูหมายเหตุ RAM ด้านล่าง)
npm run start          # = next start, ฟังที่ port 3000
```
เปิดอีก terminal เช็ก: `curl -I http://localhost:3000` ควรได้ HTTP 307 (redirect ไป /pos/new) → กด `Ctrl+C` ปิด

> 💡 **RAM น้อย (≤1GB) แล้ว build ค้าง/ถูก kill?** เพิ่ม swap ชั่วคราว หรือสั่ง build แบบจำกัดแรม:
> `NODE_OPTIONS=--max-old-space-size=2048 npm run build`

### 2.9 ให้แอปรันค้างด้วย pm2
```bash
sudo npm install -g pm2
pm2 start npm --name salon-pos -- start   # รัน `npm start` ภายใต้ชื่อ salon-pos
pm2 save                                   # จำ process list ไว้
pm2 startup                                # ทำตามคำสั่ง sudo ที่มันพิมพ์ออกมา → เปิดเองตอนรีบูต
pm2 logs salon-pos                         # ดู log (Ctrl+C ออก)
```

### 2.10 ติดตั้ง Caddy = reverse proxy + HTTPS อัตโนมัติ
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```
แก้ Caddyfile:
```bash
sudo nano /etc/caddy/Caddyfile
```
ใส่ (เปลี่ยนเป็นโดเมนจริง):
```caddy
pos.yourshop.com {
    reverse_proxy localhost:3000
}
```
แล้ว reload:
```bash
sudo systemctl reload caddy
```
> Caddy จะ **ออกใบ cert Let's Encrypt ให้เองอัตโนมัติ** และส่ง header `X-Forwarded-Proto: https`
> ให้ Next รู้ว่าเป็น HTTPS → cookie ตั้ง `Secure` ถูกต้อง (ตรงกับ logic ใน `session.ts`)

### ✅ เสร็จ — เปิด `https://pos.yourshop.com` ใช้งานได้เลย
Login ทดสอบ (ถ้าใช้ snapshot แบบ A): `owner@salon.com` / `owner123`
> 🔐 **เปลี่ยนรหัสผ่าน owner/manager ทันทีหลังเปิดใช้งานจริง**

---

## ส่วนที่ 3 — แก้โค้ดแล้ว deploy ซ้ำ (update รอบถัดไป)

หลักการ: **แก้ที่เครื่อง dev → push → VPS pull → build → restart** (production ไม่ hot-reload)

```bash
# --- เครื่อง dev ---
git add . && git commit -m "..." && git push

# --- บน VPS ---
cd ~/POS/salon-pos
git pull
npm ci                  # เฉพาะตอน package.json/lock เปลี่ยน
npx prisma generate     # เฉพาะตอน schema.prisma เปลี่ยน
npm run build
pm2 restart salon-pos
```

ถ้า **schema เปลี่ยน** (เพิ่ม model/field) ให้สั่ง `npx prisma db push` ก่อน `build` ด้วย
(โปรเจกต์นี้ไม่ commit migration — ใช้ `db push` เป็นหลัก)

### สคริปต์ลัด `deploy.sh` (วางไว้ใน `salon-pos/` บน VPS)
```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
git pull
npm ci
npx prisma generate
npm run build
pm2 restart salon-pos
echo "✅ deployed"
```
ใช้: `chmod +x deploy.sh` ครั้งเดียว แล้วรัน `./deploy.sh` ทุกครั้งที่ deploy

---

## ส่วนที่ 4 — ยกข้อมูลทั้งก้อนจากเครื่อง dev ขึ้น VPS

ถ้าอยากเอาข้อมูลจริงทั้งหมด (ออร์เดอร์/ลูกค้า/สต็อก) จากเครื่อง Windows ขึ้น VPS:

**1) บนเครื่อง dev (Windows) — dump ออกมา**
```bash
# ใช้ pg_dump ของ scoop
& "$env:USERPROFILE\scoop\apps\postgresql\current\bin\pg_dump.exe" -U salon -h localhost -d salonpos -Fc -f salonpos.dump
```

**2) ส่งไฟล์ขึ้น VPS**
```bash
scp salonpos.dump user@your-vps-ip:~/
```

**3) บน VPS — restore (ต้องสร้าง role+db ใน 2.3 แล้ว และยังว่างอยู่)**
```bash
pg_restore -U salon -h localhost -d salonpos --no-owner salonpos.dump
```
> ถ้า DB มีข้อมูลอยู่แล้วและอยากทับใหม่: `dropdb`/`createdb` ก่อน หรือเพิ่ม `--clean` ตอน restore

หลัง restore แล้วค่อย `npm run build` + `pm2 restart` ตามปกติ (ข้าม `npm run bootstrap`)

---

## ส่วนที่ 5 — คำสั่งดูแลรักษา (cheat sheet)

| อยากทำ | คำสั่ง |
|---|---|
| ดูสถานะแอป | `pm2 status` |
| ดู log แอป | `pm2 logs salon-pos` |
| restart แอป | `pm2 restart salon-pos` |
| ดู log Caddy (เช่น cert มีปัญหา) | `sudo journalctl -u caddy -f` |
| สถานะ Postgres | `sudo systemctl status postgresql` |
| เข้า psql | `sudo -u postgres psql salonpos` |
| backup DB ประจำ | `pg_dump -U salon -h localhost -Fc salonpos > backup_$(date +%F).dump` |

> 💾 **ตั้ง cron backup DB เป็นประจำ** เป็นสิ่งที่ควรทำก่อนเปิดใช้งานจริง — บอกได้ถ้าอยากให้ช่วยตั้ง
