# Walkthrough & Progress Review: Search Suggestions, Key Manager, and Transfer Authorization

เอกสารฉบับนี้สรุปความคืบหน้าการพัฒนาฟีเจอร์ทั้ง 3 ส่วน เพื่อให้ AI ตัวถัดไปสามารถอ่านและสานงานต่อได้อย่างถูกต้องและครบถ้วน

---

## 🎯 เป้าหมายของระบบ (System Goal)
1. **Search Bar (Auto-Suggestion)**: เพิ่มช่องค้นหาที่ให้คำแนะนำ (suggestions) ทันทีที่พิมพ์ในทุกหน้าของคลังสินค้า (`erp/main`, `erp/sub`, `erp/retail`) และตรงปุ่มเลือกสินค้าในหน้าขอโอนสินค้า (`erp/transfers`)
2. **Key Manager (PIN รายบุคคล)**: ยกระดับระบบรักษาความปลอดภัยจากเดิมที่เป็น Shared PIN ใน `SystemConfig` ให้เปลี่ยนเป็น PIN รายบุคคลของพนักงานแต่ละคน (เก็บในฟิลด์ `User.pin` มีความยาว 6-8 หลัก และห้ามซ้ำกัน) ทำให้สามารถตรวจสอบย้อนหลังได้ว่า **"ใคร"** เป็นคนอนุมัติหรือทำรายการ
3. **Transfer Authorization**: ในหน้าโอนสินค้า ตอนส่งคำขอโอนและการกดอนุมัติการโอน จะต้องมีหน้าต่างกรอก PIN ของ Manager หรือ CEO เพื่อระบุตัวตนและบันทึกผู้ขอ/ผู้อนุมัติลงใน Database

---

## 🟢 สิ่งที่แก้ไขและทำเสร็จแล้ว (Completed Tasks)

### 1. Database Schema & Migration
- **Prisma Schema** (`prisma/schema.prisma`):
  - เพิ่มฟิลด์ `pin String? @unique` ในโมเดล `User` เพื่อใช้เก็บรหัส PIN รายบุคคล
- **Direct Database Migration**:
  - สร้างไฟล์สคริปต์ `migrate_pin.js` เพื่อทำการเพิ่มคอลัมน์ `pin` และสร้าง `UNIQUE INDEX` บนตาราง `User` ในฐานข้อมูล SQLite (`dev.db`) โดยตรง เนื่องจาก `prisma db push` บน SQLite มีข้อจำกัดเรื่องดัชนี
  - รันไมเกรชันและทำการรันคำสั่ง `npx prisma generate` เพื่ออัปเดต Prisma Client เรียบร้อยแล้ว

### 2. Backend Authentication Logic
- **Auth Helper** (`src/lib/auth.ts`):
  - เพิ่มฟังก์ชัน `verifyPinIdentified(requiredRole, pin)` ซึ่งทำงานดังนี้:
    1. ตรวจสอบจากตาราง `User` ที่มี `pin` ตรงกับที่ป้อนเข้ามาและยังมีสถานะเป็น `isActive`
    2. เช็คบทบาท (Role) ของพนักงานคนนั้น (หากสิทธิ์คือ `OWNER` จะผ่านทุกกรณี, หากสิทธิ์คือ `MANAGER` จะผ่านเฉพาะงานระดับ `MANAGER`)
    3. หากพบตัวตน จะส่งกลับข้อมูล `{ role, userId, userName }` เพื่อนำไปใช้งานต่อ
    4. หากไม่พบ PIN รายบุคคล จะทำการ **Fallback** ไปตรวจสอบ Shared PIN ในตาราง `SystemConfig` (`owner_pin` และ `manager_pin`) เพื่อไม่ให้ระบบเดิมพัง และพ่วงชื่อผู้ใช้เริ่มต้นกลับไป
  - อัปเดตฟังก์ชัน `verifyPinHierarchical` และ `verifyPin` เดิมให้ไปเรียกใช้ `verifyPinIdentified` เพื่อให้เข้ากันได้กับระบบใหม่

### 3. API Routes Update
- **Verify-PIN API** (`src/app/api/verify-pin/route.ts`):
  - ปรับปรุงให้เรียกใช้ `verifyPinIdentified` และส่งคืนค่า `userId`, `userName` และ `usedRole` กลับไปยัง Frontend ทันทีหลังยืนยันรหัสผ่านเสร็จสิ้น
- **Users API** (`src/app/api/users/route.ts`):
  - **GET**: เพิ่มการดึงฟิลด์ `pin` กลับไปด้วย
  - **POST**: เพิ่มการตรวจสอบความยาว PIN (ต้องมีความยาว 6-8 ตัวอักษร) และตรวจสอบความซ้ำซ้อนในฐานข้อมูล (Unique check) ก่อนที่จะบันทึกพนักงานคนใหม่ลงไป

---

## 🟡 สิ่งที่ต้องทำต่อ (Remaining Tasks for the Next AI)

งานที่เหลือจะเน้นไปที่ส่วนของ **Frontend Components**, **CSS Styles** และการอัปเดตหน้าเพจระบบคลังสินค้า/โอนสินค้า

### 1. Frontend Components & Styling
- [ ] **สร้าง Component `SearchInput.tsx`** (`src/components/SearchInput.tsx`):
  - เป็นช่องพิมพ์ `<input>` ที่มาพร้อมกับ Suggestion Dropdown แสดงผลอยู่ด้านล่าง
  - ค้นหาและกรองรายการตามที่พิมพ์
  - รองรับการใช้งานผ่านแป้นพิมพ์ (Keyboard Navigation: กดลูกศร ↑ ↓, Enter เพื่อเลือก, Escape เพื่อปิด)
  - ปิด Dropdown เมื่อคลิกนอกพื้นที่ (Click Outside Detection)
  - ใส่ระบบ Debounce ประมาณ 150ms เพื่อลดภาระการทำงาน
- [ ] **สร้าง Component `PinVerifyModal.tsx`** (`src/components/PinVerifyModal.tsx`):
  - แสดง Modal ยืนยันรหัส PIN (ตัวเลข 4-8 หลัก)
  - เรียกใช้ API `/api/verify-pin` เพื่อดึงข้อมูลชื่อพนักงานที่กรอก PIN
  - ส่งค่า `{ userId, userName, role }` กลับไปยัง callback เมื่องานผ่าน
- [ ] **อัปเดต CSS** (`src/app/globals.css`):
  - เพิ่มสไตล์สำหรับ `.search-input-wrapper`, `.search-suggestions`, และรายการ `.suggestion-item`

### 2. Integration in Inventory Pages
- [ ] **erp/main** (`src/app/(main)/erp/main/page.tsx`):
  - นำ `<SearchInput>` ไปติดตั้งแทนช่องค้นหาเดิม เพื่อสืบค้นข้อมูลสินค้าพร้อมคำแนะนำ
- [ ] **erp/sub** (`src/app/(main)/erp/sub/page.tsx`):
  - ติดตั้ง `<SearchInput>` สำหรับคลังย่อย
- [ ] **erp/retail** (`src/app/(main)/erp/retail/page.tsx`):
  - ติดตั้ง `<SearchInput>` สำหรับคลังค้าปลีก

### 3. Integration in Transfer Page & API
- [ ] **erp/transfers** (`src/app/(main)/erp/transfers/page.tsx`):
  - ตรงช่องเลือกสินค้าเพื่อโอน: เปลี่ยนมาใช้ `<SearchInput>` เพื่อแสดง suggestion รายการสินค้าขณะพิมพ์
  - ตอนขอโอนสินค้า (Request Transfer): แสดง `<PinVerifyModal>` บังคับให้ใส่ PIN ของผู้ขอ (MANAGER หรือ OWNER) ก่อนส่งค่า และแนบ `createdById` ไปกับ Request
  - ตอนอนุมัติสินค้า (Approve Transfer): แสดง `<PinVerifyModal>` บังคับให้ใส่ PIN ผู้อนุมัติ และแนบ `approvedById` ไปกับ Request
- [ ] **Transfers API** (`src/app/api/transfers/route.ts`):
  - ปรับปรุงการรับค่า `createdById` และ `approvedById` เพื่อจัดเก็บลงฐานข้อมูลตาราง `Transfer` ตามที่ได้รับมาจาก Frontend แทนการดึงคนแรกอัตโนมัติ

---

## 🔍 รายละเอียดความเปลี่ยนแปลงรายไฟล์ (File Changes Diff)

### `prisma/schema.prisma`
```diff
 model User {
   id                String   @id @default(uuid())
   name              String
   email             String   @unique
   password          String
   role              String   // e.g. "CASHIER,BARBER,MANAGER,OWNER"
   isActive          Boolean  @default(true)
   phone             String?
+  pin               String?  @unique
   baseSalary        Float    @default(0)
```

### `src/lib/auth.ts`
```typescript
// ฟังก์ชันหลักที่เพิ่มขึ้นมาใหม่เพื่อระบุตัวตนผู้ยืนยัน PIN
export async function verifyPinIdentified(
  requiredRole: "MANAGER" | "OWNER",
  pin: string,
): Promise<{ role: "MANAGER" | "OWNER"; userId: string; userName: string } | null> {
  // 1. ค้นหาผู้ใช้จาก PIN รายบุคคล
  const user = await prisma.user.findFirst({
    where: { pin, isActive: true },
    select: { id: true, name: true, role: true },
  });

  if (user) {
    const roles = user.role.split(",").map((r) => r.trim().toUpperCase());
    const isOwner = roles.includes("OWNER");
    const isManager = roles.includes("MANAGER");

    if (isOwner) return { role: "OWNER", userId: user.id, userName: user.name };
    if (isManager && requiredRole === "MANAGER") return { role: "MANAGER", userId: user.id, userName: user.name };
    return null; // ไม่มีสิทธิ์ตรงตามที่ขอ
  }

  // 2. Fallback ไปที่ Shared PIN ใน SystemConfig หากไม่พบ PIN รายบุคคล
  const ownerConfig = await prisma.systemConfig.findUnique({ where: { key: "owner_pin" } });
  if (ownerConfig && ownerConfig.value === pin) {
    const ownerUser = await prisma.user.findFirst({
      where: { role: { contains: "OWNER" }, isActive: true },
      select: { id: true, name: true },
    });
    return { role: "OWNER", userId: ownerUser?.id ?? "", userName: ownerUser?.name ?? "Owner" };
  }
  // ... (กรณี MANAGER และคืนค่า null)
}
```

### `src/app/api/users/route.ts`
```typescript
// ตรวจสอบ PIN 6-8 หลักและความซ้ำซ้อนตอนบันทึกพนักงานใหม่
if (body.pin) {
  const pinLen = body.pin.length;
  if (pinLen < 6 || pinLen > 8) {
    return NextResponse.json({ error: "PIN ต้องมี 6-8 หลัก" }, { status: 400 });
  }
  const existing = await prisma.user.findFirst({ where: { pin: body.pin } });
  if (existing) {
    return NextResponse.json({ error: "PIN นี้ถูกใช้งานแล้ว กรุณาใช้ PIN อื่น" }, { status: 400 });
  }
}
```

---

## 🛠️ แนะนำการทดสอบสั้นๆ สำหรับ AI คนต่อไป
1. รันเซิร์ฟเวอร์ด้วย `npm run dev`
2. ทดสอบเรียก API ยืนยันพินเบื้องต้นด้วย curl:
   ```bash
   curl -X POST http://localhost:3000/api/verify-pin -H "Content-Type: application/json" -d '{"role":"MANAGER","pin":"1234"}'
   ```
3. เริ่มออกแบบฟรอนต์เอนด์ `SearchInput.tsx` และ `PinVerifyModal.tsx` ตามแบบแผนข้างต้นได้ทันที
