import { prisma } from "./src/lib/prisma";

async function main() {
  const categories = [
    { id: "cat-cut-wash", name: "ตัด & สระไดร์" },
    { id: "cat-treatment", name: "ทรีทเมนท์" },
    { id: "cat-hair-color", name: "สีผม" },
    { id: "cat-straight-perm", name: "ยืด ดัด" },
    { id: "cat-nail-polish", name: "ทาสีเล็บ (มือ / เท้า)" },
    { id: "cat-nail-extension", name: "งานต่อ / งานถอด" },
    { id: "cat-nail-technical", name: "งานเทคนิค" },
    { id: "cat-spa", name: "สปามือ / เท้า" }
  ];

  for (const cat of categories) {
    await prisma.serviceCategory.upsert({
      where: { id: cat.id },
      update: { name: cat.name },
      create: cat
    });
  }

  const services = [
    // ตัด & สระไดร์
    { id: "svc-cut-senior", name: "Senior Hair Cut", price: 1000, categoryId: "cat-cut-wash" },
    { id: "svc-cut-women", name: "ตัดผมหญิง", price: 650, categoryId: "cat-cut-wash" },
    { id: "svc-cut-men", name: "ตัดผมชาย", price: 400, categoryId: "cat-cut-wash" },
    { id: "svc-wash-women", name: "สระไดร์หญิง", price: 400, categoryId: "cat-cut-wash" },
    { id: "svc-wash-men", name: "สระไดร์ชาย", price: 300, categoryId: "cat-cut-wash" },

    // ทรีทเมนท์
    { id: "svc-trt-scalp", name: "L - ทรีทเมนท์หนังศีรษะ", price: 1500, categoryId: "cat-treatment" },
    { id: "svc-trt-expert", name: "L - ซีรีย์เอ็กซ์เพิร์ททรีทเมนท์", price: 1500, categoryId: "cat-treatment" },
    { id: "svc-trt-molecular", name: "L - โมเลกุลล่าอาร์มทรีทเมนท์", price: 2500, categoryId: "cat-treatment" },
    { id: "svc-trt-metal", name: "L - เมทัลดีเอ็กซ์ทรีทเมนท์", price: 2500, categoryId: "cat-treatment" },
    { id: "svc-trt-milkshake-makemyday", name: "มิลค์เชคเมคมายเดย์", price: 2000, categoryId: "cat-treatment" },
    { id: "svc-trt-deep-layer", name: "ดีพเลเยอร์", price: 2500, categoryId: "cat-treatment" },
    { id: "svc-trt-bond", name: "ทรีทเมนท์รักษาพันธะแกนผม", price: 2000, categoryId: "cat-treatment" },
    { id: "svc-trt-color-protect", name: "F - คัลเลอร์โปรเทสซ์", price: 3500, categoryId: "cat-treatment" },
    { id: "svc-trt-purifica", name: "F - เพียวริฟิกาโปร", price: 3500, categoryId: "cat-treatment" },
    { id: "svc-trt-frotec", name: "F - โฟรเทค", price: 3500, categoryId: "cat-treatment" },
    { id: "svc-trt-premier", name: "K - พรีเมียร์", price: 3500, categoryId: "cat-treatment" },
    { id: "svc-trt-therapiste", name: "K - เธอราพิส", price: 3500, categoryId: "cat-treatment" },
    { id: "svc-trt-fusiodose", name: "K - ฟูซิโอดลส์", price: 3500, categoryId: "cat-treatment" },
    { id: "svc-trt-k", name: "K - ทรีทเมนท์", price: 3000, categoryId: "cat-treatment" },
    { id: "svc-trt-dd-vegan", name: "DD วีแกนเคราติน", price: 4000, categoryId: "cat-treatment" },
    { id: "svc-trt-milkshake-respect", name: "มิลค์เชคเคเรสเพคเคราติน", price: 4500, categoryId: "cat-treatment" },

    // สีผม
    { id: "svc-col-color", name: "ทำสีผม", price: 3000, categoryId: "cat-hair-color" },
    { id: "svc-col-roots", name: "เติมโคน", price: 2500, categoryId: "cat-hair-color" },
    { id: "svc-col-refresh", name: "เติมประกายสีผม", price: 2000, categoryId: "cat-hair-color" },
    { id: "svc-col-bleach", name: "ฟอกสีผม", price: 3000, categoryId: "cat-hair-color" },
    { id: "svc-col-wash", name: "ล้างประกายสีผม", price: 3000, categoryId: "cat-hair-color" },
    { id: "svc-col-highlight", name: "ทำไฮไลท์สีผม", price: 3000, categoryId: "cat-hair-color" },
    { id: "svc-col-balayage", name: "บาลายาจ", price: 8000, categoryId: "cat-hair-color" },

    // ยืด ดัด
    { id: "svc-perm-cold", name: "ดัดเย็น", price: 3000, categoryId: "cat-straight-perm" },
    { id: "svc-perm-digital", name: "ดัดดิจิตอล", price: 3000, categoryId: "cat-straight-perm" },
    { id: "svc-perm-straight", name: "ยืดผม", price: 3000, categoryId: "cat-straight-perm" },
    { id: "svc-perm-root", name: "ดัดยกโคนผม", price: 1000, categoryId: "cat-straight-perm" },
    { id: "svc-perm-down", name: "ดาวน์เพิร์มลดการชี้ฟู", price: 1000, categoryId: "cat-straight-perm" },

    // ทาสีเล็บ (มือ / เท้า)
    { id: "svc-nail-gel-normal-hand", name: "ทาสีเจลธรรมดา มือ", price: 350, categoryId: "cat-nail-polish" },
    { id: "svc-nail-gel-normal-foot", name: "ทาสีเจลธรรมดา เท้า", price: 400, categoryId: "cat-nail-polish" },
    { id: "svc-nail-gel-premium-hand", name: "ทาสีเจลพรีเมียม gellyfit / gelish มือ", price: 600, categoryId: "cat-nail-polish" },
    { id: "svc-nail-gel-premium-foot", name: "ทาสีเท้าธรรมดา gellyfit / gelish เท้า", price: 650, categoryId: "cat-nail-polish" },
    { id: "svc-nail-gel-2-colors", name: "ทาสีเจล 2 สี", price: 500, categoryId: "cat-nail-polish" },
    { id: "svc-nail-gel-3-colors", name: "ทาสีเจล 3 สีขึ้นไป", price: 550, categoryId: "cat-nail-polish" },
    { id: "svc-nail-cat-eye", name: "ทาสีลูกแก้ว", price: 450, categoryId: "cat-nail-polish" },
    { id: "svc-nail-cat-eye-gellyfit", name: "ทาสีลูกแก้ว Gellyfit", price: 850, categoryId: "cat-nail-polish" },
    { id: "svc-nail-syrup", name: "ทาสีไซรัป (สีสุขภาพ)", price: 450, categoryId: "cat-nail-polish" },
    { id: "svc-nail-flash", name: "ทาสีแฟลช", price: 450, categoryId: "cat-nail-polish" },
    { id: "svc-nail-glitter", name: "ทาสี กริตเตอร์", price: 450, categoryId: "cat-nail-polish" },
    { id: "svc-nail-ombre", name: "ทาสีออมเบร / ไล่สี", price: 500, categoryId: "cat-nail-polish" },
    { id: "svc-nail-embedded-pattern", name: "สีฝังลาย", price: 750, categoryId: "cat-nail-polish" },

    // งานต่อ / งานถอด
    { id: "svc-ext-pvc", name: "ต่อ PVC", price: 500, categoryId: "cat-nail-extension" },
    { id: "svc-ext-soft-gel-tip", name: "ต่อ soft gel tip", price: 650, categoryId: "cat-nail-extension" },
    { id: "svc-ext-gel", name: "ต่อ GEL.", price: 700, categoryId: "cat-nail-extension" },
    { id: "svc-ext-polygel", name: "ต่อ Polygel.", price: 800, categoryId: "cat-nail-extension" },
    { id: "svc-ext-acrylic", name: "ต่อ Aclyilic", price: 900, categoryId: "cat-nail-extension" },
    { id: "svc-rem-gel", name: "ถอดสีเจล", price: 200, categoryId: "cat-nail-extension" },
    { id: "svc-rem-pvc", name: "ถอด PVC", price: 300, categoryId: "cat-nail-extension" },
    { id: "svc-rem-gel-ext", name: "ถอด / เล็บต่อ GEL", price: 350, categoryId: "cat-nail-extension" },
    { id: "svc-rem-acrylic-ext", name: "ถอด เล็บต่อ Aclyilic", price: 350, categoryId: "cat-nail-extension" },
    { id: "svc-rem-parts", name: "ถอดอะไหล่ นิ้วละ", price: 80, categoryId: "cat-nail-extension" },
    { id: "svc-fix-nail", name: "ซ่อม / เคลียร์หน้าเล็บ", price: 250, categoryId: "cat-nail-extension" },
    { id: "svc-cut-skin", name: "ตัดหนัง / ตัดเล็บ", price: 250, categoryId: "cat-nail-extension" },
    { id: "svc-cut-skin-member", name: "ตัดหนัง / ตัดเล็บ เมมเบอร์ (ถอดฟรี)", price: 0, categoryId: "cat-nail-extension" },

    // งานเทคนิค
    { id: "svc-tech-embedded", name: "งานฝังลาย", price: 90, categoryId: "cat-nail-technical" },
    { id: "svc-tech-parts", name: "งานติดอะไหล่", price: 30, categoryId: "cat-nail-technical" },
    { id: "svc-tech-emboss", name: "งานปั้นนูน", price: 50, categoryId: "cat-nail-technical" },
    { id: "svc-tech-art", name: "งานอาร์ท วาดภาพ", price: 150, categoryId: "cat-nail-technical" },
    { id: "svc-tech-overlay", name: "เสริมหน้าเล็บ เจล", price: 250, categoryId: "cat-nail-technical" },
    { id: "svc-tech-overlay-2", name: "โอเว่อร์เลย์", price: 350, categoryId: "cat-nail-technical" },
    { id: "svc-tech-powder", name: "ขัดผง", price: 120, categoryId: "cat-nail-technical" },
    { id: "svc-tech-aurora-powder", name: "ขัดผงออโรร่า", price: 120, categoryId: "cat-nail-technical" },
    { id: "svc-tech-paint-pattern", name: "เพ้นท์ลาย", price: 90, categoryId: "cat-nail-technical" },
    { id: "svc-tech-paint-tip", name: "เพ้นท์ปลาย", price: 40, categoryId: "cat-nail-technical" },
    { id: "svc-tech-mirror-top", name: "ท็อปกระจก", price: 150, categoryId: "cat-nail-technical" },

    // สปามือ / เท้า
    { id: "svc-spa-hand-loccitane", name: "สปามือ Loccitane", price: 650, categoryId: "cat-spa" },
    { id: "svc-spa-foot-loccitane", name: "สปาเท้า Loccitane", price: 850, categoryId: "cat-spa" },
    { id: "svc-spa-hand-foot-loccitane", name: "สปามือ เท้า Loccitane", price: 1299, categoryId: "cat-spa" },
    { id: "svc-spa-paraffin-hand", name: "พาราฟิน มือ", price: 500, categoryId: "cat-spa" },
    { id: "svc-spa-paraffin-foot", name: "พาราฟิน เท้า", price: 600, categoryId: "cat-spa" }
  ];

  for (const svc of services) {
    await prisma.service.upsert({
      where: { id: svc.id },
      update: { name: svc.name, price: svc.price, categoryId: svc.categoryId },
      create: svc
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
