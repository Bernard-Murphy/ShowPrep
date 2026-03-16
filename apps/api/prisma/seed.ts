import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VENICE_VOICES = [
  {
    name: "Sky",
    providerVoiceId: "af_sky",
    gender: "female",
    language: "American English",
    isDefault: true,
  },
  {
    name: "Bella",
    providerVoiceId: "af_bella",
    gender: "female",
    language: "American English",
    isDefault: false,
  },
  {
    name: "Adam",
    providerVoiceId: "am_adam",
    gender: "male",
    language: "American English",
    isDefault: false,
  },
  {
    name: "Eric",
    providerVoiceId: "am_eric",
    gender: "male",
    language: "American English",
    isDefault: false,
  },
  {
    name: "Liam",
    providerVoiceId: "am_liam",
    gender: "male",
    language: "American English",
    isDefault: false,
  },
  {
    name: "Daniel",
    providerVoiceId: "bm_daniel",
    gender: "male",
    language: "British English",
    isDefault: false,
  },
  {
    name: "Alice",
    providerVoiceId: "bf_alice",
    gender: "female",
    language: "British English",
    isDefault: false,
  },
  {
    name: "Emma",
    providerVoiceId: "bf_emma",
    gender: "female",
    language: "British English",
    isDefault: false,
  },
];

async function main() {
  for (const v of VENICE_VOICES) {
    await prisma.voice.upsert({
      where: {
        provider_providerVoiceId: {
          provider: "VENICE",
          providerVoiceId: v.providerVoiceId,
        },
      },
      create: {
        name: v.name,
        provider: "VENICE",
        providerVoiceId: v.providerVoiceId,
        gender: v.gender,
        language: v.language,
        isDefault: v.isDefault,
      },
      update: { name: v.name, isDefault: v.isDefault },
    });
  }
  console.log("Seeded default Venice voices.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
