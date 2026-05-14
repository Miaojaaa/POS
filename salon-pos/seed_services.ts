import { prisma } from "./src/lib/prisma";

const data = [
  {
    category: "ทาสีเล็บ (มือ / เท้า)",
    services: [
      { name: "ทาสีเจลธรรมดา มือ", price: 350 },
      { name: "ทาสีเจลธรรมดา เท้า", price: 400 },
      { name: "ทาสีเจลพรีเมียม gellyfit / gelish มือ", price: 600 },
      { name: "ทาสีเจลพรีเมียม gellyfit / gelish เท้า", price: 650 },
      { name: "ทาสีเจล 2 สี", price: 500 },
      { name: "ทาสีเจล 3 สีขึ้นไป", price: 550 },
      { name: "ทาสีลูกแก้ว", price: 450 },
      { name: "ทาสีลูกแก้ว Gellyfit", price: 850 },
      { name: "ทาสีไซรัป (สีสุขภาพ)", price: 450 },
      { name: "ทาสีแฟลช", price: 450 },
      { name: "ทาสี กริตเตอร์", price: 450 },
      { name: "ทาสีออมเบร / ไล่สี", price: 500 },
      { name: "สีฝังลาย", price: 750 }
    ]
  },
  {
    category: "งานต่อ / งานถอด",
    services: [
      { name: "ต่อ PVC", price: 500 },
      { name: "ต่อ soft gel tip", price: 650 },
      { name: "ต่อ GEL.", price: 700 },
      { name: "ต่อ Polygel.", price: 800 },
      { name: "ต่อ Aclyilic", price: 900 },
      { name: "ถอดสีเจล", price: 200 },
      { name: "ถอด PVC", price: 300 },
      { name: "ถอด / เล็บต่อ GEL", price: 350 },
      { name: "ถอด เล็บต่อ Aclyilic", price: 350 },
      { name: "ถอดอะไหล่ นิ้วละ", price: 80 },
      { name: "ซ่อม / เคลียร์หน้าเล็บ", price: 250 },
      { name: "ตัดหนัง / ตัดเล็บ", price: 250 },
      { name: "ตัดหนัง / ตัดเล็บ เมมเบอร์ (ถอดฟรี)", price: 0 }
    ]
  },
  {
    category: "งานเทคนิค",
    services: [
      { name: "งานฝังลาย", price: 90 },
      { name: "งานติดอะไหล่", price: 30 },
      { name: "งานปั้นนูน", price: 50 },
      { name: "งานอาร์ท วาดภาพ", price: 150 },
      { name: "เสริมหน้าเล็บ เจล", price: 250 },
      { name: "โอเวอร์เลย์", price: 350 },
      { name: "ขัดผง", price: 120 },
      { name: "ขัดผงออโรร่า", price: 120 },
      { name: "เพ้นท์ลาย", price: 90 },
      { name: "เพ้นท์ปลาย", price: 40 },
      { name: "ท็อปกระจก", price: 150 }
    ]
  },
  {
    category: "สปามือ / เท้า",
    services: [
      { name: "สปามือ Loccitane", price: 650 },
      { name: "สปาเท้า Loccitane", price: 850 },
      { name: "สปามือ เท้า Loccitane", price: 1299 },
      { name: "พาราฟิน มือ", price: 500 },
      { name: "พาราฟิน เท้า", price: 600 }
    ]
  },
  {
    category: "ตัด & สระไดร์",
    services: [
      { name: "Senior Hair Cut", price: 1000 },
      { name: "ตัดผมหญิง", price: 650 },
      { name: "ตัดผมชาย", price: 400 },
      { name: "สระไดร์หญิง", price: 400 },
      { name: "สระไดร์ชาย", price: 300 }
    ]
  },
  {
    category: "ทรีทเมนท์",
    services: [
      { name: "L - ทรีทเมนท์หนังศรีษะ", price: 1500 },
      { name: "L - ซีรีย์เอ็กซ์เพิร์ททรีทเมนท์", price: 1500 },
      { name: "L - โมเลคกูล่าอาร์มทรีทเมนท์", price: 2500 },
      { name: "L - เมทัลดีเอ็กซ์ทรีทเมนท์", price: 2500 },
      { name: "มิลค์เชคเมคมายเดย์", price: 2000 },
      { name: "ดีพเลเยอร์", price: 2500 },
      { name: "ทรีทเมนท์รักษาพันธะแกนผม", price: 2000 },
      { name: "F - คัลเลอร์โปรเทสซ์", price: 3500 },
      { name: "F - เพียวริฟิกาโปร", price: 3500 },
      { name: "F - โฟรเทค", price: 3500 },
      { name: "K - พรีเมียร์", price: 3500 },
      { name: "K - เธอราพิส", price: 3500 },
      { name: "K - ฟูซิโอโดล์", price: 3500 },
      { name: "K - ทรีทเมนท์", price: 3000 },
      { name: "DD วีแกนเคราติน", price: 4000 },
      { name: "มิลค์เชคเคเรล์เพคเคราติน", price: 4500 }
    ]
  },
  {
    category: "สีผม",
    services: [
      { name: "ทำสีผม", price: 3000 },
      { name: "เติมโคน", price: 2500 },
      { name: "เติมประกายสีผม", price: 2000 },
      { name: "ฟอกสีผม", price: 3000 },
      { name: "ล้างประกายสีผม", price: 3000 },
      { name: "ทำไฮไลท์สีผม", price: 3000 },
      { name: "บาลาอาจ", price: 8000 }
    ]
  },
  {
    category: "ยืด ดัด",
    services: [
      { name: "ดัดเย็น", price: 3000 },
      { name: "ดัดดิจิตอล", price: 3000 },
      { name: "ยืดผม", price: 3000 },
      { name: "ดัดยกโคนผม", price: 1000 },
      { name: "ดาวน์เพิร์มลดการชี้ฟู", price: 1000 }
    ]
  }
];

async function main() {
  console.log("Starting to seed database...");
  for (const catData of data) {
    let category = await prisma.serviceCategory.findFirst({
      where: { name: catData.category }
    });

    if (!category) {
      console.log(`Creating category: ${catData.category}`);
      category = await prisma.serviceCategory.create({
        data: { name: catData.category }
      });
    } else {
      console.log(`Found category: ${catData.category}`);
    }

    for (const srvData of catData.services) {
      const existingService = await prisma.service.findFirst({
        where: {
          name: srvData.name,
          categoryId: category.id
        }
      });

      if (!existingService) {
        console.log(`  - Adding service: ${srvData.name} (${srvData.price})`);
        await prisma.service.create({
          data: {
            name: srvData.name,
            price: srvData.price,
            duration: 60,
            categoryId: category.id,
            isActive: true
          }
        });
      } else {
        if (existingService.price !== srvData.price) {
          console.log(`  - Updating price for: ${srvData.name} from ${existingService.price} to ${srvData.price}`);
          await prisma.service.update({
            where: { id: existingService.id },
            data: { price: srvData.price }
          });
        } else {
          console.log(`  - Service already exists: ${srvData.name}`);
        }
      }
    }
  }
  console.log("Seeding completed successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
